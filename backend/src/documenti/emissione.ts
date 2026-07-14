import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { clienti, contatori, documenti, righeDocumento } from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";
import { comporreNumero } from "./numerazione.js";
import { calcolaTotali } from "./totali.js";

/**
 * Emette una bozza: assegna il progressivo in transazione con lock su
 * `contatori` (bozza→emessa, mai burned per le bozze), compone il numero,
 * congela lo snapshot cliente e i totali definitivi. Tutto nella stessa
 * transazione, come da specifica.
 */
export async function emettiDocumento(db: Db, documentoId: string) {
  return db.transaction(async (tx) => {
    const [documento] = await tx
      .select()
      .from(documenti)
      .where(eq(documenti.id, documentoId))
      .for("update");
    if (!documento) {
      throw new HttpError(404, "Documento non trovato");
    }
    if (documento.stato !== "bozza") {
      throw new HttpError(409, "Il documento non è in stato bozza");
    }

    const righe = await tx
      .select()
      .from(righeDocumento)
      .where(eq(righeDocumento.documentoId, documentoId))
      .orderBy(righeDocumento.posizione);
    if (righe.length === 0) {
      throw new HttpError(400, "Il documento non ha righe: impossibile emettere");
    }

    const [cliente] = await tx.select().from(clienti).where(eq(clienti.id, documento.clienteId)).limit(1);
    if (!cliente) {
      throw new HttpError(400, "Cliente non trovato");
    }

    const totali = calcolaTotali(righe);

    await tx
      .insert(contatori)
      .values({ tipo: documento.tipo, anno: documento.anno, ultimoProgressivo: 0 })
      .onConflictDoNothing({ target: [contatori.tipo, contatori.anno] });

    const [contatore] = await tx
      .select()
      .from(contatori)
      .where(and(eq(contatori.tipo, documento.tipo), eq(contatori.anno, documento.anno)))
      .for("update");

    const nuovoProgressivo = contatore!.ultimoProgressivo + 1;

    await tx
      .update(contatori)
      .set({ ultimoProgressivo: nuovoProgressivo })
      .where(and(eq(contatori.tipo, documento.tipo), eq(contatori.anno, documento.anno)));

    const numero = comporreNumero(documento.tipo, documento.anno, nuovoProgressivo);

    const [aggiornato] = await tx
      .update(documenti)
      .set({
        stato: "emessa",
        progressivo: nuovoProgressivo,
        numero,
        clienteSnapshot: cliente,
        totaleImponibileCent: totali.totaleImponibileCent,
        totaleIvaCent: totali.totaleIvaCent,
        totaleCent: totali.totaleCent,
        emessaAt: new Date(),
      })
      .where(eq(documenti.id, documentoId))
      .returning();

    return aggiornato!;
  });
}
