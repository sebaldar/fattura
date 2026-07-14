import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import { emittente } from "../db/schema.js";
import { undefinedToNull, validateBody } from "../lib/validation.js";
import { aggiornaEmittenteSchema } from "../validation/emittente.js";

export interface EmittenteRoutesOptions {
  db: Db;
}

export async function emittenteRoutes(app: FastifyInstance, opts: EmittenteRoutesOptions): Promise<void> {
  const { db } = opts;

  app.get("/api/emittente", async (_request, reply) => {
    const [row] = await db.select().from(emittente).where(eq(emittente.id, 1)).limit(1);
    if (!row) {
      reply.code(404).send({ error: "Dati emittente non configurati" });
      return;
    }
    reply.send(row);
  });

  app.put("/api/emittente", async (request, reply) => {
    const body = validateBody(aggiornaEmittenteSchema, request.body, reply);
    if (!body) return;

    const [row] = await db
      .update(emittente)
      .set(undefinedToNull(body))
      .where(eq(emittente.id, 1))
      .returning();
    if (!row) {
      reply.code(404).send({ error: "Dati emittente non configurati" });
      return;
    }
    reply.send(row);
  });
}
