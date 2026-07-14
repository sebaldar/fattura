import { describe, expect, it } from "vitest";
import { isValidCodiceFiscale, isValidPartitaIva } from "../../src/lib/fiscal.js";

describe("isValidPartitaIva", () => {
  it("accetta una partita IVA con checksum corretto", () => {
    expect(isValidPartitaIva("12345678903")).toBe(true);
  });

  it("rifiuta una partita IVA con checksum errato", () => {
    expect(isValidPartitaIva("12345678900")).toBe(false);
  });

  it("rifiuta formati non numerici o di lunghezza errata", () => {
    expect(isValidPartitaIva("1234567890")).toBe(false);
    expect(isValidPartitaIva("123456789034")).toBe(false);
    expect(isValidPartitaIva("1234567890A")).toBe(false);
  });
});

describe("isValidCodiceFiscale", () => {
  it("accetta un codice fiscale 16 caratteri con carattere di controllo corretto", () => {
    expect(isValidCodiceFiscale("RSSMRA85M01H501Q")).toBe(true);
  });

  it("rifiuta un codice fiscale 16 caratteri con carattere di controllo errato", () => {
    expect(isValidCodiceFiscale("RSSMRA85M01H501Z")).toBe(false);
  });

  it("è case-insensitive", () => {
    expect(isValidCodiceFiscale("rssmra85m01h501q")).toBe(true);
  });

  it("accetta un codice fiscale numerico di 11 cifre (soggetti giuridici) valido come P.IVA", () => {
    expect(isValidCodiceFiscale("12345678903")).toBe(true);
  });

  it("rifiuta un codice fiscale numerico di 11 cifre con checksum P.IVA errato", () => {
    expect(isValidCodiceFiscale("12345678900")).toBe(false);
  });

  it("rifiuta formati di lunghezza non valida", () => {
    expect(isValidCodiceFiscale("RSSMRA85M01H501")).toBe(false);
    expect(isValidCodiceFiscale("")).toBe(false);
  });
});
