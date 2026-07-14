"use client";

import { useEffect, useState } from "react";
import type { Cliente } from "../lib/clienti";
import { listClienti } from "../lib/clienti";

export interface ClienteAutocompleteProps {
  value: Cliente | null;
  onChange: (cliente: Cliente) => void;
}

export function ClienteAutocomplete({ value, onChange }: ClienteAutocompleteProps) {
  const [q, setQ] = useState("");
  const [risultati, setRisultati] = useState<Cliente[]>([]);
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (!q) {
      return;
    }
    const timeout = setTimeout(() => {
      listClienti(q)
        .then(setRisultati)
        .catch(() => setRisultati([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium" htmlFor="cliente-autocomplete">
        Cliente
      </label>
      <input
        id="cliente-autocomplete"
        value={aperto ? q : (value?.denominazione ?? "")}
        onFocus={() => {
          setAperto(true);
          setQ("");
          setRisultati([]);
        }}
        onChange={(e) => {
          const valore = e.target.value;
          setQ(valore);
          if (!valore) setRisultati([]);
        }}
        placeholder="Cerca per denominazione, P.IVA o codice fiscale…"
        className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
      />
      {aperto && risultati.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-black/20 bg-white shadow dark:border-white/20 dark:bg-black">
          {risultati.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  onChange(cliente);
                  setAperto(false);
                  setQ("");
                }}
              >
                <div className="font-medium">{cliente.denominazione}</div>
                <div className="text-xs text-black/60 dark:text-white/60">
                  {[cliente.partitaIva, cliente.codiceFiscale].filter(Boolean).join(" · ") || "—"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
