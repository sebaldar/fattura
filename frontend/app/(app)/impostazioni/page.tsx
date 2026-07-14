"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import type { Emittente, EmittenteInput } from "../../../lib/emittente";
import { getEmittente, updateEmittente } from "../../../lib/emittente";

const REGIMI_FISCALI = [
  "RF01",
  "RF02",
  "RF04",
  "RF05",
  "RF06",
  "RF07",
  "RF08",
  "RF09",
  "RF10",
  "RF11",
  "RF12",
  "RF13",
  "RF14",
  "RF15",
  "RF16",
  "RF17",
  "RF18",
  "RF19",
];

function daEmittente(em: Emittente): EmittenteInput {
  return {
    ragioneSociale: em.ragioneSociale,
    partitaIva: em.partitaIva,
    codiceFiscale: em.codiceFiscale,
    indirizzo: em.indirizzo,
    cap: em.cap,
    comune: em.comune,
    provincia: em.provincia,
    nazione: em.nazione,
    regimeFiscale: em.regimeFiscale,
    iban: em.iban,
    email: em.email,
    telefono: em.telefono,
  };
}

export default function ImpostazioniPage() {
  const [form, setForm] = useState<EmittenteInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successo, setSuccesso] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);

  useEffect(() => {
    getEmittente()
      .then((em) => setForm(daEmittente(em)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Errore di caricamento"));
  }, []);

  function handle<K extends keyof EmittenteInput>(campo: K, valore: EmittenteInput[K]) {
    setForm((prev) => (prev ? { ...prev, [campo]: valore } : prev));
    setSuccesso(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSalvataggio(true);
    try {
      const aggiornato = await updateEmittente(form);
      setForm(daEmittente(aggiornato));
      setSuccesso(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Salvataggio non riuscito");
    } finally {
      setSalvataggio(false);
    }
  }

  if (error && !form) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!form) {
    return <p className="text-sm text-black/60 dark:text-white/60">Caricamento…</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Impostazioni emittente</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium" htmlFor="ragioneSociale">
            Ragione sociale *
          </label>
          <input
            id="ragioneSociale"
            required
            value={form.ragioneSociale}
            onChange={(e) => handle("ragioneSociale", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="partitaIva">
            Partita IVA *
          </label>
          <input
            id="partitaIva"
            required
            value={form.partitaIva}
            onChange={(e) => handle("partitaIva", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="codiceFiscale">
            Codice fiscale *
          </label>
          <input
            id="codiceFiscale"
            required
            value={form.codiceFiscale}
            onChange={(e) => handle("codiceFiscale", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium" htmlFor="indirizzo">
            Indirizzo *
          </label>
          <input
            id="indirizzo"
            required
            value={form.indirizzo}
            onChange={(e) => handle("indirizzo", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="cap">
            CAP *
          </label>
          <input
            id="cap"
            required
            value={form.cap}
            onChange={(e) => handle("cap", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="comune">
            Comune *
          </label>
          <input
            id="comune"
            required
            value={form.comune}
            onChange={(e) => handle("comune", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="provincia">
            Provincia *
          </label>
          <input
            id="provincia"
            required
            maxLength={2}
            value={form.provincia}
            onChange={(e) => handle("provincia", e.target.value.toUpperCase())}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 uppercase dark:border-white/20 dark:bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="nazione">
            Nazione *
          </label>
          <input
            id="nazione"
            required
            maxLength={2}
            value={form.nazione}
            onChange={(e) => handle("nazione", e.target.value.toUpperCase())}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 uppercase dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="regimeFiscale">
            Regime fiscale *
          </label>
          <select
            id="regimeFiscale"
            required
            value={form.regimeFiscale}
            onChange={(e) => handle("regimeFiscale", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          >
            {REGIMI_FISCALI.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="iban">
            IBAN *
          </label>
          <input
            id="iban"
            required
            value={form.iban}
            onChange={(e) => handle("iban", e.target.value.toUpperCase())}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email *
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => handle("email", e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="telefono">
            Telefono
          </label>
          <input
            id="telefono"
            value={form.telefono ?? ""}
            onChange={(e) => handle("telefono", e.target.value || null)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        {successo && <p className="col-span-2 text-sm text-green-600">Dati salvati.</p>}

        <div className="col-span-2">
          <button
            type="submit"
            disabled={salvataggio}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {salvataggio ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </form>
    </div>
  );
}
