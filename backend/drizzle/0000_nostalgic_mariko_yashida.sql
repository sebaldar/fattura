CREATE TYPE "public"."stato_documento" AS ENUM('bozza', 'emessa', 'annullata');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('fattura', 'nota_credito');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clienti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"denominazione" varchar(200) NOT NULL,
	"partita_iva" varchar(11),
	"codice_fiscale" varchar(16),
	"codice_sdi" varchar(7),
	"pec" text,
	"indirizzo" varchar(200),
	"cap" varchar(5),
	"comune" varchar(100),
	"provincia" varchar(2),
	"nazione" varchar(2) DEFAULT 'IT' NOT NULL,
	"email" text,
	"telefono" varchar(30),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contatori" (
	"tipo" "tipo_documento" NOT NULL,
	"anno" smallint NOT NULL,
	"ultimo_progressivo" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contatori_tipo_anno_pk" PRIMARY KEY("tipo","anno")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"stato" "stato_documento" DEFAULT 'bozza' NOT NULL,
	"anno" smallint NOT NULL,
	"progressivo" integer,
	"numero" varchar(20),
	"cliente_id" uuid NOT NULL,
	"cliente_snapshot" jsonb,
	"documento_riferimento_id" uuid,
	"data_documento" date NOT NULL,
	"totale_imponibile_cent" integer DEFAULT 0 NOT NULL,
	"totale_iva_cent" integer DEFAULT 0 NOT NULL,
	"totale_cent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emessa_at" timestamp with time zone,
	CONSTRAINT "documenti_tipo_anno_progressivo_key" UNIQUE("tipo","anno","progressivo"),
	CONSTRAINT "documenti_numero_coerente_con_stato" CHECK (("documenti"."numero" is not null) = ("documenti"."stato" <> 'bozza')),
	CONSTRAINT "documenti_nc_richiede_riferimento" CHECK ("documenti"."tipo" <> 'nota_credito' or "documenti"."documento_riferimento_id" is not null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emittente" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ragione_sociale" varchar(200) NOT NULL,
	"partita_iva" varchar(11) NOT NULL,
	"codice_fiscale" varchar(16) NOT NULL,
	"indirizzo" varchar(200) NOT NULL,
	"cap" varchar(5) NOT NULL,
	"comune" varchar(100) NOT NULL,
	"provincia" varchar(2) NOT NULL,
	"nazione" varchar(2) DEFAULT 'IT' NOT NULL,
	"regime_fiscale" varchar(4) NOT NULL,
	"iban" varchar(34) NOT NULL,
	"email" text NOT NULL,
	"telefono" varchar(30),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emittente_singleton" CHECK ("emittente"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "righe_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"posizione" integer NOT NULL,
	"codice_fornitore" varchar(6),
	"codice_merce" varchar(15),
	"codice_ean" varchar(15),
	"descrizione" varchar(200) NOT NULL,
	"codice_iva" char(5) NOT NULL,
	"aliquota_iva_cent" integer NOT NULL,
	"natura" char(3),
	"quantita" numeric(10, 2) NOT NULL,
	"prezzo_unitario_cent" integer NOT NULL,
	"totale_riga_cent" integer NOT NULL,
	CONSTRAINT "righe_documento_quantita_positiva" CHECK ("righe_documento"."quantita" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "utenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utenti_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documenti" ADD CONSTRAINT "documenti_cliente_id_clienti_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clienti"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documenti" ADD CONSTRAINT "documenti_documento_riferimento_id_documenti_id_fk" FOREIGN KEY ("documento_riferimento_id") REFERENCES "public"."documenti"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "righe_documento" ADD CONSTRAINT "righe_documento_documento_id_documenti_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documenti"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
