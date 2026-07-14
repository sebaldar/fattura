"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import type { Riga, RigaInput } from "../lib/documenti";
import type { AliquotaLegacy } from "../lib/legacy";
import { cercaMerceByEan, listaAliquote } from "../lib/legacy";
import { BarcodeScanner } from "./BarcodeScanner";

interface FormRiga {
  codiceFornitore: string;
  codiceMerce: string;
  codiceEan: string;
  descrizione: string;
  codiceIva: string;
  aliquotaIvaCent: string;
  natura: string;
  quantita: string;
  prezzoUnitarioEuro: string;
}

const VUOTO: FormRiga = {
  codiceFornitore: "",
  codiceMerce: "",
  codiceEan: "",
  descrizione: "",
  codiceIva: "",
  aliquotaIvaCent: "",
  natura: "",
  quantita: "1",
  prezzoUnitarioEuro: "",
};

function daRiga(riga: Riga): FormRiga {
  return {
    codiceFornitore: riga.codiceFornitore ?? "",
    codiceMerce: riga.codiceMerce ?? "",
    codiceEan: riga.codiceEan ?? "",
    descrizione: riga.descrizione,
    codiceIva: riga.codiceIva.trim(),
    aliquotaIvaCent: String(riga.aliquotaIvaCent),
    natura: riga.natura ?? "",
    quantita: riga.quantita,
    prezzoUnitarioEuro: (riga.prezzoUnitarioCent / 100).toFixed(2),
  };
}

export interface RigaEditorProps {
  initial?: Riga;
  submitLabel: string;
  onSalva: (input: RigaInput) => Promise<void>;
  onAnnulla?: () => void;
}

