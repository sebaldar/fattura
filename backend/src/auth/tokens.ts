import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { CookieSerializeOptions } from "@fastify/cookie";

export const COOKIE_ACCESS = "access_token";
export const COOKIE_REFRESH = "refresh_token";
export const COOKIE_PENDING = "pending_auth";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const PENDING_TTL_SECONDS = 5 * 60;

type PendingPurpose = "totp" | "totp_setup";

interface PendingPayload {
  sub: string;
  typ: PendingPurpose;
  totpSecret?: string;
}

interface AccessPayload {
  sub: string;
  typ: "access";
  email: string;
}

interface RefreshPayload {
  sub: string;
  typ: "refresh";
  jti: string;
}

export function baseCookieOptions(isProduction: boolean): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
  };
}

export function signPendingToken(
  jwtSecret: string,
  sub: string,
  purpose: PendingPurpose,
  totpSecret?: string,
): string {
  const payload: PendingPayload = { sub, typ: purpose, ...(totpSecret ? { totpSecret } : {}) };
  return jwt.sign(payload, jwtSecret, { expiresIn: PENDING_TTL_SECONDS });
}

export function verifyPendingToken(
  jwtSecret: string,
  token: string,
  expectedPurpose: PendingPurpose,
): PendingPayload {
  const decoded = jwt.verify(token, jwtSecret) as PendingPayload;
  if (decoded.typ !== expectedPurpose) {
    throw new Error("Token di autenticazione non valido per questa fase");
  }
  return decoded;
}

export function signAccessToken(jwtSecret: string, sub: string, email: string): string {
  const payload: AccessPayload = { sub, typ: "access", email };
  return jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_TTL_SECONDS });
}

export function verifyAccessToken(jwtSecret: string, token: string): AccessPayload {
  const decoded = jwt.verify(token, jwtSecret) as AccessPayload;
  if (decoded.typ !== "access") {
    throw new Error("Token di accesso non valido");
  }
  return decoded;
}

export function signRefreshToken(jwtSecret: string, sub: string): { token: string; jti: string } {
  const jti = randomUUID();
  const payload: RefreshPayload = { sub, typ: "refresh", jti };
  const token = jwt.sign(payload, jwtSecret, { expiresIn: REFRESH_TTL_SECONDS });
  return { token, jti };
}

export function verifyRefreshToken(jwtSecret: string, token: string): RefreshPayload {
  const decoded = jwt.verify(token, jwtSecret) as RefreshPayload;
  if (decoded.typ !== "refresh") {
    throw new Error("Refresh token non valido");
  }
  return decoded;
}

export const cookieMaxAge = {
  access: ACCESS_TTL_SECONDS,
  refresh: REFRESH_TTL_SECONDS,
  pending: PENDING_TTL_SECONDS,
};
