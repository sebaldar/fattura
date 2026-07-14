import { describe, expect, it } from "vitest";
import { scorporaIva } from "../../src/legacy/scorporo.js";

describe("scorporaIva", () => {
  it("scorpora correttamente aliquota 22%", () => {
    expect(scorporaIva(1220, 2200)).toBe(1000);
  });

  it("scorpora correttamente aliquota 10%", () => {
    expect(scorporaIva(1100, 1000)).toBe(1000);
  });

  it("scorpora correttamente aliquota 4%", () => {
    expect(scorporaIva(1040, 400)).toBe(1000);
  });

  it("con aliquota 0% (esente/non imponibile) il prezzo resta invariato", () => {
    expect(scorporaIva(1000, 0)).toBe(1000);
  });

  it("arrotonda correttamente quando la divisione non è esatta", () => {
    // 1000 / 1.22 = 819.672... -> 820
    expect(scorporaIva(1000, 2200)).toBe(820);
    // 999 / 1.22 = 818.852... -> 819
    expect(scorporaIva(999, 2200)).toBe(819);
  });
});
