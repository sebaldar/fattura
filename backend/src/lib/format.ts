const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatEuroCent(cent: number): string {
  return euroFormatter.format(cent / 100);
}

export function formatDataIt(iso: string): string {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}
