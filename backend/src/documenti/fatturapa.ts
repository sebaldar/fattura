import { create } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces.js";
import type { clienti, emittente, righeDocumento } from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";

const NAMESPACE = "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";
const FORMATO_TRASMISSIONE = "FPR12";

type ClienteSnapshot = typeof clienti.$inferSelect;
type EmittenteRow = typeof emittente.$inferSelect;
type RigaRow = typeof righeDocumento.$inferSelect;

export interface DocumentoPerXml {
  tipo: "fattura" | "nota_credito";
  anno: number;
  progressivo: number;
  numero: string;
  dataDocumento: string;
  clienteSnapshot: ClienteSnapshot;
  righe: RigaRow[];
  totaleCent: number;
}

export interface DocumentoRiferimentoPerXml {
  numero: string;
  dataDocumento: string;
}

function euro2(cent: number): string {
  return (cent / 100).toFixed(2);
}

function codiceDestinatario(cliente: ClienteSnapshot): { codice: string; pec: string | null } {
  if (cliente.nazione !== "IT") {
    return { codice: "XXXXXXX", pec: null };
  }
  if (cliente.codiceSdi?.trim()) {
    return { codice: cliente.codiceSdi.trim(), pec: null };
  }
  if (cliente.pec?.trim()) {
    return { codice: "0000000", pec: cliente.pec.trim() };
  }
  return { codice: "0000000", pec: null };
}

/** 5 caratteri alfanumerici univoci per anno+tipo+progressivo (limite pratico: 1296 documenti/anno/tipo). */
function progressivoFile(tipo: DocumentoPerXml["tipo"], anno: number, progressivo: number): string {
  const lettera = tipo === "fattura" ? "F" : "N";
  const annoYY = String(anno % 100).padStart(2, "0");
  const progressivoBase36 = progressivo.toString(36).toUpperCase().padStart(2, "0");
  if (progressivoBase36.length > 2) {
    throw new HttpError(500, "Progressivo troppo alto per la convenzione di nome file SdI");
  }
  return `${lettera}${annoYY}${progressivoBase36}`;
}

export function nomeFileXml(
  documento: Pick<DocumentoPerXml, "tipo" | "anno" | "progressivo">,
  partitaIvaEmittente: string,
): string {
  return `IT${partitaIvaEmittente}_${progressivoFile(documento.tipo, documento.anno, documento.progressivo)}.xml`;
}

interface GruppoRiepilogo {
  aliquotaIvaCent: number;
  natura: string | null;
  imponibileCent: number;
  ivaCent: number;
}

/** Raggruppa per aliquota+natura (non solo aliquota): richiesto perché Natura è un dato differenziante ai fini SdI. */
function raggruppaPerAliquotaNatura(righe: RigaRow[]): GruppoRiepilogo[] {
  const gruppi = new Map<string, { aliquotaIvaCent: number; natura: string | null; imponibileCent: number }>();
  for (const riga of righe) {
    if (riga.aliquotaIvaCent === 0 && !riga.natura) {
      throw new HttpError(
        422,
        `Riga "${riga.descrizione}" con aliquota 0% priva di natura: impossibile generare l'XML FatturaPA`,
      );
    }
    const natura = riga.natura?.trim() || null;
    const chiave = `${riga.aliquotaIvaCent}|${natura ?? ""}`;
    const esistente = gruppi.get(chiave);
    if (esistente) {
      esistente.imponibileCent += riga.totaleRigaCent;
    } else {
      gruppi.set(chiave, { aliquotaIvaCent: riga.aliquotaIvaCent, natura, imponibileCent: riga.totaleRigaCent });
    }
  }
  return [...gruppi.values()]
    .map((g) => ({ ...g, ivaCent: Math.round((g.imponibileCent * g.aliquotaIvaCent) / 10000) }))
    .sort((a, b) => a.aliquotaIvaCent - b.aliquotaIvaCent);
}

function indirizzoEle(builder: XMLBuilder, entita: {
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  nazione: string;
}): void {
  builder.ele("Indirizzo").txt(entita.indirizzo?.trim() || "N/D").up();
  builder.ele("CAP").txt(entita.cap?.trim() || "00000").up();
  builder.ele("Comune").txt(entita.comune?.trim() || "N/D").up();
  if (entita.provincia && /^[A-Z]{2}$/.test(entita.provincia.trim())) {
    builder.ele("Provincia").txt(entita.provincia.trim()).up();
  }
  builder.ele("Nazione").txt(entita.nazione || "IT").up();
}

