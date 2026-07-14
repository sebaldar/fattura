declare module "pdfmake" {
  interface PdfFontDescriptor {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  }

  class PdfPrinter {
    constructor(fonts: Record<string, PdfFontDescriptor>);
    createPdfKitDocument(docDefinition: unknown): NodeJS.ReadableStream & { end(): void };
  }

  export = PdfPrinter;
}
