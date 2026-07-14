import { api, uploadFile } from "./api";

export interface Cliente {
  id: string;
  denominazione: string;
  partitaIva: string | null;
  codiceFiscale: string | null;
  codiceSdi: string | null;
  pec: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  nazione: string;
  email: string | null;
  telefono: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClienteInput = Omit<Cliente, "id" | "createdAt" | "updatedAt">;

export interface EstrattoCliente {
  denominazione: string | null;
  partitaIva: string | null;
  codiceFiscale: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  email: string | null;
  telefono: string | null;
  pec: string | null;
  codiceSdi: string | null;
}

export function listClienti(q?: string): Promise<Cliente[]> {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return api.get<Cliente[]>(`/api/clienti${query}`);
}

export function getCliente(id: string): Promise<Cliente> {
  return api.get<Cliente>(`/api/clienti/${id}`);
}

export function createCliente(input: Partial<ClienteInput>): Promise<Cliente> {
  return api.post<Cliente>("/api/clienti", input);
}

export function updateCliente(id: string, input: Partial<ClienteInput>): Promise<Cliente> {
  return api.put<Cliente>(`/api/clienti/${id}`, input);
}

export function estraiClienteDaFoto(
  file: File,
): Promise<{ cliente: EstrattoCliente; warnings: string[] }> {
  return uploadFile("/api/clienti/estrai-foto", file);
}
