import { hashPassword } from "../auth/password.js";
import { loadEnv } from "../config/env.js";
import { createDb } from "./client.js";
import { emittente, utenti } from "./schema.js";

async function seed(): Promise<void> {
  const env = loadEnv();
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD sono richieste per il seed dell'utente admin.");
  }

  const { db, client } = createDb(env.DATABASE_URL);

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  await db
    .insert(utenti)
    .values({
      email: env.ADMIN_EMAIL,
      passwordHash,
    })
    .onConflictDoNothing({ target: utenti.email });

  await db
    .insert(emittente)
    .values({
      id: 1,
      ragioneSociale: "Emittente di esempio S.r.l.",
      partitaIva: "00000000000",
      codiceFiscale: "00000000000",
      indirizzo: "Via di Esempio 1",
      cap: "00100",
      comune: "Roma",
      provincia: "RM",
      nazione: "IT",
      regimeFiscale: "RF01",
      iban: "IT00X0000000000000000000000",
      email: env.ADMIN_EMAIL,
    })
    .onConflictDoNothing({ target: emittente.id });

  await client.end();
  console.log("Seed completato.");
}

seed().catch((err) => {
  console.error("Errore seed:", err);
  process.exit(1);
});
