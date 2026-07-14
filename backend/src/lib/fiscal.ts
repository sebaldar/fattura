/** Checksum ufficiale Partita IVA italiana (11 cifre, algoritmo pari/dispari mod 10). */
export function isValidPartitaIva(value: string): boolean {
  if (!/^\d{11}$/.test(value)) {
    return false;
  }
  const digits = value.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = digits[i]!;
    if (i % 2 === 0) {
      sum += d;
    } else {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[10];
}

const ODD_VALUES: Record<string, number> = {
  "0": 1,
  "1": 0,
  "2": 5,
  "3": 7,
  "4": 9,
  "5": 13,
  "6": 15,
  "7": 17,
  "8": 19,
  "9": 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};

const EVEN_VALUES: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
};

function codiceFiscaleCheckChar(first15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = first15[i]!;
    sum += i % 2 === 0 ? ODD_VALUES[ch]! : EVEN_VALUES[ch]!;
  }
  return String.fromCharCode(65 + (sum % 26));
}

/**
 * Valida un codice fiscale: 16 caratteri alfanumerici con carattere di controllo,
 * oppure 11 cifre numeriche per i soggetti giuridici (coincide con la P.IVA).
 */
export function isValidCodiceFiscale(value: string): boolean {
  const v = value.toUpperCase();
  if (/^\d{11}$/.test(v)) {
    return isValidPartitaIva(v);
  }
  if (!/^[A-Z0-9]{16}$/.test(v)) {
    return false;
  }
  const expected = codiceFiscaleCheckChar(v.slice(0, 15));
  return expected === v[15];
}
