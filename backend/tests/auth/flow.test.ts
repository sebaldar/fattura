import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { generate } from "otplib";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { decryptSecret } from "../../src/auth/crypto.js";
import { LOCKOUT_THRESHOLD } from "../../src/auth/lockout.js";
import { hashPassword } from "../../src/auth/password.js";
import { loadEnv } from "../../src/config/env.js";
import { utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";

const env = loadEnv();
const PASSWORD = "Password123!";

class CookieJar {
  private jar: Record<string, string> = {};

  apply(setCookie: string | string[] | undefined): void {
    const entries = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    for (const entry of entries) {
      const pair = entry.split(";")[0]!;
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (value === "") {
        delete this.jar[name];
      } else {
        this.jar[name] = value;
      }
    }
  }

  get cookies(): Record<string, string> {
    return { ...this.jar };
  }
}

async function createUser(email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(utenti).values({ email, passwordHash }).returning();
  return user!;
}

describe("flusso di autenticazione 2FA", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(env, db);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await client.end();
  });

  it("login -> setup TOTP -> attivazione -> /me -> refresh con rotazione -> logout", async () => {
    const email = `test-flow-${randomUUID()}@example.com`;
    await createUser(email);
    const jar = new CookieJar();

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.totpSetupRequired).toBe(true);
    expect(typeof loginBody.totpSecret).toBe("string");
    jar.apply(loginRes.headers["set-cookie"]);
    expect(jar.cookies.pending_auth).toBeTruthy();

    const code = await generate({ secret: loginBody.totpSecret });

    const activateRes = await app.inject({
      method: "POST",
      url: "/api/auth/totp/activate",
      cookies: jar.cookies,
      payload: { code },
    });
    expect(activateRes.statusCode).toBe(200);
    jar.apply(activateRes.headers["set-cookie"]);
    expect(jar.cookies.access_token).toBeTruthy();
    expect(jar.cookies.refresh_token).toBeTruthy();
    expect(jar.cookies.pending_auth).toBeUndefined();

    const [userRow] = await db.select().from(utenti).where(eq(utenti.email, email)).limit(1);
    expect(userRow!.totpEnabled).toBe(true);
    expect(userRow!.totpSecret).not.toBe(loginBody.totpSecret);

    const meRes = await app.inject({ method: "GET", url: "/api/auth/me", cookies: jar.cookies });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe(email);

    const meNoAuthRes = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(meNoAuthRes.statusCode).toBe(401);

    const oldRefresh = jar.cookies.refresh_token;
    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: jar.cookies,
    });
    expect(refreshRes.statusCode).toBe(204);
    jar.apply(refreshRes.headers["set-cookie"]);
    expect(jar.cookies.refresh_token).not.toBe(oldRefresh);

    const reuseRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: oldRefresh! },
    });
    expect(reuseRes.statusCode).toBe(401);

    const afterReuseAttemptRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: jar.cookies,
    });
    expect(afterReuseAttemptRes.statusCode).toBe(401);

    await db.update(utenti).set({ currentRefreshJti: null }).where(eq(utenti.id, userRow!.id));
    const relogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: PASSWORD },
    });
    const jar2 = new CookieJar();
    jar2.apply(relogin.headers["set-cookie"]);
    expect(relogin.json().totpRequired).toBe(true);

    const secret = decryptSecret(userRow!.totpSecret!, env.TOTP_ENC_KEY);
    const code2 = await generate({ secret });
    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/totp/verify",
      cookies: jar2.cookies,
      payload: { code: code2 },
    });
    expect(verifyRes.statusCode).toBe(200);
    jar2.apply(verifyRes.headers["set-cookie"]);

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: jar2.cookies,
    });
    expect(logoutRes.statusCode).toBe(204);
    jar2.apply(logoutRes.headers["set-cookie"]);
    expect(jar2.cookies.access_token).toBeUndefined();

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: jar2.cookies,
    });
    expect(refreshAfterLogout.statusCode).toBe(401);

    await db.delete(utenti).where(eq(utenti.email, email));
  });

  it("blocca l'account dopo troppi tentativi falliti", async () => {
    const email = `test-lockout-${randomUUID()}@example.com`;
    await createUser(email);

    let lastStatus = 0;
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "wrong-password" },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(401);

    const lockedRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(lockedRes.statusCode).toBe(423);

    await db.delete(utenti).where(eq(utenti.email, email));
  });

  it("rifiuta credenziali inesistenti senza rivelare dettagli", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "non-esiste@example.com", password: "qualsiasi" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Credenziali non valide");
  });
});
