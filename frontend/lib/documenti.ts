import { api } from "./api";

export type TipoDocumento = "fattura" | "nota_credito";
export type StatoDocumento = "bozza" | "emessa" | "annullata";

export interface Riga {
  id: string;
  documentoId: string;
  posizione: number;
  codiceFornitore: string | null;
  codiceMerce: string | null;
  codiceEan: string | null;
  descrizione: string;
  codiceIva: string;
  aliquotaIvaCent: number;
  natura: string | null;
  quantita: string;
  prezzoUnitarioCent: number;
  totaleRigaCent: number;
}

export interface RiepilogoIva {
  aliquotaIvaCent: number;
  imponibileCent: number;
  ivaCent: number;
}

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  stato: StatoDocumento;
  anno: number;
  progressivo: number | null;
  numero: string | null;
  clienteId: string;
  clienteSnapshot: Record<string, unknown> | null;
  documentoRiferimentoId: string | null;
  dataDocumento: string;
  totaleImponibileCent: number;
  totaleIvaCent: number;
  totaleCent: number;
  createdAt: string;
  emessaAt: string | null;
  righe: Riga[];
  riepilogoIva: RiepilogoIva[];
}

export interface RigaInput {
  codiceFornitore?: string | null;
  codiceMerce?: string | null;
  codiceEan?: string | null;
  descrizione: string;
  codiceIva: string;
  aliquotaIvaCent: number;
  natura?: string | null;
  quantita: string;
  prezzoUnitarioCent: number;
}

export interface ListaDocumentiFiltri {
  anno?: number;
  tipo?: TipoDocumento;
  stato?: StatoDocumento;
  clienteId?: string;
}

export function listDocumenti(filtri: ListaDocumentiFiltri = {}): Promise<Documento[]> {
  const params = new URLSearchParams();
  if (filtri.anno) params.set("anno", String(filtri.anno));
  if (filtri.tipo) params.set("tipo", filtri.tipo);
  if (filtri.stato) params.set("stato", filtri.stato);
  if (filtri.clienteId) params.set("clienteId", filtri.clienteId);
  const query = params.toString();
  return api.get<Documento[]>(`/api/documenti${query ? `?${query}` : ""}`);
}

export function getDocumento(id: string): Promise<Documento> {
  return api.get<Documento>(`/api/documenti/${id}`);
}

export function createDocumento(input: { clienteId: string; dataDocumento: string }): Promise<Documento> {
  return api.post<Documento>("/api/documenti", input);
}

export function updateDocumento(
  id: string,
  input: { clienteId: string; dataDocumento: string },
): Promise<Documento> {
  return api.put<Documento>(`/api/documenti/${id}`, input);
}

export function deleteDocumento(id: string): Promise<void> {
  return api.delete(`/api/documenti/${id}`);
}

export function addRiga(documentoId: string, input: RigaInput): Promise<Documento> {
  return api.post<Documento>(`/api/documenti/${documentoId}/righe`, input);
}

export function updateRiga(documentoId: string, rigaId: string, input: RigaInput): Promise<Documento> {
  return api.put<Documento>(`/api/documenti/${documentoId}/righe/${rigaId}`, input);
}

export function deleteRiga(documentoId: string, rigaId: string): Promise<Documento> {
  return api.delete<Documento>(`/api/documenti/${documentoId}/righe/${rigaId}`);
}

export function emettiDocumento(id: string): Promise<Documento> {
  return api.post<Documento>(`/api/documenti/${id}/emetti`);
}

export function creaNotaCredito(fatturaId: string): Promise<Documento> {
  return api.post<Documento>(`/api/documenti/${fatturaId}/note-credito`);
}
