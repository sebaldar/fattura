import type { FastifyInstance } from "fastify";
import { generate } from "otplib";
import { hashPassword } from "../../src/auth/password.js";
import { utenti } from "../../src/db/schema.js";
import { db } from "../db/setup.js";

export const TEST_PASSWORD = "Password123!";

export class CookieJar {
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

/** Crea un utente, esegue login + setup TOTP + attivazione, e ritorna i cookie autenticati. */
export async function loginAsNewUser(app: FastifyInstance, email: string): Promise<CookieJar> {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await db.insert(utenti).values({ email, passwordHash });

  const jar = new CookieJar();

  const loginRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: TEST_PASSWORD },
  });
  jar.apply(loginRes.headers["set-cookie"]);
  const { totpSecret } = loginRes.json();

  const code = await generate({ secret: totpSecret });
  const activateRes = await app.inject({
    method: "POST",
    url: "/api/auth/totp/activate",
    cookies: jar.cookies,
    payload: { code },
  });
  jar.apply(activateRes.headers["set-cookie"]);

  return jar;
}
