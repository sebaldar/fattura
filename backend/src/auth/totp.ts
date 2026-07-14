import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "Fatturazione E-commerce";
// Equivalente al "window: 1" delle vecchie API otplib: ±1 step da 30s.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}
