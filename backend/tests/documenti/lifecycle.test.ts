import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { clienti, utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";
import { loginAsNewUser } from "../support/auth.js";

const env = loadEnv();

describe("ciclo di vita documento (bozza -> emessa, righe, nota di credito)", () => {
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let clienteId: string;
  const userEmail = `test-documenti-${randomUUID()}@example.com`;

  beforeAll(async () => {
    app = await buildApp(env, db);
    await app.ready();
    const jar = await loginAsNewUser(app, userEmail);
    cookies = jar.cookies;

    const [cliente] = await db
      .insert(clienti)
      .values({ denominazione: "Cliente Documenti Test", partitaIva: "12345678903" })
      .returning();
    clienteId = cliente!.id;
  });

  afterAll(async () => {
    // Il cliente resta referenziato da documenti (in particolare emessi, quindi
    // immutabili) creati durante i test: il vincolo FK ne impedisce la cancellazione,
    // correttamente. Si ripulisce solo l'utente di test.
    await db.delete(utenti).where(eq(utenti.email, userEmail));
    await app.close();
    await client.end();
  });

  it("richiede autenticazione", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documenti" });
    expect(res.statusCode).toBe(401);
  });

  it("crea una bozza fattura con anno derivato dalla data documento", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-03-15" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tipo).toBe("fattura");
    expect(body.stato).toBe("bozza");
    expect(body.anno).toBe(2029);
    expect(body.numero).toBeNull();
    expect(body.righe).toEqual([]);
  });

  it("rifiuta l'emissione di una bozza senza righe", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-03-15" },
    });
    const documentoId = creaRes.json().id;

    const emettiRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/emetti`,
      cookies,
    });
    expect(emettiRes.statusCode).toBe(400);
  });

  it("aggiunge, aggiorna ed elimina righe ricalcolando i totali ad ogni modifica", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-03-15" },
    });
    const documentoId = creaRes.json().id;

    const riga1Res = await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: {
        descrizione: "Prodotto A",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "2",
        prezzoUnitarioCent: 1000,
      },
    });
    expect(riga1Res.statusCode).toBe(201);
    let body = riga1Res.json();
    expect(body.righe).toHaveLength(1);
    expect(body.righe[0].totaleRigaCent).toBe(2000);
    expect(body.totaleImponibileCent).toBe(2000);
    expect(body.totaleIvaCent).toBe(440);
    expect(body.totaleCent).toBe(2440);

    const riga2Res = await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: {
        descrizione: "Prodotto B esente",
        codiceIva: "N2",
        aliquotaIvaCent: 0,
        natura: "N2",
        quantita: "1",
        prezzoUnitarioCent: 500,
      },
    });
    body = riga2Res.json();
    expect(body.righe).toHaveLength(2);
    expect(body.totaleImponibileCent).toBe(2500);
    expect(body.totaleIvaCent).toBe(440);
    expect(body.totaleCent).toBe(2940);
    const rigaBId = body.righe.find((r: { descrizione: string }) => r.descrizione === "Prodotto B esente").id;

    const aggiornaRes = await app.inject({
      method: "PUT",
      url: `/api/documenti/${documentoId}/righe/${rigaBId}`,
      cookies,
      payload: {
        descrizione: "Prodotto B esente",
        codiceIva: "N2",
        aliquotaIvaCent: 0,
        natura: "N2",
        quantita: "3",
        prezzoUnitarioCent: 500,
      },
    });
    body = aggiornaRes.json();
    expect(body.totaleImponibileCent).toBe(2000 + 1500);
    expect(body.totaleCent).toBe(2000 + 1500 + 440);

    const eliminaRes = await app.inject({
      method: "DELETE",
      url: `/api/documenti/${documentoId}/righe/${rigaBId}`,
      cookies,
    });
    body = eliminaRes.json();
    expect(body.righe).toHaveLength(1);
    expect(body.totaleImponibileCent).toBe(2000);
    expect(body.totaleCent).toBe(2440);
  });

  it("emette una fattura assegnando numero e rendendola immutabile", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-05-01" },
    });
    const documentoId = creaRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: {
        descrizione: "Prodotto emissione",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "1",
        prezzoUnitarioCent: 1000,
      },
    });

    const emettiRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/emetti`,
      cookies,
    });
    expect(emettiRes.statusCode).toBe(200);
    const emesso = emettiRes.json();
    expect(emesso.stato).toBe("emessa");
    expect(emesso.numero).toMatch(/^IT-F-29\d{4}$/);
    expect(emesso.progressivo).toBeGreaterThan(0);
    expect(emesso.clienteSnapshot.denominazione).toBe("Cliente Documenti Test");

    // Immutabile: modifiche testata/righe rifiutate a livello applicativo (409)
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/documenti/${documentoId}`,
      cookies,
      payload: { clienteId, dataDocumento: "2029-06-01" },
    });
    expect(putRes.statusCode).toBe(409);

    const rigaRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: {
        descrizione: "Riga vietata",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "1",
        prezzoUnitarioCent: 100,
      },
    });
    expect(rigaRes.statusCode).toBe(409);

    // Riemissione: 409 (già emessa)
    const riemettiRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/emetti`,
      cookies,
    });
    expect(riemettiRes.statusCode).toBe(409);
  });

  it("crea una nota di credito da una fattura emessa, copiando le righe", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-05-02" },
    });
    const fatturaId = creaRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/documenti/${fatturaId}/righe`,
      cookies,
      payload: {
        descrizione: "Prodotto per storno",
        codiceIva: "10000",
        aliquotaIvaCent: 1000,
        quantita: "4",
        prezzoUnitarioCent: 2500,
      },
    });

    const emessaRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${fatturaId}/emetti`,
      cookies,
    });
    expect(emessaRes.statusCode).toBe(200);

    const ncRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${fatturaId}/note-credito`,
      cookies,
    });
    expect(ncRes.statusCode).toBe(201);
    const nc = ncRes.json();
    expect(nc.tipo).toBe("nota_credito");
    expect(nc.stato).toBe("bozza");
    expect(nc.documentoRiferimentoId).toBe(fatturaId);
    expect(nc.righe).toHaveLength(1);
    expect(nc.righe[0].descrizione).toBe("Prodotto per storno");
    expect(nc.totaleImponibileCent).toBe(10000);
    // La NC nasce datata oggi (non eredita l'anno della fattura stornata).
    const annoOggi = new Date().getFullYear();
    expect(nc.anno).toBe(annoOggi);

    const emettiNcRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${nc.id}/emetti`,
      cookies,
    });
    expect(emettiNcRes.statusCode).toBe(200);
    const yy = String(annoOggi % 100).padStart(2, "0");
    expect(emettiNcRes.json().numero).toMatch(new RegExp(`^IT-NC-${yy}\\d{4}$`));
  });

  it("rifiuta la creazione di una nota di credito da una fattura non ancora emessa", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-05-03" },
    });
    const bozzaId = creaRes.json().id;

    const ncRes = await app.inject({
      method: "POST",
      url: `/api/documenti/${bozzaId}/note-credito`,
      cookies,
    });
    expect(ncRes.statusCode).toBe(409);
  });

  it("elimina una bozza e le sue righe", async () => {
    const creaRes = await app.inject({
      method: "POST",
      url: "/api/documenti",
      cookies,
      payload: { clienteId, dataDocumento: "2029-05-04" },
    });
    const documentoId = creaRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/documenti/${documentoId}/righe`,
      cookies,
      payload: {
        descrizione: "Da eliminare",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "1",
        prezzoUnitarioCent: 100,
      },
    });

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/documenti/${documentoId}`, cookies });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: "GET", url: `/api/documenti/${documentoId}`, cookies });
    expect(getRes.statusCode).toBe(404);
  });

  it("filtra la lista documenti per tipo e stato", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/documenti?tipo=fattura&stato=emessa&clienteId=${clienteId}`,
      cookies,
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.tipo).toBe("fattura");
      expect(row.stato).toBe("emessa");
      expect(row.clienteId).toBe(clienteId);
    }
  });
});
