"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import type { Documento } from "../../../lib/documenti";
import { listDocumenti } from "../../../lib/documenti";
import { formatCent } from "../../../lib/format";

interface Riepilogo {
  numeroFattureEmesse: number;
  numeroNoteCreditoEmesse: number;
  totaleFattureCent: number;
  totaleNoteCreditoCent: number;
}

function calcolaRiepilogo(documenti: Documento[]): Riepilogo {
  const emessi = documenti.filter((d) => d.stato === "emessa");
  const fatture = emessi.filter((d) => d.tipo === "fattura");
  const noteCredito = emessi.filter((d) => d.tipo === "nota_credito");
  return {
    numeroFattureEmesse: fatture.length,
    numeroNoteCreditoEmesse: noteCredito.length,
    totaleFattureCent: fatture.reduce((somma, d) => somma + d.totaleCent, 0),
    totaleNoteCreditoCent: noteCredito.reduce((somma, d) => somma + d.totaleCent, 0),
  };
}

export default function DashboardPage() {
  const annoCorrente = new Date().getFullYear();
  const [documenti, setDocumenti] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDocumenti({ anno: annoCorrente })
      .then(setDocumenti)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Errore di caricamento"));
  }, [annoCorrente]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!documenti) {
    return <p className="text-sm text-black/60 dark:text-white/60">Caricamento…</p>;
  }

  const riepilogo = calcolaRiepilogo(documenti);
  const ultimi = [...documenti]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard {annoCorrente}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded border border-black/10 p-4 dark:border-white/10">
          <div className="text-xs text-black/60 dark:text-white/60">Fatture emesse</div>
          <div className="text-2xl font-semibold">{riepilogo.numeroFattureEmesse}</div>
        </div>
        <div className="rounded border border-black/10 p-4 dark:border-white/10">
          <div className="text-xs text-black/60 dark:text-white/60">Totale fatturato</div>
          <div className="text-2xl font-semibold">{formatCent(riepilogo.totaleFattureCent)}</div>
        </div>
        <div className="rounded border border-black/10 p-4 dark:border-white/10">
          <div className="text-xs text-black/60 dark:text-white/60">Note di credito emesse</div>
          <div className="text-2xl font-semibold">{riepilogo.numeroNoteCreditoEmesse}</div>
        </div>
        <div className="rounded border border-black/10 p-4 dark:border-white/10">
          <div className="text-xs text-black/60 dark:text-white/60">Totale note di credito</div>
          <div className="text-2xl font-semibold">{formatCent(riepilogo.totaleNoteCreditoCent)}</div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Ultimi documenti</h2>
          <Link href="/documenti" className="text-sm underline">
            Vedi tutti
          </Link>
        </div>
        {ultimi.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">Nessun documento quest&apos;anno.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {ultimi.map((doc) => (
              <li key={doc.id} className="py-3">
                <Link href={`/documenti/${doc.id}`} className="flex items-center justify-between hover:underline">
                  <div>
                    <div className="font-medium">
                      {doc.numero ?? `Bozza ${doc.tipo === "fattura" ? "fattura" : "nota di credito"}`}
                    </div>
                    <div className="text-sm text-black/60 dark:text-white/60">
                      {doc.dataDocumento} · {doc.stato}
                    </div>
                  </div>
                  <div className="font-medium">{formatCent(doc.totaleCent)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
