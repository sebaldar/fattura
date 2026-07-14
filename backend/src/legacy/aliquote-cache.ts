import type { LegacyPool } from "./client.js";
import { elencoAliquote, type AliquotaLegacy } from "./queries.js";

const TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  data: AliquotaLegacy[];
  expiresAt: number;
}

/** Cache in memoria (TTL 1h) per l'elenco aliquote, per non interrogare il legacy ad ogni riga. */
export function createAliquoteCache() {
  let entry: CacheEntry | null = null;

  return {
    async get(pool: LegacyPool): Promise<AliquotaLegacy[]> {
      const now = Date.now();
      if (entry && entry.expiresAt > now) {
        return entry.data;
      }
      const data = await elencoAliquote(pool);
      entry = { data, expiresAt: now + TTL_MS };
      return data;
    },
    invalidate(): void {
      entry = null;
    },
  };
}

export type AliquoteCache = ReturnType<typeof createAliquoteCache>;
