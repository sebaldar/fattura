import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { emittente, utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";
import { loginAsNewUser } from "../support/auth.js";

const env = loadEnv();

describe("impostazioni emittente", () => {
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  const userEmail = `test-emittente-${randomUUID()}@example.com`;

  beforeAll(async () => {
    app = await buildApp(env, db);
    await app.ready();
    const jar = await loginAsNewUser(app, userEmail);
    cookies = jar.cookies;

    await db
      .insert(emittente)
      .values({
        id: 1,
        ragioneSociale: "Emittente Iniziale S.r.l.",
        partitaIva: "00000000000",
        codiceFiscale: "00000000000",
        indirizzo: "Via Iniziale 1",
        cap: "00100",
        comune: "Roma",
        provincia: "RM",
        nazione: "IT",
        regimeFiscale: "RF01",
        iban: "IT00X0000000000000000000000",
        email: "iniziale@test.it",
      })
      .onConflictDoNothing({ target: emittente.id });
  });

  afterAll(async () => {
    await db.delete(utenti).where(eq(utenti.email, userEmail));
    await app.close();
    await client.end();
  });

  it("richiede autenticazione", async () => {
    const res = await app.inject({ method: "GET", url: "/api/emittente" });
    expect(res.statusCode).toBe(401);
  });

  it("legge i dati emittente", async () => {
    const res = await app.inject({ method: "GET", url: "/api/emittente", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().ragioneSociale).toBeTruthy();
  });

  it("aggiorna i dati emittente con validazione", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/emittente",
      cookies,
      payload: {
        ragioneSociale: "Nuova Ragione Sociale S.r.l.",
        partitaIva: "12345678903",
        codiceFiscale: "12345678903",
        indirizzo: "Via Nuova 10",
        cap: "20100",
        comune: "Milano",
        provincia: "MI",
        nazione: "IT",
        regimeFiscale: "RF19",
        iban: "IT60X0542811101000000123456",
        email: "nuova@test.it",
        telefono: "0299999999",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ragioneSociale).toBe("Nuova Ragione Sociale S.r.l.");
    expect(body.regimeFiscale).toBe("RF19");

    const rilettura = await app.inject({ method: "GET", url: "/api/emittente", cookies });
    expect(rilettura.json().partitaIva).toBe("12345678903");
  });

  it("rifiuta una partita IVA senza checksum valido", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/emittente",
      cookies,
      payload: {
        ragioneSociale: "X",
        partitaIva: "00000000001",
        codiceFiscale: "12345678903",
        indirizzo: "Via X",
        cap: "20100",
        comune: "Milano",
        provincia: "MI",
        nazione: "IT",
        regimeFiscale: "RF01",
        iban: "IT60X0542811101000000123456",
        email: "x@test.it",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
