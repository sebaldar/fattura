"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import type { Cliente } from "../../../lib/clienti";
import { listClienti } from "../../../lib/clienti";

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      listClienti(q || undefined)
        .then(setClienti)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Errore di caricamento"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clienti</h1>
        <Link
          href="/clienti/nuovo"
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          Nuovo cliente
        </Link>
      </div>

      <input
        type="search"
        placeholder="Cerca per denominazione, P.IVA o codice fiscale…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-black/60 dark:text-white/60">Caricamento…</p>}

      {!loading && clienti.length === 0 && (
        <p className="text-sm text-black/60 dark:text-white/60">Nessun cliente trovato.</p>
      )}

      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {clienti.map((cliente) => (
          <li key={cliente.id}>
            <Link href={`/clienti/${cliente.id}`} className="flex flex-col gap-1 py-3 hover:underline">
              <span className="font-medium">{cliente.denominazione}</span>
              <span className="text-sm text-black/60 dark:text-white/60">
                {[cliente.partitaIva, cliente.codiceFiscale].filter(Boolean).join(" · ") || "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
