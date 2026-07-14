import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";

const env = loadEnv();

await runMigrations(env.DATABASE_URL);

const { db } = createDb(env.DATABASE_URL);
const app = await buildApp(env, db);

app.listen({ host: "0.0.0.0", port: env.PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
