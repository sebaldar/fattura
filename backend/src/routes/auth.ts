import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "../auth/crypto.js";
import { computeLockedUntil, isLocked } from "../auth/lockout.js";
import { verifyPassword } from "../auth/password.js";
import {
  baseCookieOptions,
  cookieMaxAge,
  COOKIE_ACCESS,
  COOKIE_PENDING,
  COOKIE_REFRESH,
  signAccessToken,
  signPendingToken,
  signRefreshToken,
  verifyPendingToken,
  verifyRefreshToken,
} from "../auth/tokens.js";
import { generateTotpSecret, totpKeyUri, verifyTotpCode } from "../auth/totp.js";
import type { Env } from "../config/env.js";
import type { Db } from "../db/client.js";
import { utenti } from "../db/schema.js";
import { validateBody } from "../lib/validation.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Il codice deve essere di 6 cifre"),
});

// Hash fittizio (argon2id) usato per equalizzare i tempi di risposta quando l'email non esiste.
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export interface AuthRoutesOptions {
  db: Db;
  env: Env;
}

export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions): Promise<void> {
  const { db, env } = opts;
  const cookieOpts = baseCookieOptions(env.NODE_ENV === "production");

  function clearAuthCookies(reply: FastifyReply): void {
    reply.clearCookie(COOKIE_ACCESS, { path: "/" });
    reply.clearCookie(COOKIE_REFRESH, { path: "/" });
    reply.clearCookie(COOKIE_PENDING, { path: "/" });
  }

  // Solo se DEMO_OTP_BYPASS_CODE è impostata (mai in produzione): accetta quel
  // codice fisso in aggiunta al TOTP reale, per non richiedere un'app authenticator
  // per esplorare la demo pubblica.
  async function isValidTotp(code: string, secret: string): Promise<boolean> {
    if (env.DEMO_OTP_BYPASS_CODE && code === env.DEMO_OTP_BYPASS_CODE) {
      return true;
    }
    return verifyTotpCode(code, secret);
  }

  async function registerFailedAttempt(userId: string, failedAttempts: number): Promise<void> {
    const nextFailed = failedAttempts + 1;
    await db
      .update(utenti)
      .set({ failedAttempts: nextFailed, lockedUntil: computeLockedUntil(nextFailed) })
      .where(eq(utenti.id, userId));
  }

  async function finalizeLogin(reply: FastifyReply, userId: string, email: string): Promise<void> {
    const { token: refreshToken, jti } = signRefreshToken(env.JWT_SECRET, userId);
    await db
      .update(utenti)
      .set({ failedAttempts: 0, lockedUntil: null, currentRefreshJti: jti })
      .where(eq(utenti.id, userId));

    const accessToken = signAccessToken(env.JWT_SECRET, userId, email);
    reply.clearCookie(COOKIE_PENDING, { path: "/" });
    reply.setCookie(COOKIE_ACCESS, accessToken, { ...cookieOpts, maxAge: cookieMaxAge.access });
    reply.setCookie(COOKIE_REFRESH, refreshToken, { ...cookieOpts, maxAge: cookieMaxAge.refresh });
  }

  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = validateBody(loginSchema, request.body, reply);
      if (!body) return;

      const [user] = await db.select().from(utenti).where(eq(utenti.email, body.email)).limit(1);

      if (!user) {
        await verifyPassword(DUMMY_HASH, body.password).catch(() => false);
        reply.code(401).send({ error: "Credenziali non valide" });
        return;
      }

      if (isLocked(user.lockedUntil)) {
        reply.code(423).send({ error: "Account temporaneamente bloccato", lockedUntil: user.lockedUntil });
        return;
      }

      const valid = await verifyPassword(user.passwordHash, body.password);
      if (!valid) {
        await registerFailedAttempt(user.id, user.failedAttempts);
        reply.code(401).send({ error: "Credenziali non valide" });
        return;
      }

      await db
        .update(utenti)
        .set({ failedAttempts: 0, lockedUntil: null })
        .where(eq(utenti.id, user.id));

      if (user.totpEnabled) {
        const pendingToken = signPendingToken(env.JWT_SECRET, user.id, "totp");
        reply.setCookie(COOKIE_PENDING, pendingToken, { ...cookieOpts, maxAge: cookieMaxAge.pending });
        reply.send({ totpRequired: true, totpSetupRequired: false });
        return;
      }

      const secret = generateTotpSecret();
      const pendingToken = signPendingToken(env.JWT_SECRET, user.id, "totp_setup", secret);
      reply.setCookie(COOKIE_PENDING, pendingToken, { ...cookieOpts, maxAge: cookieMaxAge.pending });
      reply.send({
        totpRequired: false,
        totpSetupRequired: true,
        totpSecret: secret,
        totpUri: totpKeyUri(user.email, secret),
      });
    },
  );

  app.post(
    "/api/auth/totp/activate",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = validateBody(codeSchema, request.body, reply);
      if (!body) return;

      const pendingCookie = request.cookies[COOKIE_PENDING];
      if (!pendingCookie) {
        reply.code(401).send({ error: "Sessione di login scaduta, effettua di nuovo il login" });
        return;
      }

      let pending;
      try {
        pending = verifyPendingToken(env.JWT_SECRET, pendingCookie, "totp_setup");
      } catch {
        clearAuthCookies(reply);
        reply.code(401).send({ error: "Sessione di login scaduta, effettua di nuovo il login" });
        return;
      }

      const [user] = await db.select().from(utenti).where(eq(utenti.id, pending.sub)).limit(1);
      if (!user || !pending.totpSecret) {
        clearAuthCookies(reply);
        reply.code(401).send({ error: "Sessione di login scaduta, effettua di nuovo il login" });
        return;
      }

      if (isLocked(user.lockedUntil)) {
        reply.code(423).send({ error: "Account temporaneamente bloccato", lockedUntil: user.lockedUntil });
        return;
      }

      const valid = await isValidTotp(body.code, pending.totpSecret);
      if (!valid) {
        await registerFailedAttempt(user.id, user.failedAttempts);
        reply.code(401).send({ error: "Codice non valido" });
        return;
      }

      const encrypted = encryptSecret(pending.totpSecret, env.TOTP_ENC_KEY);
      await db
        .update(utenti)
        .set({ totpSecret: encrypted, totpEnabled: true })
        .where(eq(utenti.id, user.id));

      await finalizeLogin(reply, user.id, user.email);
      reply.send({ email: user.email });
    },
  );

  app.post(
    "/api/auth/totp/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = validateBody(codeSchema, request.body, reply);
      if (!body) return;

      const pendingCookie = request.cookies[COOKIE_PENDING];
      if (!pendingCookie) {
        reply.code(401).send({ error: "Sessione di login scaduta, effettua di nuovo il login" });
        return;
      }

      let pending;
      try {
        pending = verifyPendingToken(env.JWT_SECRET, pendingCookie, "totp");
      } catch {
        clearAuthCookies(reply);
        reply.code(401).send({ error: "Sessione di login scaduta, effettua di nuovo il login" });
        return;
      }

      const [user] = await db.select().from(utenti).where(eq(utenti.id, pending.sub)).limit(1);
      if (!user || !user.totpEnabled || !user.totpSecret) {
        clearAuthCookies(reply);
        reply.code(401).send({ error: "Sessione di login scaduta, effettua di nuovo il login" });
        return;
      }

      if (isLocked(user.lockedUntil)) {
        reply.code(423).send({ error: "Account temporaneamente bloccato", lockedUntil: user.lockedUntil });
        return;
      }

      const secret = decryptSecret(user.totpSecret, env.TOTP_ENC_KEY);
      const valid = await isValidTotp(body.code, secret);
      if (!valid) {
        await registerFailedAttempt(user.id, user.failedAttempts);
        reply.code(401).send({ error: "Codice non valido" });
        return;
      }

      await finalizeLogin(reply, user.id, user.email);
      reply.send({ email: user.email });
    },
  );

  app.post("/api/auth/refresh", async (request, reply) => {
    const refreshCookie = request.cookies[COOKIE_REFRESH];
    if (!refreshCookie) {
      reply.code(401).send({ error: "Autenticazione richiesta" });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(env.JWT_SECRET, refreshCookie);
    } catch {
      clearAuthCookies(reply);
      reply.code(401).send({ error: "Sessione non valida, effettua di nuovo il login" });
      return;
    }

    const [user] = await db.select().from(utenti).where(eq(utenti.id, payload.sub)).limit(1);
    if (!user || user.currentRefreshJti !== payload.jti) {
      // Riuso di un refresh token già ruotato: possibile furto, revoca la sessione.
      if (user) {
        await db.update(utenti).set({ currentRefreshJti: null }).where(eq(utenti.id, user.id));
      }
      clearAuthCookies(reply);
      reply.code(401).send({ error: "Sessione non valida, effettua di nuovo il login" });
      return;
    }

    const { token: newRefreshToken, jti } = signRefreshToken(env.JWT_SECRET, user.id);
    await db.update(utenti).set({ currentRefreshJti: jti }).where(eq(utenti.id, user.id));

    const accessToken = signAccessToken(env.JWT_SECRET, user.id, user.email);
    reply.setCookie(COOKIE_ACCESS, accessToken, { ...cookieOpts, maxAge: cookieMaxAge.access });
    reply.setCookie(COOKIE_REFRESH, newRefreshToken, { ...cookieOpts, maxAge: cookieMaxAge.refresh });
    reply.code(204).send();
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const refreshCookie = request.cookies[COOKIE_REFRESH];
    if (refreshCookie) {
      try {
        const payload = verifyRefreshToken(env.JWT_SECRET, refreshCookie);
        await db.update(utenti).set({ currentRefreshJti: null }).where(eq(utenti.id, payload.sub));
      } catch {
        // token già non valido: nulla da revocare
      }
    }
    clearAuthCookies(reply);
    reply.code(204).send();
  });

  app.get("/api/auth/me", async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({ error: "Autenticazione richiesta" });
      return;
    }
    reply.send({ id: request.user.id, email: request.user.email });
  });
}
