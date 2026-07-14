import type { FastifyReply } from "fastify";
import type { z } from "zod";

/**
 * Valida il body con uno schema Zod; in caso di errore risponde 400 e ritorna undefined.
 * Il terzo generic di `z.ZodType` (Input) è fissato ad `any` così l'inferenza di `T`
 * usa solo la posizione Output: senza questo, schemi con `.transform()` (Output ≠ Input)
 * possono far inferire a TypeScript il tipo Input invece di quello Output.
 */
export function validateBody<T>(
  schema: z.ZodType<T, z.ZodTypeDef, any>,
  body: unknown,
  reply: FastifyReply,
): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    reply.code(400).send({
      error: "Dati non validi",
      details: parsed.error.flatten(),
    });
    return undefined;
  }
  return parsed.data;
}

/**
 * Sostituisce `undefined` con `null` sulle proprietà dirette di un oggetto.
 * Serve a soddisfare `exactOptionalPropertyTypes` quando un valore Zod
 * `.nullable().optional()` (`T | null | undefined`) va passato a Drizzle,
 * che con quel flag accetta solo `T | null` (mai `undefined` esplicito).
 */
export function undefinedToNull<T extends Record<string, unknown>>(
  input: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = value === undefined ? null : value;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}
