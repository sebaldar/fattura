import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { clienti, emittente, utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";
import { loginAsNewUser } from "../support/auth.js";
import { validaFatturaPaXsd } from "../support/xsd.js";

const env = loadEnv();

describe("generazione XML FatturaPA", () => {
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let clienteId: string;
  const userEmail = `test-xml-${randomUUID()}@example.com`;

  beforeAll(async () => {
    app = await buildApp(env, db);
    await app.ready();
    const jar = await loginAsNewUser(app, userEmail);
    cookies = jar.cookies;

    await db
      .insert(emittente)
      .values({
        id: 1,
        ragioneSociale: "Emittente Test S.r.l.",
        partitaIva: "01234567890",
        codiceFiscale: "01234567890",
        indirizzo: "Via Test 1",
        cap: "00100",
        comune: "Roma",
        provincia: "RM",
        nazione: "IT",
        regimeFiscale: "RF01",
        iban: "IT00X0000000000000000000000",
        email: "emittente@test.it",
        telefono: "0612345678",
      })
      .onConflictDoNothing({ target: emittente.id });

    const [cliente] = await db
      .insert(clienti)
      .values({
        denominazione: "Cliente XML Test",
        partitaIva: "12345678903",
        indirizzo: "Via Cliente 5",
        cap: "20100",
        comune: "Milano",
        provincia: "MI",
        nazione: "IT",
      })
      .returning();
    clienteId = cliente!.id;
  });

  afterAll(async () => {
    await db.delete(utenti).where(eq(utenti.email, userEmail));
    await app.close();
    await client.end();
  });

  async function creaEdEmettiFattura(righe: Array<Record<string, unknown>>): Promise<{ id: string; numero: string }> {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-07-01" },
    });
    const documentoId = creaRes.json().id;

    for (const riga of righe) {
      await app.inject({ method: "POST", url: `/api/documenti/${documentoId}/righe`, cookies, payload: riga });
    }

    const emettiRes = await app.inject({ method: "POST", url: `/api/documenti/${documentoId}/emetti`, cookies });
    return { id: documentoId, numero: emettiRes.json().numero as string };
  }

  it("rifiuta il download per una bozza (403)", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-07-01" },
    });
    const documentoId = creaRes.json().id;

    const xmlRes = await app.inject({ method: "GET", url: `/api/documenti/${documentoId}/xml`, cookies });
    expect(xmlRes.statusCode).toBe(403);
  });

  it("restituisce 404 per un documento inesistente", async () => {
    const res = await app.inject({ method: "GET", url: `/api/documenti/${randomUUID()}/xml`, cookies });
    expect(res.statusCode).toBe(404);
  });

  it("genera un XML valido contro lo XSD per una fattura con aliquote multiple e riga esente", async () => {
    const { id, numero } = await creaEdEmettiFattura([
      { descrizione: "Prodotto A", codiceIva: "22000", aliquotaIvaCent: 2200, quantita: "2", prezzoUnitarioCent: 1000 },
      { descrizione: "Prodotto B", codiceIva: "10000", aliquotaIvaCent: 1000, quantita: "1", prezzoUnitarioCent: 5000 },
      {
        descrizione: "Prodotto esente",
        codiceIva: "N22",
        aliquotaIvaCent: 0,
        natura: "N2",
        quantita: "1",
        prezzoUnitarioCent: 300,
      },
    ]);

    const xmlRes = await app.inject({ method: "GET", url: `/api/documenti/${id}/xml`, cookies });
    expect(xmlRes.statusCode).toBe(200);
    expect(xmlRes.headers["content-type"]).toBe("application/xml");
    expect(xmlRes.headers["content-disposition"]).toMatch(/^attachment; filename="IT\d{11}_[A-Z0-9]{5}\.xml"$/);

    const xml = xmlRes.body;
    expect(() => validaFatturaPaXsd(xml)).not.toThrow();

    expect(xml).toContain('versione="FPR12"');
    expect(xml).toContain("<TipoDocumento>TD01</TipoDocumento>");
    expect(xml).toContain(`<Numero>${numero}</Numero>`);
    expect(xml).toContain("<Denominazione>Cliente XML Test</Denominazione>");
    expect(xml).toContain("<Natura>N2</Natura>");
    // 3 righe + 3 raggruppamenti di riepilogo (22%, 10%, 0% N2)
    expect(xml.match(/<DettaglioLinee>/g)).toHaveLength(3);
    expect(xml.match(/<DatiRiepilogo>/g)).toHaveLength(3);
  });

  it("genera un XML valido contro lo XSD per una nota di credito con riferimento alla fattura", async () => {
    const { id: fatturaId, numero: numeroFattura } = await creaEdEmettiFattura([
      { descrizione: "Prodotto da stornare", codiceIva: "22000", aliquotaIvaCent: 2200, quantita: "1", prezzoUnitarioCent: 1000 },
    ]);

    const ncRes = await app.inject({ method: "POST", url: `/api/documenti/${fatturaId}/note-credito`, cookies });
    const ncId = ncRes.json().id;
    const emettiNcRes = await app.inject({ method: "POST", url: `/api/documenti/${ncId}/emetti`, cookies });
    const numeroNc = emettiNcRes.json().numero as string;

    const xmlRes = await app.inject({ method: "GET", url: `/api/documenti/${ncId}/xml`, cookies });
    expect(xmlRes.statusCode).toBe(200);

    const xml = xmlRes.body;
    expect(() => validaFatturaPaXsd(xml)).not.toThrow();
    expect(xml).toContain("<TipoDocumento>TD04</TipoDocumento>");
    expect(xml).toContain(`<Numero>${numeroNc}</Numero>`);
    expect(xml).toContain(`<IdDocumento>${numeroFattura}</IdDocumento>`);
  });

  it("rifiuta la generazione se una riga esente/non imponibile è priva di natura (422)", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-07-02" },
    });
    const documentoId = creaRes.json().id;
    await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: { descrizione: "Riga senza natura", codiceIva: "N0", aliquotaIvaCent: 0, quantita: "1", prezzoUnitarioCent: 100 },
    });
    await app.inject({ method: "POST", url: `/api/documenti/${documentoId}/emetti`, cookies });

    const xmlRes = await app.inject({ method: "GET", url: `/api/documenti/${documentoId}/xml`, cookies });
    expect(xmlRes.statusCode).toBe(422);
  });
});
