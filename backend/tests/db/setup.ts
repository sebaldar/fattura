import { loadEnv } from "../../src/config/env.js";
import { createDb } from "../../src/db/client.js";

const env = loadEnv();
export const { db, client } = createDb(env.DATABASE_URL);

export async function resetTables(): Promise<void> {
  await client`TRUNCATE TABLE righe_documento, documenti, clienti, contatori RESTART IDENTITY CASCADE`;
}
