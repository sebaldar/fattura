import type { documenti } from "../db/schema.js";

type TipoDocumento = (typeof documenti.$inferSelect)["tipo"];

/** `IT-F-<YY><NNNN>` per fatture, `IT-NC-<YY><NNNN>` per note di credito. */
export function comporreNumero(tipo: TipoDocumento, anno: number, progressivo: number): string {
  const prefisso = tipo === "fattura" ? "IT-F-" : "IT-NC-";
  const yy = String(anno % 100).padStart(2, "0");
  const nnnn = String(progressivo).padStart(4, "0");
  return `${prefisso}${yy}${nnnn}`;
}
