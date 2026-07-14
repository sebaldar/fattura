import type { FastifyInstance } from "fastify";
import type { AliquoteCache } from "../legacy/aliquote-cache.js";
import type { LegacyPool } from "../legacy/client.js";
import { cercaMerceByEan, cercaMerceByTesto } from "../legacy/queries.js";
import { scorporaIva } from "../legacy/scorporo.js";
import { validateBody } from "../lib/validation.js";
import { legacyMerciQuerySchema } from "../validation/legacy.js";

export interface LegacyRoutesOptions {
  legacyPool: LegacyPool;
  aliquoteCache: AliquoteCache;
}

const MESSAGGIO_DEGRADATO_MERCI = "Listino legacy non raggiungibile: inserisci la riga manualmente";
const MESSAGGIO_DEGRADATO_ALIQUOTE = "Elenco aliquote non raggiungibile: inserisci i dati manualmente";

export async function legacyRoutes(app: FastifyInstance, opts: LegacyRoutesOptions): Promise<void> {
  const { legacyPool, aliquoteCache } = opts;

  app.get("/api/legacy/merci", async (request, reply) => {
    const query = validateBody(legacyMerciQuerySchema, request.query, reply);
    if (!query) return;

    try {
      if (query.ean) {
        const merce = await cercaMerceByEan(legacyPool, query.ean);
        if (!merce) {
          reply.code(404).send({ error: "Nessuna merce trovata per l'EAN indicato" });
          return;
        }
        reply.send({
          ...merce,
          prezzoUnitarioCent: scorporaIva(merce.prezzoDiVendita, merce.aliquotaIvaCent),
        });
        return;
      }

      const risultati = await cercaMerceByTesto(legacyPool, query.q!);
      reply.send(
        risultati.map((merce) => ({
          ...merce,
          prezzoUnitarioCent: scorporaIva(merce.prezzoDiVendita, merce.aliquotaIvaCent),
        })),
      );
    } catch (err) {
      request.log.warn({ err }, "Legacy MariaDB non raggiungibile (merci)");
      reply.code(503).send({ error: MESSAGGIO_DEGRADATO_MERCI, degraded: true });
    }
  });

  app.get("/api/legacy/aliquote", async (request, reply) => {
    try {
      const aliquote = await aliquoteCache.get(legacyPool);
      reply.send(aliquote);
    } catch (err) {
      request.log.warn({ err }, "Legacy MariaDB non raggiungibile (aliquote)");
      reply.code(503).send({ error: MESSAGGIO_DEGRADATO_ALIQUOTE, degraded: true });
    }
  });
}
