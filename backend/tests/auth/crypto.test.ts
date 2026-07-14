import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../../src/auth/crypto.js";

describe("cifratura TOTP secret (AES-256-GCM)", () => {
  const key = "chiave-di-test-lunga-almeno-32-caratteri";

  it("decifra correttamente ciò che ha cifrato", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted, key)).toBe(plaintext);
  });

  it("produce output diverso ad ogni cifratura (IV casuale)", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const a = encryptSecret(plaintext, key);
    const b = encryptSecret(plaintext, key);
    expect(a).not.toBe(b);
  });

  it("fallisce la decifratura con la chiave sbagliata", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(() => decryptSecret(encrypted, "altra-chiave-lunga-almeno-32-caratteri")).toThrow();
  });
});
