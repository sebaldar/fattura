import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { clienteFieldSchemas } from "../validation/clienti.js";

const CAMPI = [
  "denominazione",
  "partitaIva",
  "codiceFiscale",
  "indirizzo",
  "cap",
  "comune",
  "provincia",
  "email",
  "telefono",
  "pec",
  "codiceSdi",
] as const;

type Campo = (typeof CAMPI)[number];

export type EstrattoCliente = Record<Campo, string | null>;

const SYSTEM_PROMPT = `Sei un assistente che estrae dati anagrafici cliente da immagini (biglietti da visita, testo dattiloscritto o manoscritto). Rispondi SOLO con un oggetto JSON con esattamente queste chiavi: denominazione, partitaIva, codiceFiscale, indirizzo, cap, comune, provincia, email, telefono, pec, codiceSdi. Usa null per ogni campo non leggibile o assente. Non inventare mai dati che non sono presenti nell'immagine. Non aggiungere testo, spiegazioni o markdown: rispondi solo con il JSON.`;

const MODEL = "claude-sonnet-4-6";
const MAX_LATO_LUNGO = 1568;
const JPEG_QUALITY = 85;

export async function ridimensionaImmagine(
  buffer: Buffer,
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const resized = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_LATO_LUNGO,
      height: MAX_LATO_LUNGO,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { base64: resized.toString("base64"), mediaType: "image/jpeg" };
}

/** Rimuove eventuali fence markdown (```json ... ```) prima del parse. */
export function estraiJson(raw: string): unknown {
  const senzaFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(senzaFence);
}

/** Valida ogni campo indipendentemente: se non valido torna null con un warning. */
export function validaCampiEstratti(data: unknown): { cliente: EstrattoCliente; warnings: string[] } {
  const warnings: string[] = [];
  const result = {} as EstrattoCliente;
  const obj = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

  for (const campo of CAMPI) {
    const valore = obj[campo];
    if (valore === null || valore === undefined || valore === "") {
      result[campo] = null;
      continue;
    }
    if (typeof valore !== "string") {
      result[campo] = null;
      warnings.push(`Campo "${campo}" ignorato: formato inatteso`);
      continue;
    }
    const parsed = clienteFieldSchemas[campo].safeParse(valore);
    if (parsed.success) {
      result[campo] = parsed.data;
    } else {
      result[campo] = null;
      warnings.push(`Campo "${campo}" non valido, impostato a null`);
    }
  }

  return { cliente: result, warnings };
}

export async function estraiClienteDaFoto(
  apiKey: string,
  buffer: Buffer,
): Promise<{ cliente: EstrattoCliente; warnings: string[] }> {
  const { base64, mediaType } = await ridimensionaImmagine(buffer);
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: "Estrai i dati cliente da questa immagine, rispondendo solo con il JSON richiesto.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Risposta AI priva di contenuto testuale");
  }

  let parsedJson: unknown;
  try {
    parsedJson = estraiJson(textBlock.text);
  } catch {
    throw new Error("Impossibile interpretare la risposta AI come JSON");
  }

  return validaCampiEstratti(parsedJson);
}
