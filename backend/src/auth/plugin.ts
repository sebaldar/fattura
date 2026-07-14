import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import { COOKIE_ACCESS, verifyAccessToken } from "./tokens.js";

export interface AuthUser {
  id: string;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/totp/activate",
  "/api/auth/totp/verify",
  "/api/auth/refresh",
]);

export async function registerAuthInfra(app: FastifyInstance, env: Env): Promise<void> {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request, reply) => {
    if (PUBLIC_PATHS.has(request.url.split("?")[0] ?? request.url)) {
      return;
    }

    const token = request.cookies[COOKIE_ACCESS];
    if (!token) {
      reply.code(401).send({ error: "Autenticazione richiesta" });
      return;
    }

    try {
      const payload = verifyAccessToken(env.JWT_SECRET, token);
      request.user = { id: payload.sub, email: payload.email };
    } catch {
      reply.code(401).send({ error: "Sessione non valida o scaduta" });
    }
  });
}
