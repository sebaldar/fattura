import { desc, eq, ilike, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { estraiClienteDaFoto } from "../ai/estrazione-cliente.js";
import type { Env } from "../config/env.js";
import type { Db } from "../db/client.js";
import { clienti } from "../db/schema.js";
import { undefinedToNull, validateBody } from "../lib/validation.js";
import {
  clienteIdParamSchema,
  createClienteSchema,
  listClientiQuerySchema,
  updateClienteSchema,
} from "../validation/clienti.js";

const MAX_FOTO_BYTES = 10 * 1024 * 1024;

export interface ClientiRoutesOptions {
  db: Db;
  env: Env;
}

export async function clientiRoutes(app: FastifyInstance, opts: ClientiRoutesOptions): Promise<void> {
  const { db, env } = opts;

  app.get("/api/clienti", async (request, reply) => {
    const query = validateBody(listClientiQuerySchema, request.query, reply);
    if (!query) return;

    const rows = query.q
      ? await db
          .select()
          .from(clienti)
          .where(
            or(
              ilike(clienti.denominazione, `%${query.q}%`),
              ilike(clienti.partitaIva, `%${query.q}%`),
              ilike(clienti.codiceFiscale, `%${query.q}%`),
            ),
          )
          .orderBy(desc(clienti.createdAt))
          .limit(50)
      : await db.select().from(clienti).orderBy(desc(clienti.createdAt)).limit(50);

    reply.send(rows);
  });

  app.get("/api/clienti/:id", async (request, reply) => {
    const params = validateBody(clienteIdParamSchema, request.params, reply);
    if (!params) return;

    const [row] = await db.select().from(clienti).where(eq(clienti.id, params.id)).limit(1);
    if (!row) {
      reply.code(404).send({ error: "Cliente non trovato" });
      return;
    }
    reply.send(row);
  });

  app.post("/api/clienti", async (request, reply) => {
    const body = validateBody(createClienteSchema, request.body, reply);
    if (!body) return;

    const [row] = await db.insert(clienti).values(undefinedToNull(body)).returning();
    reply.code(201).send(row);
  });

  app.put("/api/clienti/:id", async (request, reply) => {
    const params = validateBody(clienteIdParamSchema, request.params, reply);
    if (!params) return;
    const body = validateBody(updateClienteSchema, request.body, reply);
    if (!body) return;

    const [existing] = await db.select().from(clienti).where(eq(clienti.id, params.id)).limit(1);
    if (!existing) {
      reply.code(404).send({ error: "Cliente non trovato" });
      return;
    }

    const [row] = await db
      .update(clienti)
      .set({ ...undefinedToNull(body), updatedAt: new Date() })
      .where(eq(clienti.id, params.id))
      .returning();
    reply.send(row);
  });

  app.post("/api/clienti/estrai-foto", async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_FOTO_BYTES } });
    if (!file) {
      reply.code(400).send({ error: "Nessuna immagine caricata" });
      return;
    }
    if (!file.mimetype.startsWith("image/")) {
      reply.code(400).send({ error: "Il file caricato deve essere un'immagine" });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      reply.code(413).send({ error: "Immagine troppo grande" });
      return;
    }

    try {
      const { cliente, warnings } = await estraiClienteDaFoto(env.ANTHROPIC_API_KEY, buffer);
      reply.send({ cliente, warnings });
    } catch (err) {
      request.log.error({ err }, "Estrazione cliente da foto fallita");
      reply.code(502).send({ error: "Estrazione dati non riuscita, inserisci i dati manualmente" });
    }
  });
}
