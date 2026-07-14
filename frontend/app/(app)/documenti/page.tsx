"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import type { Documento, StatoDocumento, TipoDocumento } from "../../../lib/documenti";
import { creaNotaCredito, listDocumenti } from "../../../lib/documenti";
import { formatCent } from "../../../lib/format";

const STATI: StatoDocumento[] = ["bozza", "emessa", "annullata"];
const TIPI: TipoDocumento[] = ["fattura", "nota_credito"];

export default function DocumentiPage() {
  const router = useRouter();
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [anno, setAnno] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento | "">("");
  const [stato, setStato] = useState<StatoDocumento | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creandoNc, setCreandoNc] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      listDocumenti({
        anno: anno ? Number(anno) : undefined,
        tipo: tipo || undefined,
        stato: stato || undefined,
      })
        .then(setDocumenti)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Errore di caricamento"))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timeout);
  }, [anno, tipo, stato]);

  async function handleCreaNotaCredito(fatturaId: string) {
    setCreandoNc(fatturaId);
    try {
      const nc = await creaNotaCredito(fatturaId);
      router.push(`/documenti/${nc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Creazione nota di credito non riuscita");
      setCreandoNc(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documenti</h1>
        <Link
          href="/documenti/nuovo"
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          Nuovo documento
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="number"
          placeholder="Anno"
          value={anno}
          onChange={(e) => setAnno(e.target.value)}
          className="w-28 rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDocumento | "")}
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        >
          <option value="">Tutti i tipi</option>
          {TIPI.map((t) => (
            <option key={t} value={t}>
              {t === "fattura" ? "Fattura" : "Nota di credito"}
            </option>
          ))}
        </select>
        <select
          value={stato}
          onChange={(e) => setStato(e.target.value as StatoDocumento | "")}
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        >
          <option value="">Tutti gli stati</option>
          {STATI.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-black/60 dark:text-white/60">Caricamento…</p>}
      {!loading && documenti.length === 0 && (
        <p className="text-sm text-black/60 dark:text-white/60">Nessun documento trovato.</p>
      )}

      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {documenti.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-4 py-3">
            <Link href={`/documenti/${doc.id}`} className="flex-1 hover:underline">
              <div className="font-medium">
                {doc.numero ?? `Bozza ${doc.tipo === "fattura" ? "fattura" : "nota di credito"}`}
              </div>
              <div className="text-sm text-black/60 dark:text-white/60">
                {doc.dataDocumento} · {doc.stato} · {formatCent(doc.totaleCent)}
              </div>
            </Link>
            {doc.tipo === "fattura" && doc.stato === "emessa" && (
              <button
                type="button"
                disabled={creandoNc === doc.id}
                onClick={() => handleCreaNotaCredito(doc.id)}
                className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
              >
                {creandoNc === doc.id ? "Creazione…" : "Crea nota di credito"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