export function RigaEditor({ initial, submitLabel, onSalva, onAnnulla }: RigaEditorProps) {
  const [form, setForm] = useState<FormRiga>(() => (initial ? daRiga(initial) : VUOTO));
  const [aliquote, setAliquote] = useState<AliquotaLegacy[] | null>(null);
  const [aliquoteNonDisponibili, setAliquoteNonDisponibili] = useState(false);
  const [scannerAttivo, setScannerAttivo] = useState(false);
  const [messaggioLookup, setMessaggioLookup] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  useEffect(() => {
    listaAliquote()
      .then(setAliquote)
      .catch(() => setAliquoteNonDisponibili(true));
  }, []);

  function handle(name: keyof FormRiga, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function cercaEan(ean: string) {
    setMessaggioLookup("Ricerca nel listino in corso…");
    try {
      const merce = await cercaMerceByEan(ean);
      setForm((prev) => ({
        ...prev,
        codiceFornitore: merce.codiceFornitore,
        codiceMerce: merce.codiceMerce,
        codiceEan: ean,
        descrizione: merce.descrizione,
        codiceIva: merce.codiceIva.trim(),
        aliquotaIvaCent: String(merce.aliquotaIvaCent),
        natura: merce.natura ?? "",
        prezzoUnitarioEuro: (merce.prezzoUnitarioCent / 100).toFixed(2),
      }));
      setMessaggioLookup("Riga precompilata dal listino: verifica i dati prima di confermare.");
    } catch (err) {
      setForm((prev) => ({ ...prev, codiceEan: ean }));
      if (err instanceof ApiError && err.status === 404) {
        setMessaggioLookup("EAN non trovato nel listino: inserisci i dati manualmente.");
      } else {
        setMessaggioLookup("Listino non raggiungibile: inserisci i dati manualmente.");
      }
    }
  }

  function handleAliquotaChange(codice: string) {
    const trovata = aliquote?.find((a) => a.codice === codice);
    setForm((prev) => ({
      ...prev,
      codiceIva: codice,
      aliquotaIvaCent: trovata ? String(trovata.aliquotaIvaCent) : prev.aliquotaIvaCent,
      natura: trovata?.natura ?? "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    const quantitaNum = Number(form.quantita.replace(",", "."));
    const prezzoCent = Math.round(Number(form.prezzoUnitarioEuro.replace(",", ".")) * 100);
    const aliquotaCent = Number(form.aliquotaIvaCent);

    if (
      !form.descrizione.trim() ||
      !form.codiceIva.trim() ||
      !Number.isFinite(quantitaNum) ||
      quantitaNum <= 0 ||
      !Number.isFinite(prezzoCent) ||
      !Number.isFinite(aliquotaCent)
    ) {
      setErrore("Compila tutti i campi obbligatori con valori validi.");
      return;
    }

    setSalvataggio(true);
    try {
      await onSalva({
        codiceFornitore: form.codiceFornitore || null,
        codiceMerce: form.codiceMerce || null,
        codiceEan: form.codiceEan || null,
        descrizione: form.descrizione.trim(),
        codiceIva: form.codiceIva.trim(),
        aliquotaIvaCent: aliquotaCent,
        natura: form.natura || null,
        quantita: quantitaNum.toFixed(2),
        prezzoUnitarioCent: prezzoCent,
      });
      if (!initial) {
        setForm(VUOTO);
        setMessaggioLookup(null);
      }
    } catch (err) {
      setErrore(err instanceof ApiError ? err.message : "Salvataggio riga non riuscito");
    } finally {
      setSalvataggio(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-black/10 p-3 dark:border-white/10">
      {!initial && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerAttivo((v) => !v)}
            className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
          >
            {scannerAttivo ? "Chiudi scanner" : "Scansiona EAN"}
          </button>
          <input
            placeholder="oppure inserisci EAN manualmente"
            className="flex-1 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
            value={form.codiceEan}
            onChange={(e) => handle("codiceEan", e.target.value)}
            onBlur={(e) => {
              if (e.target.value.trim()) void cercaEan(e.target.value.trim());
            }}
          />
        </div>
      )}

      {scannerAttivo && (
        <BarcodeScanner
          onDetected={(codice) => {
            setScannerAttivo(false);
            void cercaEan(codice);
          }}
          onClose={() => setScannerAttivo(false)}
        />
      )}

      {messaggioLookup && <p className="text-sm text-black/70 dark:text-white/70">{messaggioLookup}</p>}

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium" htmlFor="riga-descrizione">
            Descrizione *
          </label>
          <input
            id="riga-descrizione"
            required
            value={form.descrizione}
            onChange={(e) => handle("descrizione", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div className="col-span-2">
          <span className="block text-sm font-medium">Aliquota IVA *</span>
          {aliquote && aliquote.length > 0 ? (
            <select
              required
              value={form.codiceIva}
              onChange={(e) => handleAliquotaChange(e.target.value)}
              className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            >
              <option value="" disabled>
                Seleziona aliquota…
              </option>
              {aliquote.map((a) => (
                <option key={a.codice} value={a.codice}>
                  {(a.aliquotaIvaCent / 100).toFixed(2)}% — {a.descrizione}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input
                placeholder="Codice IVA"
                required
                value={form.codiceIva}
                onChange={(e) => handle("codiceIva", e.target.value)}
                className="rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              />
              <input
                placeholder="Aliquota (es. 2200 = 22,00%)"
                required
                inputMode="numeric"
                value={form.aliquotaIvaCent}
                onChange={(e) => handle("aliquotaIvaCent", e.target.value)}
                className="rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              />
            </div>
          )}
          {aliquoteNonDisponibili && (
            <p className="mt-1 text-xs text-amber-600">
              Elenco aliquote non disponibile: inserisci codice e aliquota manualmente.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="riga-quantita">
            Quantità *
          </label>
          <input
            id="riga-quantita"
            required
            inputMode="decimal"
            value={form.quantita}
            onChange={(e) => handle("quantita", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="riga-prezzo">
            Prezzo unitario (€) *
          </label>
          <input
            id="riga-prezzo"
            required
            inputMode="decimal"
            value={form.prezzoUnitarioEuro}
            onChange={(e) => handle("prezzoUnitarioEuro", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        {errore && <p className="col-span-2 text-sm text-red-600">{errore}</p>}

        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={salvataggio}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {salvataggio ? "Salvataggio…" : submitLabel}
          </button>
          {onAnnulla && (
            <button
              type="button"
              onClick={onAnnulla}
              className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
            >
              Annulla
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
