import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { documenti, righeDocumento } from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";
import type { RigaInput } from "../validation/documenti.js";
import { calcolaTotaleRiga, calcolaTotali } from "./totali.js";

/** Sottoinsieme di `Db` sufficiente per operare sia fuori che dentro una transazione. */
export type Executor = Pick<Db, "select" | "insert" | "update" | "delete">;

export async function caricaBozza(exec: Executor, documentoId: string) {
  const [documento] = await exec.select().from(documenti).where(eq(documenti.id, documentoId)).limit(1);
  if (!documento) {
    throw new HttpError(404, "Documento non trovato");
  }
  if (documento.stato !== "bozza") {
    throw new HttpError(409, "Operazione consentita solo sulle bozze");
  }
  return documento;
}

export async function caricaDocumentoConRighe(exec: Executor, documentoId: string) {
  const [documento] = await exec.select().from(documenti).where(eq(documenti.id, documentoId)).limit(1);
  if (!documento) {
    return null;
  }
  const righe = await exec
    .select()
    .from(righeDocumento)
    .where(eq(righeDocumento.documentoId, documentoId))
    .orderBy(righeDocumento.posizione);
  const { riepilogoIva } = calcolaTotali(righe);
  return { ...documento, righe, riepilogoIva };
}

export async function prossimaPosizione(exec: Executor, documentoId: string): Promise<number> {
  const [ultima] = await exec
    .select({ posizione: righeDocumento.posizione })
    .from(righeDocumento)
    .where(eq(righeDocumento.documentoId, documentoId))
    .orderBy(desc(righeDocumento.posizione))
    .limit(1);
  return (ultima?.posizione ?? 0) + 1;
}

export async function ricalcolaEPersistiTotali(exec: Executor, documentoId: string): Promise<void> {
  const righe = await exec.select().from(righeDocumento).where(eq(righeDocumento.documentoId, documentoId));
  const totali = calcolaTotali(righe);
  await exec
    .update(documenti)
    .set({
      totaleImponibileCent: totali.totaleImponibileCent,
      totaleIvaCent: totali.totaleIvaCent,
      totaleCent: totali.totaleCent,
    })
    .where(eq(documenti.id, documentoId));
}

/** Campi mutabili di una riga (esclusi documentoId/posizione, non modificabili in update). */
export function campiRiga(input: RigaInput) {
  return {
    codiceFornitore: input.codiceFornitore ?? null,
    codiceMerce: input.codiceMerce ?? null,
    codiceEan: input.codiceEan ?? null,
    descrizione: input.descrizione,
    codiceIva: input.codiceIva,
    aliquotaIvaCent: input.aliquotaIvaCent,
    natura: input.natura ?? null,
    quantita: input.quantita.toFixed(2),
    prezzoUnitarioCent: input.prezzoUnitarioCent,
    totaleRigaCent: calcolaTotaleRiga(input.quantita, input.prezzoUnitarioCent),
  };
}

export function valoriRiga(input: RigaInput, documentoId: string, posizione: number) {
  return { documentoId, posizione, ...campiRiga(input) };
}

export async function trovaRiga(exec: Executor, documentoId: string, rigaId: string) {
  const [riga] = await exec
    .select()
    .from(righeDocumento)
    .where(and(eq(righeDocumento.id, rigaId), eq(righeDocumento.documentoId, documentoId)))
    .limit(1);
  if (!riga) {
    throw new HttpError(404, "Riga non trovata");
  }
  return riga;
}
