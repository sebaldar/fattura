"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClienteAutocomplete } from "../../../../components/ClienteAutocomplete";
import { ApiError } from "../../../../lib/api";
import type { Cliente } from "../../../../lib/clienti";
import { createDocumento } from "../../../../lib/documenti";

function oggiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NuovoDocumentoPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [dataDocumento, setDataDocumento] = useState(oggiIso());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) {
      setError("Seleziona un cliente");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const documento = await createDocumento({ clienteId: cliente.id, dataDocumento });
      router.push(`/documenti/${documento.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Creazione documento non riuscita");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Nuova fattura</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ClienteAutocomplete value={cliente} onChange={setCliente} />
        <div>
          <label className="block text-sm font-medium" htmlFor="data-documento">
            Data documento
          </label>
          <input
            id="data-documento"
            type="date"
            required
            value={dataDocumento}
            onChange={(e) => setDataDocumento(e.target.value)}
            className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Creazione…" : "Crea bozza"}
        </button>
      </form>
    </div>
  );
}
