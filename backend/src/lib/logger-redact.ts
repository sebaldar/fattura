const CAMPI_SENSIBILI = [
  "password",
  "password_hash",
  "passwordHash",
  "totp_secret",
  "totpSecret",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "ANTHROPIC_API_KEY",
  "JWT_SECRET",
  "TOTP_ENC_KEY",
];

/** Redazione a profondità 0/1/2 (bare, "*.campo", "*.*.campo") per coprire le forme realistiche dei log (top-level, req.X, req.body.X). */
export const loggerRedact = {
  paths: CAMPI_SENSIBILI.flatMap((campo) => [campo, `*.${campo}`, `*.*.${campo}`]),
  censor: "[redacted]",
};
