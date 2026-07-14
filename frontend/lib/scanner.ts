export type CodiceScansionato =
  | { type: "ean"; code: string }
  | { type: "qr"; fornitore: string; merce: string };

/**
 * Distingue un EAN (8 o 13 cifre) da un QR di etichetta fornitore/merce.
 * Le etichette fisiche codificano un URL con i parametri "fornitore" e
 * "merce" (stessa convenzione usata da VIEW_PRODUCT), a volte senza schema
 * (es. "www.baldoweb.it/QRCODE/?..."): new URL() lo rifiuta come relativo,
 * quindi si ritenta con https:// prima di arrendersi.
 */
export function classifyDecodedText(text: string): CodiceScansionato | null {
  const trimmed = text.trim();

  if (/^\d{8}$|^\d{13}$/.test(trimmed)) {
    return { type: "ean", code: trimmed };
  }

  let url: URL | null;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      url = null;
    }
  }

  if (url) {
    const fornitore = url.searchParams.get("fornitore");
    const merce = url.searchParams.get("merce");
    if (fornitore && merce) {
      return { type: "qr", fornitore, merce };
    }
  }

  return null;
}
