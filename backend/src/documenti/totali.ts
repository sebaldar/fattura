export interface RigaPerTotali {
  aliquotaIvaCent: number;
  totaleRigaCent: number;
}

export interface RiepilogoIva {
  aliquotaIvaCent: number;
  imponibileCent: number;
  ivaCent: number;
}

export interface Totali {
  totaleImponibileCent: number;
  totaleIvaCent: number;
  totaleCent: number;
  riepilogoIva: RiepilogoIva[];
}

/** Totale riga = round(quantità × prezzo unitario). */
export function calcolaTotaleRiga(quantita: number, prezzoUnitarioCent: number): number {
  return Math.round(quantita * prezzoUnitarioCent);
}

/**
 * IVA calcolata per raggruppamento di aliquota sull'imponibile aggregato
 * (non riga per riga), arrotondamento half-up al centesimo.
 */
export function calcolaTotali(righe: RigaPerTotali[]): Totali {
  const imponibilePerAliquota = new Map<number, number>();
  for (const riga of righe) {
    imponibilePerAliquota.set(
      riga.aliquotaIvaCent,
      (imponibilePerAliquota.get(riga.aliquotaIvaCent) ?? 0) + riga.totaleRigaCent,
    );
  }

  const riepilogoIva: RiepilogoIva[] = [];
  let totaleImponibileCent = 0;
  let totaleIvaCent = 0;

  const aliquoteOrdinate = [...imponibilePerAliquota.entries()].sort((a, b) => a[0] - b[0]);
  for (const [aliquotaIvaCent, imponibileCent] of aliquoteOrdinate) {
    const ivaCent = Math.round((imponibileCent * aliquotaIvaCent) / 10000);
    riepilogoIva.push({ aliquotaIvaCent, imponibileCent, ivaCent });
    totaleImponibileCent += imponibileCent;
    totaleIvaCent += ivaCent;
  }

  return {
    totaleImponibileCent,
    totaleIvaCent,
    totaleCent: totaleImponibileCent + totaleIvaCent,
    riepilogoIva,
  };
}
