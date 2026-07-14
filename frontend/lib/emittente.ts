import { api } from "./api";

export interface Emittente {
  id: number;
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  regimeFiscale: string;
  iban: string;
  email: string;
  telefono: string | null;
  updatedAt: string;
}

export type EmittenteInput = Omit<Emittente, "id" | "updatedAt">;

export function getEmittente(): Promise<Emittente> {
  return api.get<Emittente>("/api/emittente");
}

export function updateEmittente(input: EmittenteInput): Promise<Emittente> {
  return api.put<Emittente>("/api/emittente", input);
}
