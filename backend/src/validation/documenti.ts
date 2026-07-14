import { z } from "zod";

export const documentoIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const rigaIdParamSchema = z.object({
  id: z.string().uuid(),
  rigaId: z.string().uuid(),
});

export const creaDocumentoSchema = z.object({
  clienteId: z.string().uuid(),
  dataDocumento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida (formato YYYY-MM-DD)"),
});

export const aggiornaDocumentoSchema = creaDocumentoSchema;

export const listaDocumentiQuerySchema = z.object({
  anno: z.coerce.number().int().min(2000).max(2999).optional(),
  tipo: z.enum(["fattura", "nota_credito"]).optional(),
  stato: z.enum(["bozza", "emessa", "annullata"]).optional(),
  clienteId: z.string().uuid().optional(),
});

const quantitaSchema = z
  .union([z.string(), z.number()])
  .transform((v): number => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
  .refine((v) => Number.isFinite(v) && v > 0, "La quantità deve essere maggiore di zero");

export const rigaInputSchema = z.object({
  codiceFornitore: z.string().trim().max(6).nullable().optional(),
  codiceMerce: z.string().trim().max(15).nullable().optional(),
  codiceEan: z.string().trim().max(15).nullable().optional(),
  descrizione: z.string().trim().min(1).max(200),
  codiceIva: z.string().trim().min(1).max(5),
  aliquotaIvaCent: z.number().int().min(0),
  natura: z.string().trim().max(3).nullable().optional(),
  quantita: quantitaSchema,
  prezzoUnitarioCent: z.number().int().min(0),
});

export type RigaInput = z.infer<typeof rigaInputSchema>;
