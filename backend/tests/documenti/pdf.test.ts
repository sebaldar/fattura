import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { clienti, emittente, utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";
import { loginAsNewUser } from "../support/auth.js";

const env = loadEnv();

describe("generazione PDF documento", () => {
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let clienteId: string;
  const userEmail = `test-pdf-${randomUUID()}@example.com`;

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
        partitaIva: "00000000000",
        codiceFiscale: "00000000000",
        indirizzo: "Via Test 1",
        cap: "00100",
        comune: "Roma",
        provincia: "RM",
        nazione: "IT",
        regimeFiscale: "RF01",
        iban: "IT00X0000000000000000000000",
        email: "emittente@test.it",
      })
      .onConflictDoNothing({ target: emittente.id });

    const [cliente] = await db
      .insert(clienti)
      .values({ denominazione: "Cliente PDF Test", partitaIva: "12345678903" })
      .returning();
    clienteId = cliente!.id;
  });

  afterAll(async () => {
    await db.delete(utenti).where(eq(utenti.email, userEmail));
    await app.close();
    await client.end();
  });

  it("rifiuta il download per una bozza (403)", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-06-01" },
    });
    const documentoId = creaRes.json().id;

    const pdfRes = await app.inject({ method: "GET", url: `/api/documenti/${documentoId}/pdf`, cookies });
    expect(pdfRes.statusCode).toBe(403);
  });

  it("restituisce 404 per un documento inesistente", async () => {
    const pdfRes = await app.inject({
      method: "GET",
      url: `/api/documenti/${randomUUID()}/pdf`,
      cookies,
    });
    expect(pdfRes.statusCode).toBe(404);
  });

  it("genera il PDF di una fattura emessa con header e nome file corretti", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-06-01" },
    });
    const documentoId = creaRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: {
        descrizione: "Prodotto PDF",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "2",
        prezzoUnitarioCent: 1000,
      },
    });

    const emettiRes = await app.inject({ method: "POST", url: `/api/documenti/${documentoId}/emetti`, cookies });
    const numero = emettiRes.json().numero as string;

    const pdfRes = await app.inject({ method: "GET", url: `/api/documenti/${documentoId}/pdf`, cookies });
    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.headers["content-type"]).toBe("application/pdf");
    expect(pdfRes.headers["content-disposition"]).toBe(`attachment; filename="${numero}.pdf"`);

    const buffer = pdfRes.rawPayload;
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("genera il PDF di una nota di credito includendo il riferimento alla fattura stornata", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-06-02" },
    });
    const fatturaId = creaRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/documenti/${fatturaId}/righe`,
      cookies,
      payload: {
        descrizione: "Prodotto da stornare",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "1",
        prezzoUnitarioCent: 1000,
      },
    });
    await app.inject({ method: "POST", url: `/api/documenti/${fatturaId}/emetti`, cookies });

    const ncRes = await app.inject({ method: "POST", url: `/api/documenti/${fatturaId}/note-credito`, cookies });
    const ncId = ncRes.json().id;

    const emettiNcRes = await app.inject({ method: "POST", url: `/api/documenti/${ncId}/emetti`, cookies });
    const numeroNc = emettiNcRes.json().numero as string;
    expect(numeroNc).toMatch(/^IT-NC-/);

    const pdfRes = await app.inject({ method: "GET", url: `/api/documenti/${ncId}/pdf`, cookies });
    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.headers["content-disposition"]).toBe(`attachment; filename="${numeroNc}.pdf"`);
    expect(pdfRes.rawPayload.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
