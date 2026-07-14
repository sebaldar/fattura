import { describe, expect, it } from "vitest";
import { calcolaTotaleRiga, calcolaTotali } from "../../src/documenti/totali.js";

describe("calcolaTotaleRiga", () => {
  it("moltiplica quantità per prezzo unitario e arrotonda", () => {
    expect(calcolaTotaleRiga(2, 1000)).toBe(2000);
    expect(calcolaTotaleRiga(1.5, 999)).toBe(1499); // 1498.5 -> round half up -> 1499
    expect(calcolaTotaleRiga(3, 333)).toBe(999);
  });
});

describe("calcolaTotali", () => {
  it("raggruppa l'IVA per aliquota sull'imponibile aggregato, non riga per riga", () => {
    // Due righe alla stessa aliquota 22%: l'IVA va calcolata sul totale aggregato (2000),
    // non sommando l'IVA arrotondata di ogni singola riga.
    const totali = calcolaTotali([
      { aliquotaIvaCent: 2200, totaleRigaCent: 1000 },
      { aliquotaIvaCent: 2200, totaleRigaCent: 1000 },
    ]);
    expect(totali.totaleImponibileCent).toBe(2000);
    expect(totali.riepilogoIva).toEqual([{ aliquotaIvaCent: 2200, imponibileCent: 2000, ivaCent: 440 }]);
    expect(totali.totaleIvaCent).toBe(440);
    expect(totali.totaleCent).toBe(2440);
  });

  it("gestisce aliquote multiple con arrotondamento half-up indipendente per gruppo", () => {
    const totali = calcolaTotali([
      { aliquotaIvaCent: 2200, totaleRigaCent: 1000 }, // iva 220.0 -> 220
      { aliquotaIvaCent: 1000, totaleRigaCent: 999 }, // iva 99.9 -> 100
      { aliquotaIvaCent: 0, totaleRigaCent: 500 }, // esente, iva 0
    ]);
    expect(totali.riepilogoIva).toEqual([
      { aliquotaIvaCent: 0, imponibileCent: 500, ivaCent: 0 },
      { aliquotaIvaCent: 1000, imponibileCent: 999, ivaCent: 100 },
      { aliquotaIvaCent: 2200, imponibileCent: 1000, ivaCent: 220 },
    ]);
    expect(totali.totaleImponibileCent).toBe(500 + 999 + 1000);
    expect(totali.totaleIvaCent).toBe(0 + 100 + 220);
    expect(totali.totaleCent).toBe(totali.totaleImponibileCent + totali.totaleIvaCent);
  });

  it("ritorna totali a zero per un documento senza righe", () => {
    const totali = calcolaTotali([]);
    expect(totali).toEqual({ totaleImponibileCent: 0, totaleIvaCent: 0, totaleCent: 0, riepilogoIva: [] });
  });
});
