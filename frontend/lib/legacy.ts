import { api } from "./api";

export interface MerceLegacy {
  codiceFornitore: string;
  codiceMerce: string;
  descrizione: string;
  prezzoDiVendita: number;
  codiceIva: string;
  aliquotaIvaCent: number;
  operazione: "imponibile" | "non imponibile" | "esente";
  natura: string | null;
  codiceEan: string | null;
  prezzoUnitarioCent: number;
}

export interface AliquotaLegacy {
  codice: string;
  aliquotaIvaCent: number;
  descrizione: string;
  operazione: "imponibile" | "non imponibile" | "esente";
  natura: string | null;
}

export function cercaMerceByEan(ean: string): Promise<MerceLegacy> {
  return api.get<MerceLegacy>(`/api/legacy/merci?ean=${encodeURIComponent(ean)}`);
}

export function cercaMerceByFornitoreMerce(fornitore: string, merce: string): Promise<MerceLegacy> {
  return api.get<MerceLegacy>(
    `/api/legacy/merci?fornitore=${encodeURIComponent(fornitore)}&merce=${encodeURIComponent(merce)}`,
  );
}

export function cercaMerceByTesto(q: string): Promise<MerceLegacy[]> {
  return api.get<MerceLegacy[]>(`/api/legacy/merci?q=${encodeURIComponent(q)}`);
}

export function listaAliquote(): Promise<AliquotaLegacy[]> {
  return api.get<AliquotaLegacy[]>("/api/legacy/aliquote");
}