export function generaXmlFatturaPa(
  documento: DocumentoPerXml,
  em: EmittenteRow,
  riferimento: DocumentoRiferimentoPerXml | null,
): string {
  const cliente = documento.clienteSnapshot;
  const dest = codiceDestinatario(cliente);
  const gruppiRiepilogo = raggruppaPerAliquotaNatura(documento.righe);

  // Prefisso esplicito (non namespace di default): lo XSD FatturaPA non dichiara elementFormDefault="qualified",
  // quindi gli elementi figli devono restare privi di namespace, non ereditare quello della radice.
  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("p:FatturaElettronica", {
    "xmlns:p": NAMESPACE,
    versione: FORMATO_TRASMISSIONE,
  });

  // --- Header ---
  const header = doc.ele("FatturaElettronicaHeader");

  const datiTrasmissione = header.ele("DatiTrasmissione");
  const idTrasmittente = datiTrasmissione.ele("IdTrasmittente");
  idTrasmittente.ele("IdPaese").txt(em.nazione).up();
  idTrasmittente.ele("IdCodice").txt(em.partitaIva).up();
  idTrasmittente.up();
  datiTrasmissione
    .ele("ProgressivoInvio")
    .txt(`${documento.anno}${String(documento.progressivo).padStart(4, "0")}`)
    .up();
  datiTrasmissione.ele("FormatoTrasmissione").txt(FORMATO_TRASMISSIONE).up();
  datiTrasmissione.ele("CodiceDestinatario").txt(dest.codice).up();
  if (dest.pec) {
    datiTrasmissione.ele("PECDestinatario").txt(dest.pec).up();
  }
  datiTrasmissione.up();

  const cedente = header.ele("CedentePrestatore");
  const datiAnagraficiCedente = cedente.ele("DatiAnagrafici");
  const idFiscaleCedente = datiAnagraficiCedente.ele("IdFiscaleIVA");
  idFiscaleCedente.ele("IdPaese").txt(em.nazione).up();
  idFiscaleCedente.ele("IdCodice").txt(em.partitaIva).up();
  idFiscaleCedente.up();
  datiAnagraficiCedente.ele("CodiceFiscale").txt(em.codiceFiscale).up();
  datiAnagraficiCedente.ele("Anagrafica").ele("Denominazione").txt(em.ragioneSociale).up().up();
  datiAnagraficiCedente.ele("RegimeFiscale").txt(em.regimeFiscale).up();
  datiAnagraficiCedente.up();
  const sedeCedente = cedente.ele("Sede");
  indirizzoEle(sedeCedente, em);
  sedeCedente.up();
  if (em.telefono || em.email) {
    const contatti = cedente.ele("Contatti");
    if (em.telefono) contatti.ele("Telefono").txt(em.telefono).up();
    contatti.ele("Email").txt(em.email).up();
    contatti.up();
  }
  cedente.up();

  const cessionario = header.ele("CessionarioCommittente");
  const datiAnagraficiCessionario = cessionario.ele("DatiAnagrafici");
  if (cliente.partitaIva?.trim()) {
    const idFiscaleCessionario = datiAnagraficiCessionario.ele("IdFiscaleIVA");
    idFiscaleCessionario.ele("IdPaese").txt(cliente.nazione).up();
    idFiscaleCessionario.ele("IdCodice").txt(cliente.partitaIva.trim()).up();
    idFiscaleCessionario.up();
  }
  if (cliente.codiceFiscale?.trim()) {
    datiAnagraficiCessionario.ele("CodiceFiscale").txt(cliente.codiceFiscale.trim()).up();
  }
  datiAnagraficiCessionario.ele("Anagrafica").ele("Denominazione").txt(cliente.denominazione).up().up();
  datiAnagraficiCessionario.up();
  const sedeCessionario = cessionario.ele("Sede");
  indirizzoEle(sedeCessionario, cliente);
  sedeCessionario.up();
  cessionario.up();

  header.up();

  // --- Body ---
  const body = doc.ele("FatturaElettronicaBody");

  const datiGenerali = body.ele("DatiGenerali");
  const datiGeneraliDocumento = datiGenerali.ele("DatiGeneraliDocumento");
  datiGeneraliDocumento.ele("TipoDocumento").txt(documento.tipo === "fattura" ? "TD01" : "TD04").up();
  datiGeneraliDocumento.ele("Divisa").txt("EUR").up();
  datiGeneraliDocumento.ele("Data").txt(documento.dataDocumento).up();
  datiGeneraliDocumento.ele("Numero").txt(documento.numero).up();
  datiGeneraliDocumento.ele("ImportoTotaleDocumento").txt(euro2(documento.totaleCent)).up();
  datiGeneraliDocumento.up();

  if (documento.tipo === "nota_credito" && riferimento) {
    const datiFattureCollegate = datiGenerali.ele("DatiFattureCollegate");
    datiFattureCollegate.ele("IdDocumento").txt(riferimento.numero).up();
    datiFattureCollegate.ele("Data").txt(riferimento.dataDocumento).up();
    datiFattureCollegate.up();
  }
  datiGenerali.up();

  const datiBeniServizi = body.ele("DatiBeniServizi");
  documento.righe.forEach((riga, indice) => {
    const linea = datiBeniServizi.ele("DettaglioLinee");
    linea.ele("NumeroLinea").txt(String(indice + 1)).up();
    linea.ele("Descrizione").txt(riga.descrizione).up();
    linea.ele("Quantita").txt(riga.quantita).up();
    linea.ele("PrezzoUnitario").txt(euro2(riga.prezzoUnitarioCent)).up();
    linea.ele("PrezzoTotale").txt(euro2(riga.totaleRigaCent)).up();
    linea.ele("AliquotaIVA").txt((riga.aliquotaIvaCent / 100).toFixed(2)).up();
    if (riga.natura?.trim()) {
      linea.ele("Natura").txt(riga.natura.trim()).up();
    }
    linea.up();
  });

  for (const gruppo of gruppiRiepilogo) {
    const riepilogo = datiBeniServizi.ele("DatiRiepilogo");
    riepilogo.ele("AliquotaIVA").txt((gruppo.aliquotaIvaCent / 100).toFixed(2)).up();
    if (gruppo.natura) {
      riepilogo.ele("Natura").txt(gruppo.natura).up();
    }
    riepilogo.ele("ImponibileImporto").txt(euro2(gruppo.imponibileCent)).up();
    riepilogo.ele("Imposta").txt(euro2(gruppo.ivaCent)).up();
    riepilogo.up();
  }
  datiBeniServizi.up();

  body.up();

  return doc.end({ prettyPrint: true });
}
