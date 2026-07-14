import mysql from "mysql2/promise";
import type { Env } from "../config/env.js";

export const LEGACY_QUERY_TIMEOUT_MS = 3000;

/** Pool dedicato al MariaDB legacy (sola lettura): mai scritture, mai DDL. */
export function createLegacyPool(env: Env) {
  return mysql.createPool({
    host: env.LEGACY_DB_HOST,
    port: env.LEGACY_DB_PORT,
    user: env.LEGACY_DB_USER,
    password: env.LEGACY_DB_PASSWORD,
    database: env.LEGACY_DB_DATABASE,
    connectTimeout: LEGACY_QUERY_TIMEOUT_MS,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

export type LegacyPool = ReturnType<typeof createLegacyPool>;
