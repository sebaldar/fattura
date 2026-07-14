import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadEnv } from "../config/env.js";
import { createDb } from "./client.js";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, client } = createDb(databaseUrl);
  await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  await client.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  runMigrations(env.DATABASE_URL)
    .then(() => {
      console.log("Migrazioni applicate.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Errore migrazioni:", err);
      process.exit(1);
    });
}
