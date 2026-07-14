import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { registerAuthInfra } from "./auth/plugin.js";
import type { Env } from "./config/env.js";
import type { Db } from "./db/client.js";
import { createAliquoteCache } from "./legacy/aliquote-cache.js";
import { createLegacyPool } from "./legacy/client.js";
import { loggerRedact } from "./lib/logger-redact.js";
import { authRoutes } from "./routes/auth.js";
import { clientiRoutes } from "./routes/clienti.js";
import { documentiRoutes } from "./routes/documenti.js";
import { emittenteRoutes } from "./routes/emittente.js";
import { legacyRoutes } from "./routes/legacy.js";

export async function buildApp(env: Env, db: Db) {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? {
            level: "debug",
            redact: loggerRedact,
            transport: {
              target: "pino-pretty",
              options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
            },
          }
        : {
            level: "info",
            redact: loggerRedact,
          },
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  await registerAuthInfra(app, env);
  await app.register(multipart);
  await app.register(authRoutes, { db, env });
  await app.register(clientiRoutes, { db, env });
  await app.register(documentiRoutes, { db, env });
  await app.register(emittenteRoutes, { db });

  const legacyPool = createLegacyPool(env);
  const aliquoteCache = createAliquoteCache();
  app.addHook("onClose", async () => {
    await legacyPool.end();
  });
  await app.register(legacyRoutes, { legacyPool, aliquoteCache });

  return app;
}
