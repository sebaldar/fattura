import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { clienti, contatori, utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";
import { loginAsNewUser } from "../support/auth.js";

const env = loadEnv();
const N_CONCORRENTI = 8;
const ANNO_TEST = 2031; // anno dedicato per non interferire con altri test

describe("emissioni concorrenti: nessun progressivo duplicato", () => {
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let clienteId: string;
  const userEmail = `test-concorrenza-${randomUUID()}@example.com`;

  beforeAll(async () => {
    app = await buildApp(env, db);
    await app.ready();
    const jar = await loginAsNewUser(app, userEmail);
    cookies = jar.cookies;

    const [cliente] = await db
      .insert(clienti)
      .values({ denominazione: "Cliente Concorrenza Test", partitaIva: "12345678903" })
      .returning();
    clienteId = cliente!.id;
  });

  afterAll(async () => {
    // Il cliente resta referenziato dalle fatture emesse (immutabili) create dal test:
    // il vincolo FK ne impedisce correttamente la cancellazione.
    await db.delete(utenti).where(eq(utenti.email, userEmail));
    await app.close();
    await client.end();
  });

  it(
    `${N_CONCORRENTI} emissioni parallele producono progressivi tutti distinti e consecutivi`,
    async () => {
      const [contatorePrima] = await db
        .select()
        .from(contatori)
        .where(and(eq(contatori.tipo, "fattura"), eq(contatori.anno, ANNO_TEST)));
      const baseline = contatorePrima?.ultimoProgressivo ?? 0;

      const documentoIds: string[] = [];
      for (let i = 0; i < N_CONCORRENTI; i++) {
        const creaRes = await app.inject({
          method: "POST",
          url: "/api/documenti",
          cookies,
          payload: { clienteId, dataDocumento: `${ANNO_TEST}-01-15` },
        });
        expect(creaRes.statusCode).toBe(201);
        const documentoId = creaRes.json().id;

        const rigaRes = await app.inject({
          method: "POST",
          url: `/api/documenti/${documentoId}/righe`,
          cookies,
          payload: {
            descrizione: `Prodotto concorrenza ${i}`,
            codiceIva: "22000",
            aliquotaIvaCent: 2200,
            quantita: "1",
            prezzoUnitarioCent: 1000,
          },
        });
        expect(rigaRes.statusCode).toBe(201);
        documentoIds.push(documentoId);
      }

      // Emissione realmente concorrente: N transazioni parallele in lotta sulla
      // stessa riga `contatori` (tipo=fattura, anno=ANNO_TEST) via SELECT ... FOR UPDATE.
      const risposte = await Promise.all(
        documentoIds.map((id) =>
          app.inject({ method: "POST", url: `/api/documenti/${id}/emetti`, cookies }),
        ),
      );

      for (const res of risposte) {
        expect(res.statusCode).toBe(200);
      }

      const progressivi = risposte.map((res) => res.json().progressivo as number).sort((a, b) => a - b);
      const attesi = Array.from({ length: N_CONCORRENTI }, (_, i) => baseline + i + 1);
      expect(progressivi).toEqual(attesi);

      // Anche i numeri documento devono essere tutti distinti.
      const numeri = new Set(risposte.map((res) => res.json().numero as string));
      expect(numeri.size).toBe(N_CONCORRENTI);

      const [contatoreDopo] = await db
        .select()
        .from(contatori)
        .where(and(eq(contatori.tipo, "fattura"), eq(contatori.anno, ANNO_TEST)));
      expect(contatoreDopo!.ultimoProgressivo).toBe(baseline + N_CONCORRENTI);
    },
    20000,
  );
});
