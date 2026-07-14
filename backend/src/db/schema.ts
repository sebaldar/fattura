import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const tipoDocumentoEnum = pgEnum("tipo_documento", ["fattura", "nota_credito"]);
export const statoDocumentoEnum = pgEnum("stato_documento", ["bozza", "emessa", "annullata"]);

export const emittente = pgTable(
  "emittente",
  {
    id: integer("id").primaryKey().default(1),
    ragioneSociale: varchar("ragione_sociale", { length: 200 }).notNull(),
    partitaIva: varchar("partita_iva", { length: 11 }).notNull(),
    codiceFiscale: varchar("codice_fiscale", { length: 16 }).notNull(),
    indirizzo: varchar("indirizzo", { length: 200 }).notNull(),
    cap: varchar("cap", { length: 5 }).notNull(),
    comune: varchar("comune", { length: 100 }).notNull(),
    provincia: varchar("provincia", { length: 2 }).notNull(),
    nazione: varchar("nazione", { length: 2 }).notNull().default("IT"),
    regimeFiscale: varchar("regime_fiscale", { length: 4 }).notNull(),
    iban: varchar("iban", { length: 34 }).notNull(),
    email: text("email").notNull(),
    telefono: varchar("telefono", { length: 30 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("emittente_singleton", sql`${table.id} = 1`)],
);

export const utenti = pgTable("utenti", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  currentRefreshJti: text("current_refresh_jti"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clienti = pgTable("clienti", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  denominazione: varchar("denominazione", { length: 200 }).notNull(),
  partitaIva: varchar("partita_iva", { length: 11 }),
  codiceFiscale: varchar("codice_fiscale", { length: 16 }),
  codiceSdi: varchar("codice_sdi", { length: 7 }),
  pec: text("pec"),
  indirizzo: varchar("indirizzo", { length: 200 }),
  cap: varchar("cap", { length: 5 }),
  comune: varchar("comune", { length: 100 }),
  provincia: varchar("provincia", { length: 2 }),
  nazione: varchar("nazione", { length: 2 }).notNull().default("IT"),
  email: text("email"),
  telefono: varchar("telefono", { length: 30 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documenti = pgTable(
  "documenti",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tipo: tipoDocumentoEnum("tipo").notNull(),
    stato: statoDocumentoEnum("stato").notNull().default("bozza"),
    anno: smallint("anno").notNull(),
    progressivo: integer("progressivo"),
    numero: varchar("numero", { length: 20 }),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clienti.id),
    clienteSnapshot: jsonb("cliente_snapshot"),
    documentoRiferimentoId: uuid("documento_riferimento_id").references(
      (): AnyPgColumn => documenti.id,
    ),
    dataDocumento: date("data_documento").notNull(),
    totaleImponibileCent: integer("totale_imponibile_cent").notNull().default(0),
    totaleIvaCent: integer("totale_iva_cent").notNull().default(0),
    totaleCent: integer("totale_cent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    emessaAt: timestamp("emessa_at", { withTimezone: true }),
  },
  (table) => [
    unique("documenti_tipo_anno_progressivo_key").on(table.tipo, table.anno, table.progressivo),
    check(
      "documenti_numero_coerente_con_stato",
      sql`(${table.numero} is not null) = (${table.stato} <> 'bozza')`,
    ),
    check(
      "documenti_nc_richiede_riferimento",
      sql`${table.tipo} <> 'nota_credito' or ${table.documentoRiferimentoId} is not null`,
    ),
  ],
);

export const righeDocumento = pgTable(
  "righe_documento",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documenti.id),
    posizione: integer("posizione").notNull(),
    codiceFornitore: varchar("codice_fornitore", { length: 6 }),
    codiceMerce: varchar("codice_merce", { length: 15 }),
    codiceEan: varchar("codice_ean", { length: 15 }),
    descrizione: varchar("descrizione", { length: 200 }).notNull(),
    codiceIva: char("codice_iva", { length: 5 }).notNull(),
    aliquotaIvaCent: integer("aliquota_iva_cent").notNull(),
    natura: char("natura", { length: 3 }),
    quantita: numeric("quantita", { precision: 10, scale: 2 }).notNull(),
    prezzoUnitarioCent: integer("prezzo_unitario_cent").notNull(),
    totaleRigaCent: integer("totale_riga_cent").notNull(),
  },
  (table) => [check("righe_documento_quantita_positiva", sql`${table.quantita} > 0`)],
);

export const contatori = pgTable(
  "contatori",
  {
    tipo: tipoDocumentoEnum("tipo").notNull(),
    anno: smallint("anno").notNull(),
    ultimoProgressivo: integer("ultimo_progressivo").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.tipo, table.anno] })],
);
