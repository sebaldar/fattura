"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { activateTotp, login, verifyTotp } from "../../lib/auth";

type Step =
  | { kind: "credenziali" }
  | { kind: "totp-setup"; secret: string; uri: string }
  | { kind: "totp-verify" };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "credenziali" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  async function handleCredenziali(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.totpSetupRequired && res.totpSecret && res.totpUri) {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(res.totpUri);
        setQrDataUrl(dataUrl);
        setStep({ kind: "totp-setup", secret: res.totpSecret, uri: res.totpUri });
      } else {
        setStep({ kind: "totp-verify" });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  async function handleAttivaTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await activateTotp(code);
      router.push("/clienti");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificaTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyTotp(code);
      router.push("/clienti");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h1 className="text-xl font-semibold">Fatturazione</h1>

        {step.kind === "credenziali" && (
          <form onSubmit={handleCredenziali} className="space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Accesso in corso…" : "Accedi"}
            </button>
          </form>
        )}

        {step.kind === "totp-setup" && (
          <form onSubmit={handleAttivaTotp} className="space-y-4">
            <p className="text-sm">
              Primo accesso: inquadra il QR con Google Authenticator (o app compatibile), poi inserisci il
              codice a 6 cifre per attivare l&apos;autenticazione a due fattori.
            </p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR code TOTP" className="mx-auto h-48 w-48" />
            )}
            <p className="break-all text-center text-xs text-black/60 dark:text-white/60">{step.secret}</p>
            <div>
              <label className="block text-sm font-medium" htmlFor="code-setup">
                Codice a 6 cifre
              </label>
              <input
                id="code-setup"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-center tracking-widest dark:border-white/20 dark:bg-transparent"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Attivazione…" : "Attiva e accedi"}
            </button>
          </form>
        )}

        {step.kind === "totp-verify" && (
          <form onSubmit={handleVerificaTotp} className="space-y-4">
            <p className="text-sm">Inserisci il codice a 6 cifre dell&apos;app authenticator.</p>
            <div>
              <label className="block text-sm font-medium" htmlFor="code-verify">
                Codice a 6 cifre
              </label>
              <input
                id="code-verify"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-center tracking-widest dark:border-white/20 dark:bg-transparent"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Verifica…" : "Verifica e accedi"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
