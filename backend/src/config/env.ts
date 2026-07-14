import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().min(1),
  LEGACY_DB_HOST: z.string().min(1),
  LEGACY_DB_PORT: z.coerce.number().int().positive().default(3306),
  LEGACY_DB_USER: z.string().min(1),
  LEGACY_DB_PASSWORD: z.string().min(1),
  LEGACY_DB_DATABASE: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TOTP_ENC_KEY: z.string().min(32),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  // Solo per l'ambiente demo pubblico (.env.demo): un codice TOTP fisso accettato
  // in aggiunta a quello reale, per evitare di dover configurare un'app authenticator
  // per provare la demo. Assente per default: mai impostare in produzione.
  DEMO_OTP_BYPASS_CODE: z
    .string()
    .regex(/^\d{6}$/, "Il codice bypass deve essere di 6 cifre")
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configurazione ambiente non valida: ${parsed.error.message}`);
  }
  return parsed.data;
}
