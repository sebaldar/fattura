import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { createAliquoteCache } from "../../src/legacy/aliquote-cache.js";
import { createLegacyPool } from "../../src/legacy/client.js";
import { cercaMerceByEan, cercaMerceByTesto, elencoAliquote } from "../../src/legacy/queries.js";
import { client, db } from "../db/setup.js";
import { loginAsNewUser } from "../support/auth.js";

const baseEnv = loadEnv();
const legacyPool = createLegacyPool(baseEnv);

describe("integrazione legacy MariaDB", () => {
  afterAll(async () => {
    await legacyPool.end();
    await client.end();
  });

  describe("query dirette", () => {
    it("cercaMerceByEan trova la merce e i dati aliquota", async () => {
      const merce = await cercaMerceByEan(legacyPool, "8001234567890");
      expect(merce).toMatchObject({
        codiceFornitore: "FORN01",
        codiceMerce: "ART001",
        prezzoDiVendita: 1220,
        aliquotaIvaCent: 2200,
        operazione: "imponibile",
      });
    });

    it("cercaMerceByEan torna null se non trovata", async () => {
      const merce = await cercaMerceByEan(legacyPool, "0000000000000");
      expect(merce).toBeNull();
    });

    it("cercaMerceByTesto cerca per descrizione con LIKE", async () => {
      const risultati = await cercaMerceByTesto(legacyPool, "aliquota 10%");
      expect(risultati).toHaveLength(1);
      expect(risultati[0]!.codiceMerce).toBe("ART002");
    });

    it("gestisce correttamente una riga esente con natura", async () => {
      const merce = await cercaMerceByEan(legacyPool, "8001234567893");
      expect(merce).toMatchObject({ operazione: "non imponibile", natura: "N2", aliquotaIvaCent: 0 });
    });

    it("elencoAliquote ritorna tutte le aliquote", async () => {
      const aliquote = await elencoAliquote(legacyPool);
      expect(aliquote.map((a) => a.codice).sort()).toEqual(["04000", "10000", "22000", "N2"]);
    });
  });

  describe("cache aliquote (TTL 1h)", () => {
    it("non interroga il DB una seconda volta entro il TTL", async () => {
      const cache = createAliquoteCache();
      const spy = vi.spyOn(legacyPool, "query");
      await cache.get(legacyPool);
      const chiamateDopoLaPrima = spy.mock.calls.length;
      expect(chiamateDopoLaPrima).toBeGreaterThan(0);
      await cache.get(legacyPool);
      expect(spy.mock.calls.length).toBe(chiamateDopoLaPrima);
      spy.mockRestore();
    });
  });

  describe("route /api/legacy/*", () => {
    let app: FastifyInstance;
    let cookies: Record<string, string>;
    const userEmail = `test-legacy-${randomUUID()}@example.com`;

    beforeAll(async () => {
      app = await buildApp(baseEnv, db);
      await app.ready();
      const jar = await loginAsNewUser(app, userEmail);
      cookies = jar.cookies;
    });

    afterAll(async () => {
      await app.close();
    });

    it("richiede autenticazione", async () => {
      const res = await app.inject({ method: "GET", url: "/api/legacy/aliquote" });
      expect(res.statusCode).toBe(401);
    });

    it("GET /api/legacy/merci?ean= restituisce la merce con prezzo scorporato", async () => {
      const res = await app.inject({ method: "GET", url: "/api/legacy/merci?ean=8001234567890", cookies });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ codiceMerce: "ART001", prezzoUnitarioCent: 1000 });
    });

    it("GET /api/legacy/merci?ean= sconosciuto risponde 404", async () => {
      const res = await app.inject({ method: "GET", url: "/api/legacy/merci?ean=0000000000000", cookies });
      expect(res.statusCode).toBe(404);
    });

    it("GET /api/legacy/merci?q= restituisce risultati multipli", async () => {
      const res = await app.inject({ method: "GET", url: "/api/legacy/merci?q=Prodotto", cookies });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBeGreaterThanOrEqual(4);
    });

    it("GET /api/legacy/merci senza ean né q risponde 400", async () => {
      const res = await app.inject({ method: "GET", url: "/api/legacy/merci", cookies });
      expect(res.statusCode).toBe(400);
    });

    it("GET /api/legacy/aliquote restituisce l'elenco completo", async () => {
      const res = await app.inject({ method: "GET", url: "/api/legacy/aliquote", cookies });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBe(4);
    });
  });

  describe("degrado su legacy irraggiungibile", () => {
    let app: FastifyInstance;
    let cookies: Record<string, string>;
    const userEmail = `test-legacy-degrado-${randomUUID()}@example.com`;

    beforeAll(async () => {
      const envIrraggiungibile = { ...baseEnv, LEGACY_DB_HOST: "127.0.0.1", LEGACY_DB_PORT: 1 };
      app = await buildApp(envIrraggiungibile, db);
      await app.ready();
      const jar = await loginAsNewUser(app, userEmail);
      cookies = jar.cookies;
    });

    afterAll(async () => {
      await app.close();
    });

    it(
      "degrada con 503 senza bloccare, entro un tempo limitato",
      async () => {
        const start = Date.now();
        const res = await app.inject({ method: "GET", url: "/api/legacy/merci?ean=123", cookies });
        const elapsed = Date.now() - start;
        expect(res.statusCode).toBe(503);
        expect(res.json().degraded).toBe(true);
        expect(elapsed).toBeLessThan(4500);
      },
      8000,
    );

    it(
      "degrada anche per l'elenco aliquote",
      async () => {
        const res = await app.inject({ method: "GET", url: "/api/legacy/aliquote", cookies });
        expect(res.statusCode).toBe(503);
      },
      8000,
    );
  });
});
