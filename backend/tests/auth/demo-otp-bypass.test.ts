import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { loadEnv } from "../../src/config/env.js";
import { utenti } from "../../src/db/schema.js";
import { client, db } from "../db/setup.js";
import { CookieJar, TEST_PASSWORD } from "../support/auth.js";

const baseEnv = loadEnv();
const BYPASS_CODE = "123456";

async function createUser(email: string) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db.insert(utenti).values({ email, passwordHash }).returning();
  return user!;
}

describe("bypass TOTP demo (DEMO_OTP_BYPASS_CODE)", () => {
  let appConBypass: FastifyInstance;
  let appSenzaBypass: FastifyInstance;

  beforeAll(async () => {
    appConBypass = await buildApp({ ...baseEnv, DEMO_OTP_BYPASS_CODE: BYPASS_CODE }, db);
    await appConBypass.ready();
    appSenzaBypass = await buildApp(baseEnv, db);
    await appSenzaBypass.ready();
  });

  afterAll(async () => {
    await appConBypass.close();
    await appSenzaBypass.close();
    await client.end();
  });

  it("con la variabile impostata, il codice bypass attiva il setup TOTP anche se non corrisponde al secret reale", async () => {
    const email = `test-bypass-setup-${randomUUID()}@example.com`;
    await createUser(email);
    const jar = new CookieJar();

    const loginRes = await appConBypass.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    jar.apply(loginRes.headers["set-cookie"]);
    expect(loginRes.json().totpSetupRequired).toBe(true);

    const activateRes = await appConBypass.inject({
      method: "POST",
      url: "/api/auth/totp/activate",
      cookies: jar.cookies,
      payload: { code: BYPASS_CODE },
    });
    expect(activateRes.statusCode).toBe(200);

    const [userRow] = await db.select().from(utenti).where(eq(utenti.email, email)).limit(1);
    expect(userRow!.totpEnabled).toBe(true);
  });

  it("con la variabile impostata, il codice bypass verifica il login su un utente con TOTP già attivo", async () => {
    const email = `test-bypass-verify-${randomUUID()}@example.com`;
    await createUser(email);
    const jar = new CookieJar();

    const loginRes = await appConBypass.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    jar.apply(loginRes.headers["set-cookie"]);
    await appConBypass.inject({
      method: "POST",
      url: "/api/auth/totp/activate",
      cookies: jar.cookies,
      payload: { code: BYPASS_CODE },
    });

    const jar2 = new CookieJar();
    const relogin = await appConBypass.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    jar2.apply(relogin.headers["set-cookie"]);
    expect(relogin.json().totpRequired).toBe(true);

    const verifyRes = await appConBypass.inject({
      method: "POST",
      url: "/api/auth/totp/verify",
      cookies: jar2.cookies,
      payload: { code: BYPASS_CODE },
    });
    expect(verifyRes.statusCode).toBe(200);
  });

  it("senza la variabile impostata (comportamento di produzione), lo stesso codice viene rifiutato", async () => {
    const email = `test-nobypass-${randomUUID()}@example.com`;
    await createUser(email);
    const jar = new CookieJar();

    const loginRes = await appSenzaBypass.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    jar.apply(loginRes.headers["set-cookie"]);
    expect(loginRes.json().totpSetupRequired).toBe(true);

    const activateRes = await appSenzaBypass.inject({
      method: "POST",
      url: "/api/auth/totp/activate",
      cookies: jar.cookies,
      payload: { code: BYPASS_CODE },
    });
    expect(activateRes.statusCode).toBe(401);

    const [userRow] = await db.select().from(utenti).where(eq(utenti.email, email)).limit(1);
    expect(userRow!.totpEnabled).toBe(false);
  });
});
