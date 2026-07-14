/**
 * `prezzo_di_vendita` del legacy è sempre IVA inclusa: scorpora l'aliquota per
 * ottenere il prezzo unitario imponibile da proporre in riga (resta editabile).
 */
export function scorporaIva(prezzoDiVenditaCent: number, aliquotaIvaCent: number): number {
  return Math.round(prezzoDiVenditaCent / (1 + aliquotaIvaCent / 10000));
}
