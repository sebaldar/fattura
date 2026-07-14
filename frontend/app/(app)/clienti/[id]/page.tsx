"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClienteForm } from "../../../../components/ClienteForm";
import { ApiError } from "../../../../lib/api";
import type { Cliente } from "../../../../lib/clienti";
import { getCliente, updateCliente } from "../../../../lib/clienti";

export default function ModificaClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCliente(params.id)
      .then(setCliente)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Cliente non trovato"));
  }, [params.id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!cliente) {
    return <p className="text-sm text-black/60 dark:text-white/60">Caricamento…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{cliente.denominazione}</h1>
      <ClienteForm
        initial={cliente}
        submitLabel="Salva modifiche"
        onSubmit={async (input) => {
          const aggiornato = await updateCliente(cliente.id, input);
          setCliente(aggiornato);
          router.refresh();
        }}
      />
    </div>
  );
}
