"use client";

import { useState } from "react";
import { ApiError } from "../lib/api";
import type { Cliente, ClienteInput, EstrattoCliente } from "../lib/clienti";
import { estraiClienteDaFoto } from "../lib/clienti";

type FormState = Record<keyof ClienteInput, string>;

const CAMPI_VUOTI: FormState = {
  denominazione: "",
  partitaIva: "",
  codiceFiscale: "",
  codiceSdi: "",
  pec: "",
  indirizzo: "",
  cap: "",
  comune: "",
  provincia: "",
  nazione: "IT",
  email: "",
  telefono: "",
  note: "",
};

function daCliente(cliente: Cliente): FormState {
  return {
    denominazione: cliente.denominazione,
    partitaIva: cliente.partitaIva ?? "",
    codiceFiscale: cliente.codiceFiscale ?? "",
    codiceSdi: cliente.codiceSdi ?? "",
    pec: cliente.pec ?? "",
    indirizzo: cliente.indirizzo ?? "",
    cap: cliente.cap ?? "",
    comune: cliente.comune ?? "",
    provincia: cliente.provincia ?? "",
    nazione: cliente.nazione,
    email: cliente.email ?? "",
    telefono: cliente.telefono ?? "",
    note: cliente.note ?? "",
  };
}

function daEstratto(estratto: EstrattoCliente, precedente: FormState): FormState {
  return {
    ...precedente,
    denominazione: estratto.denominazione ?? precedente.denominazione,
    partitaIva: estratto.partitaIva ?? precedente.partitaIva,
    codiceFiscale: estratto.codiceFiscale ?? precedente.codiceFiscale,
    codiceSdi: estratto.codiceSdi ?? precedente.codiceSdi,
    pec: estratto.pec ?? precedente.pec,
    indirizzo: estratto.indirizzo ?? precedente.indirizzo,
    cap: estratto.cap ?? precedente.cap,
    comune: estratto.comune ?? precedente.comune,
    provincia: estratto.provincia ?? precedente.provincia,
    email: estratto.email ?? precedente.email,
    telefono: estratto.telefono ?? precedente.telefono,
  };
}

function aInput(form: FormState): Partial<ClienteInput> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(form)) {
    out[key] = value.trim() === "" ? null : value.trim();
  }
  out.denominazione = form.denominazione.trim();
  out.nazione = form.nazione.trim() || "IT";
  return out as Partial<ClienteInput>;
}

interface CampoProps {
  label: string;
  name: keyof FormState;
  form: FormState;
  onChange: (name: keyof FormState, value: string) => void;
  required?: boolean;
  maxLength?: number;
}

function Campo({ label, name, form, onChange, required, maxLength }: CampoProps) {
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        value={form[name]}
        required={required}
        maxLength={maxLength}
        onChange={(e) => onChange(name, e.target.value)}
        className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
      />
    </div>
  );
}

export interface ClienteFormProps {
  initial?: Cliente;
  showPhotoUpload?: boolean;
  submitLabel: string;
  onSubmit: (input: Partial<ClienteInput>) => Promise<void>;
}

export function ClienteForm({ initial, showPhotoUpload, submitLabel, onSubmit }: ClienteFormProps) {
  const [form, setForm] = useState<FormState>(initial ? daCliente(initial) : CAMPI_VUOTI);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [estraendo, setEstraendo] = useState(false);

  function handleChange(name: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setWarnings([]);
    setEstraendo(true);
    try {
      const { cliente, warnings: nuoviWarning } = await estraiClienteDaFoto(file);
      setForm((prev) => daEstratto(cliente, prev));
      setWarnings(nuoviWarning);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Estrazione non riuscita");
    } finally {
      setEstraendo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(aInput(form));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Salvataggio non riuscito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {showPhotoUpload && (
        <div className="rounded border border-dashed border-black/20 p-4 dark:border-white/20">
          <label className="block text-sm font-medium" htmlFor="foto">
            Precompila da foto (biglietto da visita o testo)
          </label>
          <input
            id="foto"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            disabled={estraendo}
            className="mt-2 text-sm"
          />
          {estraendo && <p className="mt-2 text-sm text-black/60 dark:text-white/60">Estrazione in corso…</p>}
          {warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-600">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Rivedi e correggi i campi precompilati prima di confermare: nessun salvataggio automatico.
          </p>
        </div>
      )}

      <Campo label="Denominazione *" name="denominazione" form={form} onChange={handleChange} required />

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Partita IVA" name="partitaIva" form={form} onChange={handleChange} maxLength={11} />
        <Campo label="Codice fiscale" name="codiceFiscale" form={form} onChange={handleChange} maxLength={16} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Codice SDI" name="codiceSdi" form={form} onChange={handleChange} maxLength={7} />
        <Campo label="PEC" name="pec" form={form} onChange={handleChange} />
      </div>

      <Campo label="Indirizzo" name="indirizzo" form={form} onChange={handleChange} />

      <div className="grid grid-cols-4 gap-4">
        <Campo label="CAP" name="cap" form={form} onChange={handleChange} maxLength={5} />
        <div className="col-span-2">
          <Campo label="Comune" name="comune" form={form} onChange={handleChange} />
        </div>
        <Campo label="Provincia" name="provincia" form={form} onChange={handleChange} maxLength={2} />
      </div>

      <Campo label="Nazione" name="nazione" form={form} onChange={handleChange} maxLength={2} />

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Email" name="email" form={form} onChange={handleChange} />
        <Campo label="Telefono" name="telefono" form={form} onChange={handleChange} />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="note">
          Note
        </label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => handleChange("note", e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Salvataggio…" : submitLabel}
      </button>
    </form>
  );
}
