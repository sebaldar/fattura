import { z } from "zod";
import { isValidCodiceFiscale, isValidPartitaIva } from "../lib/fiscal.js";

const REGIMI_FISCALI = [
  "RF01",
  "RF02",
  "RF04",
  "RF05",
  "RF06",
  "RF07",
  "RF08",
  "RF09",
  "RF10",
  "RF11",
  "RF12",
  "RF13",
  "RF14",
  "RF15",
  "RF16",
  "RF17",
  "RF18",
  "RF19",
] as const;

export const aggiornaEmittenteSchema = z.object({
  ragioneSociale: z.string().trim().min(1).max(200),
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
  indirizzo: z.string().trim().min(1).max(200),
  cap: z.string().trim().regex(/^\d{5}$/, "Il CAP deve avere 5 cifre"),
  comune: z.string().trim().min(1).max(100),
  provincia: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "La provincia deve avere 2 lettere"),
  nazione: z.string().trim().toUpperCase().length(2),
  regimeFiscale: z.enum(REGIMI_FISCALI),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/, "IBAN non valido"),
  email: z.string().trim().email("Email non valida"),
  telefono: z.string().trim().min(1).max(30).nullable().optional(),
});

export type AggiornaEmittenteInput = z.infer<typeof aggiornaEmittenteSchema>;
