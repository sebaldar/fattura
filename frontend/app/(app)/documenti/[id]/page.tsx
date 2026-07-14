"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClienteAutocomplete } from "../../../../components/ClienteAutocomplete";
import { RigaEditor } from "../../../../components/RigaEditor";
import { ApiError, downloadFile } from "../../../../lib/api";
import type { Cliente } from "../../../../lib/clienti";
import { getCliente } from "../../../../lib/clienti";
import type { Documento, Riga, RigaInput } from "../../../../lib/documenti";
import {
  addRiga,
  creaNotaCredito,
  deleteDocumento,
  deleteRiga,
  emettiDocumento,
  getDocumento,
  updateDocumento,
  updateRiga,
} from "../../../../lib/documenti";
import { formatCent } from "../../../../lib/format";

export default function DocumentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [clienteAttuale, setClienteAttuale] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rigaInModifica, setRigaInModifica] = useState<string | null>(null);
  const [aggiungiRigaAperto, setAggiungiRigaAperto] = useState(false);
  const [azioneInCorso, setAzioneInCorso] = useState(false);

  useEffect(() => {
    getDocumento(params.id)
      .then((doc) => {
        setDocumento(doc);
        return getCliente(doc.clienteId).catch(() => null);
      })
      .then(setClienteAttuale)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Documento non trovato"));
  }, [params.id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!documento) {
    return <p className="text-sm text-black/60 dark:text-white/60">Caricamento…</p>;
  }

  const isBozza = documento.stato === "bozza";

  async function handleSalvaTestata(cliente: Cliente, dataDocumento: string) {
    setError(null);
    try {
      const aggiornato = await updateDocumento(documento!.id, { clienteId: cliente.id, dataDocumento });
      setDocumento(aggiornato);
      setClienteAttuale(cliente);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Aggiornamento non riuscito");
    }
  }

  async function handleAggiungiRiga(input: RigaInput) {
    const aggiornato = await addRiga(documento!.id, input);
    setDocumento(aggiornato);
  }

  async function handleModificaRiga(rigaId: string, input: RigaInput) {
    const aggiornato = await updateRiga(documento!.id, rigaId, input);
    setDocumento(aggiornato);
    setRigaInModifica(null);
  }

  async function handleEliminaRiga(rigaId: string) {
    setError(null);
    try {
      const aggiornato = await deleteRiga(documento!.id, rigaId);
      setDocumento(aggiornato);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eliminazione riga non riuscita");
    }
  }

  async function handleEmetti() {
    setError(null);
    setAzioneInCorso(true);
    try {
      const emesso = await emettiDocumento(documento!.id);
      setDocumento(emesso);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Emissione non riuscita");
    } finally {
      setAzioneInCorso(false);
    }
  }

  async function handleEliminaBozza() {
    setError(null);
    setAzioneInCorso(true);
    try {
      await deleteDocumento(documento!.id);
      router.push("/documenti");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eliminazione non riuscita");
      setAzioneInCorso(false);
    }
  }

  async function handleCreaNotaCredito() {
    setError(null);
    setAzioneInCorso(true);
    try {
      const nc = await creaNotaCredito(documento!.id);
      router.push(`/documenti/${nc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Creazione nota di credito non riuscita");
      setAzioneInCorso(false);
    }
  }

  async function handleScaricaPdf() {
    setError(null);
    try {
      await downloadFile(`/api/documenti/${documento!.id}/pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Download PDF non riuscito");
    }
  }

  async function handleScaricaXml() {
    setError(null);
    try {
      await downloadFile(`/api/documenti/${documento!.id}/xml`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Download XML non riuscito");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {documento.numero ?? `Bozza ${documento.tipo === "fattura" ? "fattura" : "nota di credito"}`}
        </h1>
        <span className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase dark:border-white/20">
          {documento.stato}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
        <h2 className="font-medium">Testata</h2>
        {isBozza ? (
          <TestataEditabile
            cliente={clienteAttuale}
            onClienteChange={setClienteAttuale}
            dataIniziale={documento.dataDocumento}
            onSalva={handleSalvaTestata}
          />
        ) : (
          <div className="text-sm">
            <p className="font-medium">
              {(documento.clienteSnapshot?.denominazione as string | undefined) ?? "—"}
            </p>
            <p className="text-black/60 dark:text-white/60">Data documento: {documento.dataDocumento}</p>
            {documento.documentoRiferimentoId && (
              <p className="text-black/60 dark:text-white/60">
                Riferita a documento: {documento.documentoRiferimentoId}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
        <h2 className="font-medium">Righe</h2>

        {documento.righe.length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">Nessuna riga.</p>
        )}

        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {documento.righe.map((riga) =>
            rigaInModifica === riga.id ? (
              <li key={riga.id} className="py-3">
                <RigaEditor
                  initial={riga}
                  submitLabel="Salva riga"
                  onSalva={(input) => handleModificaRiga(riga.id, input)}
                  onAnnulla={() => setRigaInModifica(null)}
                />
              </li>
            ) : (
              <RigaRow
                key={riga.id}
                riga={riga}
                editabile={isBozza}
                onModifica={() => setRigaInModifica(riga.id)}
                onElimina={() => handleEliminaRiga(riga.id)}
              />
            ),
          )}
        </ul>

        {isBozza &&
          (aggiungiRigaAperto ? (
            <RigaEditor
              submitLabel="Aggiungi riga"
              onSalva={handleAggiungiRiga}
              onAnnulla={() => setAggiungiRigaAperto(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAggiungiRigaAperto(true)}
              className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
            >
              Aggiungi riga
            </button>
          ))}
      </section>

      <section className="space-y-2 rounded border border-black/10 p-4 dark:border-white/10">
        <h2 className="font-medium">Riepilogo IVA</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/60 dark:text-white/60">
              <th className="font-normal">Aliquota</th>
              <th className="font-normal">Imponibile</th>
              <th className="font-normal">IVA</th>
            </tr>
          </thead>
          <tbody>
            {documento.riepilogoIva.map((r) => (
              <tr key={r.aliquotaIvaCent}>
                <td>{(r.aliquotaIvaCent / 100).toFixed(2)}%</td>
                <td>{formatCent(r.imponibileCent)}</td>
                <td>{formatCent(r.ivaCent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end gap-6 pt-2 text-sm">
          <span>Imponibile: {formatCent(documento.totaleImponibileCent)}</span>
          <span>IVA: {formatCent(documento.totaleIvaCent)}</span>
          <span className="font-semibold">Totale: {formatCent(documento.totaleCent)}</span>
        </div>
      </section>

      <div className="flex gap-3">
        {isBozza && (
          <>
            <button
              type="button"
              disabled={azioneInCorso || documento.righe.length === 0}
              onClick={handleEmetti}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Emetti documento
            </button>
            <button
              type="button"
              disabled={azioneInCorso}
              onClick={handleEliminaBozza}
              className="rounded border border-red-600 px-4 py-2 text-sm text-red-600 disabled:opacity-50"
            >
              Elimina bozza
            </button>
          </>
        )}
        {documento.stato === "emessa" && (
          <>
            <button
              type="button"
              onClick={handleScaricaPdf}
              className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
            >
              Scarica PDF
            </button>
            <button
              type="button"
              onClick={handleScaricaXml}
              className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
            >
              Scarica XML FatturaPA
            </button>
          </>
        )}
        {documento.tipo === "fattura" && documento.stato === "emessa" && (
          <button
            type="button"
            disabled={azioneInCorso}
            onClick={handleCreaNotaCredito}
            className="rounded border border-black/20 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20"
          >
            Crea nota di credito
          </button>
        )}
      </div>
    </div>
  );
}

function RigaRow({
  riga,
  editabile,
  onModifica,
  onElimina,
}: {
  riga: Riga;
  editabile: boolean;
  onModifica: () => void;
  onElimina: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 text-sm">
      <div className="flex-1">
        <div className="font-medium">{riga.descrizione}</div>
        <div className="text-black/60 dark:text-white/60">
          {riga.quantita} × {formatCent(riga.prezzoUnitarioCent)} · {(riga.aliquotaIvaCent / 100).toFixed(2)}%
          {" · "}
          {formatCent(riga.totaleRigaCent)}
        </div>
      </div>
      {editabile && (
        <div className="flex gap-2">
          <button type="button" onClick={onModifica} className="underline">
            Modifica
          </button>
          <button type="button" onClick={onElimina} className="text-red-600 underline">
            Elimina
          </button>
        </div>
      )}
    </li>
  );
}

function TestataEditabile({
  cliente,
  onClienteChange,
  dataIniziale,
  onSalva,
}: {
  cliente: Cliente | null;
  onClienteChange: (cliente: Cliente) => void;
  dataIniziale: string;
  onSalva: (cliente: Cliente, dataDocumento: string) => Promise<void>;
}) {
  const [dataDocumento, setDataDocumento] = useState(dataIniziale);
  const [salvataggio, setSalvataggio] = useState(false);

  return (
    <div className="space-y-3">
      <ClienteAutocomplete value={cliente} onChange={onClienteChange} />
      <div>
        <label className="block text-sm font-medium" htmlFor="data-documento-edit">
          Data documento
        </label>
        <input
          id="data-documento-edit"
          type="date"
          value={dataDocumento}
          onChange={(e) => setDataDocumento(e.target.value)}
          className="mt-1 w-full max-w-xs rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>
      <button
        type="button"
        disabled={!cliente || salvataggio}
        onClick={async () => {
          if (!cliente) return;
          setSalvataggio(true);
          await onSalva(cliente, dataDocumento);
          setSalvataggio(false);
        }}
        className="rounded border border-black/20 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {salvataggio ? "Salvataggio…" : "Salva testata"}
      </button>
    </div>
  );
}
