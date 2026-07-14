import PdfPrinter from "pdfmake";
import type { emittente, righeDocumento } from "../db/schema.js";
import { formatDataIt, formatEuroCent } from "../lib/format.js";
import type { RiepilogoIva } from "./totali.js";

type PdfSize = number | "auto" | "*";
type PdfMargin = number | [number, number] | [number, number, number, number];
type PdfAlignment = "left" | "right" | "center";

interface PdfText {
  text: string;
  bold?: boolean;
  italics?: boolean;
  fontSize?: number;
  alignment?: PdfAlignment;
  margin?: PdfMargin;
  width?: PdfSize;
}

type PdfTableCell = string | PdfText;

interface PdfStack {
  stack: (PdfText | PdfTable)[];
  margin?: PdfMargin;
}

interface PdfColumns {
  columns: (PdfText | PdfStack)[];
}

interface PdfTable {
  table: {
    headerRows: number;
    widths: PdfSize[];
    body: PdfTableCell[][];
  };
  fontSize?: number;
  margin?: PdfMargin;
}

type PdfContent = PdfText | PdfStack | PdfColumns | PdfTable;

interface PdfDocDefinition {
  defaultStyle: { font: string; fontSize: number };
  pageMargins: [number, number, number, number];
  content: PdfContent[];
}

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export interface ClienteSnapshot {
  denominazione: string;
  partitaIva: string | null;
  codiceFiscale: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  nazione: string;
}

export interface DocumentoPerPdf {
  tipo: "fattura" | "nota_credito";
  numero: string;
  dataDocumento: string;
  clienteSnapshot: ClienteSnapshot;
  righe: (typeof righeDocumento.$inferSelect)[];
  riepilogoIva: RiepilogoIva[];
  totaleImponibileCent: number;
  totaleIvaCent: number;
  totaleCent: number;
}

export interface DocumentoRiferimentoPerPdf {
  numero: string;
  dataDocumento: string;
}

type EmittenteRow = typeof emittente.$inferSelect;

function intestazioneEmittente(em: EmittenteRow): PdfStack {
  return {
    stack: [
      { text: em.ragioneSociale, bold: true, fontSize: 12 },
      { text: `${em.indirizzo} - ${em.cap} ${em.comune} (${em.provincia})`, fontSize: 9 },
      { text: `P.IVA ${em.partitaIva} - C.F. ${em.codiceFiscale}`, fontSize: 9 },
      { text: `IBAN ${em.iban}`, fontSize: 9 },
    ],
  };
}

function datiCliente(cliente: ClienteSnapshot): PdfStack {
  const righeIndirizzo = [cliente.indirizzo, [cliente.cap, cliente.comune, cliente.provincia].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" - ");
  const righe: PdfText[] = [
    { text: "Cliente", bold: true, fontSize: 9, margin: [0, 0, 0, 2] },
    { text: cliente.denominazione, bold: true, fontSize: 10 },
  ];
  if (righeIndirizzo) righe.push({ text: righeIndirizzo, fontSize: 9 });
  if (cliente.partitaIva) righe.push({ text: `P.IVA ${cliente.partitaIva}`, fontSize: 9 });
  if (cliente.codiceFiscale) righe.push({ text: `C.F. ${cliente.codiceFiscale}`, fontSize: 9 });
  return { stack: righe, margin: [0, 0, 0, 10] };
}

function tabellaRighe(righe: DocumentoPerPdf["righe"]): PdfTable {
  return {
    table: {
      headerRows: 1,
      widths: ["*", "auto", "auto", "auto", "auto"],
      body: [
        [
          { text: "Descrizione", bold: true },
          { text: "Quantità", bold: true, alignment: "right" },
          { text: "Prezzo unit.", bold: true, alignment: "right" },
          { text: "Aliquota", bold: true, alignment: "right" },
          { text: "Totale", bold: true, alignment: "right" },
        ],
        ...righe.map(
          (r): PdfTableCell[] => [
            r.descrizione,
            { text: r.quantita, alignment: "right" },
            { text: formatEuroCent(r.prezzoUnitarioCent), alignment: "right" },
            { text: `${(r.aliquotaIvaCent / 100).toFixed(2)}%`, alignment: "right" },
            { text: formatEuroCent(r.totaleRigaCent), alignment: "right" },
          ],
        ),
      ],
    },
    fontSize: 9,
    margin: [0, 10, 0, 10],
  };
}

function tabellaRiepilogoIva(riepilogo: RiepilogoIva[]): PdfTable {
  return {
    table: {
      headerRows: 1,
      widths: ["auto", "auto", "auto"],
      body: [
        [
          { text: "Aliquota", bold: true },
          { text: "Imponibile", bold: true, alignment: "right" },
          { text: "IVA", bold: true, alignment: "right" },
        ],
        ...riepilogo.map(
          (r): PdfTableCell[] => [
            `${(r.aliquotaIvaCent / 100).toFixed(2)}%`,
            { text: formatEuroCent(r.imponibileCent), alignment: "right" },
            { text: formatEuroCent(r.ivaCent), alignment: "right" },
          ],
        ),
      ],
    },
    fontSize: 9,
  };
}

export function generaPdfDocumento(
  documento: DocumentoPerPdf,
  em: EmittenteRow,
  riferimento: DocumentoRiferimentoPerPdf | null,
): Promise<Buffer> {
  const titolo = documento.tipo === "fattura" ? "FATTURA" : "NOTA DI CREDITO";

  const content: PdfContent[] = [
    { columns: [intestazioneEmittente(em), { text: "", width: "*" }] },
    { text: titolo, bold: true, fontSize: 16, margin: [0, 20, 0, 0] },
    {
      text: `N. ${documento.numero} del ${formatDataIt(documento.dataDocumento)}`,
      fontSize: 10,
      margin: [0, 2, 0, 10],
    },
  ];

  if (riferimento) {
    content.push({
      text: `A storno della fattura n. ${riferimento.numero} del ${formatDataIt(riferimento.dataDocumento)}`,
      italics: true,
      fontSize: 9,
      margin: [0, 0, 0, 10],
    });
  }

  content.push(
    datiCliente(documento.clienteSnapshot),
    tabellaRighe(documento.righe),
    { text: "Riepilogo IVA", bold: true, fontSize: 10, margin: [0, 10, 0, 4] },
    tabellaRiepilogoIva(documento.riepilogoIva),
    {
      stack: [
        { text: `Totale imponibile: ${formatEuroCent(documento.totaleImponibileCent)}`, fontSize: 10 },
        { text: `Totale IVA: ${formatEuroCent(documento.totaleIvaCent)}`, fontSize: 10 },
        { text: `Totale documento: ${formatEuroCent(documento.totaleCent)}`, fontSize: 12, bold: true },
      ],
      margin: [0, 10, 0, 0],
    },
  );

  const docDefinition: PdfDocDefinition = {
    defaultStyle: { font: "Helvetica", fontSize: 10 },
    pageMargins: [40, 40, 40, 40],
    content,
  };

  const printer = new PdfPrinter(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
