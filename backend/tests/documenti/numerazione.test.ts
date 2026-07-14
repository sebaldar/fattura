import { describe, expect, it } from "vitest";
import { comporreNumero } from "../../src/documenti/numerazione.js";

describe("comporreNumero", () => {
  it("compone il numero fattura con prefisso IT-F-", () => {
    expect(comporreNumero("fattura", 2026, 1)).toBe("IT-F-260001");
  });

  it("compone il numero nota di credito con prefisso IT-NC-", () => {
    expect(comporreNumero("nota_credito", 2026, 1)).toBe("IT-NC-260001");
  });

  it("azzera correttamente le decine di anno (es. 2005 -> 05)", () => {
    expect(comporreNumero("fattura", 2005, 42)).toBe("IT-F-050042");
  });

  it("gestisce progressivi oltre le 4 cifre senza troncare", () => {
    expect(comporreNumero("fattura", 2026, 12345)).toBe("IT-F-2612345");
  });
});
