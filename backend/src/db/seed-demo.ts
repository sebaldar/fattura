import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password.js";
import { loadEnv } from "../config/env.js";
import { emettiDocumento } from "../documenti/emissione.js";
import { calcolaTotaleRiga } from "../documenti/totali.js";
import { createDb } from "./client.js";
import { clienti, documenti, emittente, righeDocumento, utenti } from "./schema.js";

interface RigaDemo {
  descrizione: string;
  codiceIva: string;
  aliquotaIvaCent: number;
  natura?: string;
  quantita: string;
  prezzoUnitarioCent: number;
}

async function seed(): Promise<void> {
  const env = loadEnv();
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD sono richieste per il seed dell'utente admin demo.");
  }

  const { db, client } = createDb(env.DATABASE_URL);

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await db
    .insert(utenti)
    .values({ email: env.ADMIN_EMAIL, passwordHash })
    .onConflictDoNothing({ target: utenti.email });

  await db
    .insert(emittente)
    .values({
      id: 1,
      ragioneSociale: "MondoBimbi Demo S.r.l.",
      partitaIva: "01234567890",
      codiceFiscale: "01234567890",
      indirizzo: "Via della Demo 10",
      cap: "00100",
      comune: "Roma",
      provincia: "RM",
      nazione: "IT",
      regimeFiscale: "RF01",
      iban: "IT60X0542811101000000123456",
      email: "demo@mondobimbi.it",
      telefono: "0612345678",
    })
    .onConflictDoNothing({ target: emittente.id });

  const clientiDemo = [
    {
      denominazione: "Giulia Ferrari",
      partitaIva: null,
      codiceFiscale: "FRRGLI85M41H501Z",
      indirizzo: "Via Milano 12",
      cap: "20100",
      comune: "Milano",
      provincia: "MI",
      nazione: "IT",
      email: "giulia.ferrari@example.com",
    },
    {
      denominazione: "Bimbi Felici S.n.c.",
      partitaIva: "09876543210",
      codiceFiscale: "09876543210",
      indirizzo: "Corso Napoli 45",
      cap: "80100",
      comune: "Napoli",
      provincia: "NA",
      nazione: "IT",
      email: "amministrazione@bimbifelici-demo.it",
      codiceSdi: "SUBM70N",
    },
    {
      denominazione: "Marco Bianchi",
      partitaIva: null,
      codiceFiscale: "BNCMRC90A01F205X",
      indirizzo: "Via Torino 3",
      cap: "10100",
      comune: "Torino",
      provincia: "TO",
      nazione: "IT",
      email: "marco.bianchi@example.com",
    },
  ];

  const clienteIds: string[] = [];
  for (const c of clientiDemo) {
    const esistente = await db.select().from(clienti).where(eq(clienti.denominazione, c.denominazione));
    if (esistente.length > 0) {
      clienteIds.push(esistente[0]!.id);
      continue;
    }
    const [inserito] = await db.insert(clienti).values(c).returning();
    clienteIds.push(inserito!.id);
  }

  async function creaEdEmetti(clienteId: string, dataDocumento: string, righe: RigaDemo[]): Promise<void> {
    const anno = Number(dataDocumento.slice(0, 4));
    const [doc] = await db
      .insert(documenti)
      .values({ tipo: "fattura", stato: "bozza", anno, clienteId, dataDocumento })
      .returning();

    await db.insert(righeDocumento).values(
      righe.map((r, indice) => ({
        documentoId: doc!.id,
        posizione: indice + 1,
        descrizione: r.descrizione,
        codiceIva: r.codiceIva,
        aliquotaIvaCent: r.aliquotaIvaCent,
        natura: r.natura ?? null,
        quantita: r.quantita,
        prezzoUnitarioCent: r.prezzoUnitarioCent,
        totaleRigaCent: calcolaTotaleRiga(Number(r.quantita), r.prezzoUnitarioCent),
      })),
    );

    await emettiDocumento(db, doc!.id);
  }

  const [primaFatturaEsistente] = await db.select().from(documenti).limit(1);
  if (!primaFatturaEsistente) {
    await creaEdEmetti(clienteIds[0]!, "2026-01-15", [
      { descrizione: "Passeggino trio 3 in 1", codiceIva: "22000", aliquotaIvaCent: 2200, quantita: "1", prezzoUnitarioCent: 34900 },
      { descrizione: "Seggiolino auto gruppo 0+", codiceIva: "22000", aliquotaIvaCent: 2200, quantita: "1", prezzoUnitarioCent: 12900 },
    ]);

    await creaEdEmetti(clienteIds[1]!, "2026-02-03", [
      { descrizione: "Body neonato cotone bio (3 pezzi)", codiceIva: "10000", aliquotaIvaCent: 1000, quantita: "5", prezzoUnitarioCent: 1990 },
      { descrizione: "Pannolini taglia 3 (176 pz)", codiceIva: "04000", aliquotaIvaCent: 400, quantita: "3", prezzoUnitarioCent: 2290 },
      { descrizione: "Buono sconto promozionale", codiceIva: "N2", aliquotaIvaCent: 0, natura: "N2", quantita: "1", prezzoUnitarioCent: 500 },
    ]);

    // Una bozza lasciata aperta, per mostrare il flusso di modifica/emissione.
    const anno = 2026;
    const [bozza] = await db
      .insert(documenti)
      .values({ tipo: "fattura", stato: "bozza", anno, clienteId: clienteIds[2]!, dataDocumento: "2026-03-01" })
      .returning();
    await db.insert(righeDocumento).values([
      {
        documentoId: bozza!.id,
        posizione: 1,
        descrizione: "Giostrina musicale per lettino",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        natura: null,
        quantita: "1",
        prezzoUnitarioCent: 3990,
        totaleRigaCent: calcolaTotaleRiga(1, 3990),
      },
    ]);
  }

  await client.end();
  console.log("Seed demo completato.");
}

seed().catch((err) => {
  console.error("Errore seed demo:", err);
  process.exit(1);
});
