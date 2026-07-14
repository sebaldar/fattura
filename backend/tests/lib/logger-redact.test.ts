import pino from "pino";
import { describe, expect, it } from "vitest";
import { loggerRedact } from "../../src/lib/logger-redact.js";

function catturaLog(fn: (logger: pino.Logger) => void): string {
  const chunks: string[] = [];
  const stream = { write: (chunk: string) => chunks.push(chunk) };
  const logger = pino({ redact: loggerRedact }, stream as pino.DestinationStream);
  fn(logger);
  return chunks.join("");
}

describe("redazione dei log (password/token/secret mai in chiaro)", () => {
  it("redige un campo password a livello superiore", () => {
    const output = catturaLog((logger) => logger.info({ password: "supersegreto" }));
    expect(output).not.toContain("supersegreto");
    expect(output).toContain('"password":"[redacted]"');
  });

  it("redige password/token annidati come nel corpo di una richiesta", () => {
    const output = catturaLog((logger) =>
      logger.info({ req: { body: { email: "a@b.it", password: "pwd-in-chiaro" } } }),
    );
    expect(output).not.toContain("pwd-in-chiaro");
    expect(output).toContain("a@b.it");
  });

  it("redige l'header Authorization e Cookie", () => {
    const output = catturaLog((logger) =>
      logger.info({ req: { headers: { authorization: "Bearer segreto", cookie: "sid=abc123" } } }),
    );
    expect(output).not.toContain("Bearer segreto");
    expect(output).not.toContain("sid=abc123");
  });

  it("redige il totp secret e i token JWT", () => {
    const output = catturaLog((logger) =>
      logger.info({ user: { totpSecret: "JBSWY3DPEHPK3PXP", accessToken: "eyJhbGciOi", refreshToken: "eyJhbGciOj" } }),
    );
    expect(output).not.toContain("JBSWY3DPEHPK3PXP");
    expect(output).not.toContain("eyJhbGciOi");
    expect(output).not.toContain("eyJhbGciOj");
  });

  it("redige le variabili d'ambiente sensibili se mai loggate per errore", () => {
    const output = catturaLog((logger) =>
      logger.info({ env: { JWT_SECRET: "chiave-jwt", TOTP_ENC_KEY: "chiave-totp", ANTHROPIC_API_KEY: "sk-ant-xxx" } }),
    );
    expect(output).not.toContain("chiave-jwt");
    expect(output).not.toContain("chiave-totp");
    expect(output).not.toContain("sk-ant-xxx");
  });

  it("non redige campi non sensibili", () => {
    const output = catturaLog((logger) => logger.info({ msg: "richiesta completata", statusCode: 200 }));
    expect(output).toContain("richiesta completata");
    expect(output).toContain("200");
  });
});
