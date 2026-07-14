const formatterEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatCent(cent: number): string {
  return formatterEuro.format(cent / 100);
}
