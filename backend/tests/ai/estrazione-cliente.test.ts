import { describe, expect, it } from "vitest";
import { estraiJson, validaCampiEstratti } from "../../src/ai/estrazione-cliente.js";

describe("estraiJson", () => {
  it("fa il parse di JSON puro", () => {
    expect(estraiJson('{"denominazione": "Mario Rossi"}')).toEqual({ denominazione: "Mario Rossi" });
  });

  it("rimuove il fence markdown ```json ... ```", () => {
    const raw = '```json\n{"denominazione": "Mario Rossi"}\n```';
    expect(estraiJson(raw)).toEqual({ denominazione: "Mario Rossi" });
  });

  it("rimuove il fence markdown generico ``` ... ```", () => {
    const raw = '```\n{"denominazione": "Mario Rossi"}\n```';
    expect(estraiJson(raw)).toEqual({ denominazione: "Mario Rossi" });
  });

  it("lancia un errore su JSON non valido", () => {
    expect(() => estraiJson("non è json")).toThrow();
  });
});

describe("validaCampiEstratti", () => {
  it("valida i campi corretti e mantiene i valori", () => {
    const { cliente, warnings } = validaCampiEstratti({
      denominazione: "Mario Rossi",
      partitaIva: "12345678903",
      codiceFiscale: null,
      indirizzo: "Via Roma 1",
      cap: "00100",
      comune: "Roma",
      provincia: "rm",
      email: "mario@example.com",
      telefono: "3331234567",
      pec: null,
      codiceSdi: null,
    });

    expect(warnings).toEqual([]);
    expect(cliente.denominazione).toBe("Mario Rossi");
    expect(cliente.partitaIva).toBe("12345678903");
    expect(cliente.provincia).toBe("RM");
    expect(cliente.codiceFiscale).toBeNull();
  });

  it("imposta a null e aggiunge un warning per i campi non validi (checksum P.IVA errato)", () => {
    const { cliente, warnings } = validaCampiEstratti({
      denominazione: "Mario Rossi",
      partitaIva: "12345678900",
    });

    expect(cliente.partitaIva).toBeNull();
    expect(warnings).toContain('Campo "partitaIva" non valido, impostato a null');
  });

  it("gestisce campi assenti o di tipo inatteso senza inventare dati", () => {
    const { cliente, warnings } = validaCampiEstratti({
      denominazione: 12345,
      cap: undefined,
    });

    expect(cliente.denominazione).toBeNull();
    expect(cliente.cap).toBeNull();
    expect(warnings).toContain('Campo "denominazione" ignorato: formato inatteso');
  });

  it("gestisce un input radice non-oggetto senza lanciare eccezioni", () => {
    const { cliente } = validaCampiEstratti("stringa qualsiasi");
    expect(cliente.denominazione).toBeNull();
    expect(cliente.partitaIva).toBeNull();
  });
});
