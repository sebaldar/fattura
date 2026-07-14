import type { RowDataPacket } from "mysql2/promise";
import { LEGACY_QUERY_TIMEOUT_MS, type LegacyPool } from "./client.js";

export type Operazione = "imponibile" | "non imponibile" | "esente";

export interface MerceLegacy {
  codiceFornitore: string;
  codiceMerce: string;
  descrizione: string;
  /** Centesimi, IVA inclusa. */
  prezzoDiVendita: number;
  codiceIva: string;
  aliquotaIvaCent: number;
  operazione: Operazione;
  natura: string | null;
}

interface MerceRow extends RowDataPacket {
  codice_fornitore: string;
  codice_merce: string;
  descrizione: string;
  prezzo_di_vendita: number;
  codice_IVA: string;
  aliquota_iva: number;
  operazione: Operazione;
  natura: string | null;
}

function mapMerce(row: MerceRow): MerceLegacy {
  return {
    codiceFornitore: row.codice_fornitore,
    codiceMerce: row.codice_merce,
    descrizione: row.descrizione,
    prezzoDiVendita: row.prezzo_di_vendita,
    codiceIva: row.codice_IVA,
    aliquotaIvaCent: row.aliquota_iva,
    operazione: row.operazione,
    natura: row.natura,
  };
}

const SELECT_MERCE = `
  SELECT m.codice_fornitore, m.codice_merce, m.descrizione, m.prezzo_di_vendita,
         m.codice_IVA, a.aliquota_iva, a.operazione, a.natura
  FROM merci m
  JOIN aliquotaiva a ON a.codice = m.codice_IVA
`;

export async function cercaMerceByEan(pool: LegacyPool, ean: string): Promise<MerceLegacy | null> {
  const [rows] = await pool.query<MerceRow[]>(
    { sql: `${SELECT_MERCE} WHERE m.codice_EAN = ? LIMIT 1`, timeout: LEGACY_QUERY_TIMEOUT_MS },
    [ean],
  );
  return rows[0] ? mapMerce(rows[0]) : null;
}

export async function cercaMerceByTesto(pool: LegacyPool, testo: string): Promise<MerceLegacy[]> {
  const like = `%${testo}%`;
  const [rows] = await pool.query<MerceRow[]>(
    {
      sql: `${SELECT_MERCE} WHERE m.codice_fornitore LIKE ? OR m.codice_merce LIKE ? OR m.descrizione LIKE ? LIMIT 20`,
      timeout: LEGACY_QUERY_TIMEOUT_MS,
    },
    [like, like, like],
  );
  return rows.map(mapMerce);
}

export interface AliquotaLegacy {
  codice: string;
  aliquotaIvaCent: number;
  descrizione: string;
  operazione: Operazione;
  natura: string | null;
}

interface AliquotaRow extends RowDataPacket {
  codice: string;
  aliquota_iva: number;
  descrizione: string;
  operazione: Operazione;
  natura: string | null;
}

export async function elencoAliquote(pool: LegacyPool): Promise<AliquotaLegacy[]> {
  const [rows] = await pool.query<AliquotaRow[]>({
    sql: `SELECT codice, aliquota_iva, descrizione, operazione, natura FROM aliquotaiva`,
    timeout: LEGACY_QUERY_TIMEOUT_MS,
  });
  return rows.map((r) => ({
    codice: r.codice,
    aliquotaIvaCent: r.aliquota_iva,
    descrizione: r.descrizione,
    operazione: r.operazione,
    natura: r.natura,
  }));
}
