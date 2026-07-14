import { z } from "zod";
import { isValidCodiceFiscale, isValidPartitaIva } from "../lib/fiscal.js";

/**
 * Schemi per singolo campo, riusati sia dal CRUD manuale (validazione stretta)
 * sia dall'estrazione AI (validazione per-campo: un campo non valido diventa
 * null con warning, senza far fallire l'intera estrazione).
 */
export const clienteFieldSchemas = {
  denominazione: z.string().trim().min(1).max(200),
  partitaIva: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "La partita IVA deve avere 11 cifre")
    .refine(isValidPartitaIva, "Partita IVA non valida (checksum)"),
  codiceFiscale: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidCodiceFiscale, "Codice fiscale non valido"),
  codiceSdi: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{7}$/, "Il codice SDI deve avere 7 caratteri"),
  pec: z.string().trim().email("PEC non valida"),
  indirizzo: z.string().trim().min(1).max(200),
  cap: z.string().trim().regex(/^\d{5}$/, "Il CAP deve avere 5 cifre"),
  comune: z.string().trim().min(1).max(100),
  provincia: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "La provincia deve avere 2 lettere"),
  nazione: z.string().trim().toUpperCase().length(2),
  email: z.string().trim().email("Email non valida"),
  telefono: z.string().trim().min(1).max(30),
  note: z.string().trim().min(1),
};

function nullableOptional<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable().optional();
}

export const createClienteSchema = z
  .object({
    denominazione: clienteFieldSchemas.denominazione,
    partitaIva: nullableOptional(clienteFieldSchemas.partitaIva),
    codiceFiscale: nullableOptional(clienteFieldSchemas.codiceFiscale),
    codiceSdi: nullableOptional(clienteFieldSchemas.codiceSdi),
    pec: nullableOptional(clienteFieldSchemas.pec),
    indirizzo: nullableOptional(clienteFieldSchemas.indirizzo),
    cap: nullableOptional(clienteFieldSchemas.cap),
    comune: nullableOptional(clienteFieldSchemas.comune),
    provincia: nullableOptional(clienteFieldSchemas.provincia),
    nazione: clienteFieldSchemas.nazione.default("IT"),
    email: nullableOptional(clienteFieldSchemas.email),
    telefono: nullableOptional(clienteFieldSchemas.telefono),
    note: nullableOptional(clienteFieldSchemas.note),
  })
  .refine((data) => Boolean(data.partitaIva) || Boolean(data.codiceFiscale), {
    message: "È richiesto almeno uno tra partita IVA e codice fiscale",
    path: ["partitaIva"],
  });

export const updateClienteSchema = createClienteSchema;

export type CreateClienteInput = z.infer<typeof createClienteSchema>;

export const listClientiQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
});

export const clienteIdParamSchema = z.object({
  id: z.string().uuid(),
});
