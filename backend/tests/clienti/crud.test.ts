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

describe("CRUD clienti", () => {
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  const userEmail = `test-clienti-${randomUUID()}@example.com`;
  const createdClienteIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp(env, db);
    await app.ready();
    const jar = await loginAsNewUser(app, userEmail);
    cookies = jar.cookies;
  });

  afterAll(async () => {
    for (const id of createdClienteIds) {
      await db.delete(clienti).where(eq(clienti.id, id));
    }
    await db.delete(utenti).where(eq(utenti.email, userEmail));
    await app.close();
    await client.end();
  });

  it("rifiuta le richieste non autenticate", async () => {
    const res = await app.inject({ method: "GET", url: "/api/clienti" });
    expect(res.statusCode).toBe(401);
  });

  it("crea un cliente con partita IVA valida", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/clienti",
      cookies,
      payload: { denominazione: "Mario Rossi S.r.l.", partitaIva: "12345678903" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.partitaIva).toBe("12345678903");
    expect(body.nazione).toBe("IT");
    createdClienteIds.push(body.id);
  });

  it("rifiuta una partita IVA con checksum non valido", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/clienti",
      cookies,
      payload: { denominazione: "Cliente Test", partitaIva: "12345678900" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("richiede almeno uno tra partita IVA e codice fiscale", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/clienti",
      cookies,
      payload: { denominazione: "Cliente Senza Identificativi" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("trova il cliente tramite ricerca per denominazione", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/clienti?q=Mario%20Rossi",
      cookies,
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.some((r: { id: string }) => createdClienteIds.includes(r.id))).toBe(true);
  });

  it("recupera il cliente per id, 404 se non esiste", async () => {
    const id = createdClienteIds[0]!;
    const okRes = await app.inject({ method: "GET", url: `/api/clienti/${id}`, cookies });
    expect(okRes.statusCode).toBe(200);

    const missingRes = await app.inject({
      method: "GET",
      url: `/api/clienti/${randomUUID()}`,
      cookies,
    });
    expect(missingRes.statusCode).toBe(404);
  });

  it("400 su id non valido (non uuid)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/clienti/not-a-uuid", cookies });
    expect(res.statusCode).toBe(400);
  });

  it("aggiorna un cliente esistente", async () => {
    const id = createdClienteIds[0]!;
    const res = await app.inject({
      method: "PUT",
      url: `/api/clienti/${id}`,
      cookies,
      payload: {
        denominazione: "Mario Rossi S.r.l. (aggiornato)",
        partitaIva: "12345678903",
        email: "mario@example.com",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.denominazione).toBe("Mario Rossi S.r.l. (aggiornato)");
    expect(body.email).toBe("mario@example.com");
  });
});
