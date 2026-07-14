"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, me } from "../../lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    me()
      .then((res) => setEmail(res.email))
      .catch(() => router.replace("/login"))
      .finally(() => setChecking(false));
  }, [router]);

  async function handleLogout() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-black/60 dark:text-white/60">Verifica sessione…</p>
      </main>
    );
  }

  if (!email) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="font-semibold">
            Fatturazione
          </Link>
          <Link href="/dashboard" className="text-sm text-black/70 hover:underline dark:text-white/70">
            Dashboard
          </Link>
          <Link href="/clienti" className="text-sm text-black/70 hover:underline dark:text-white/70">
            Clienti
          </Link>
          <Link href="/documenti" className="text-sm text-black/70 hover:underline dark:text-white/70">
            Documenti
          </Link>
          <Link href="/impostazioni" className="text-sm text-black/70 hover:underline dark:text-white/70">
            Impostazioni
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-black/60 dark:text-white/60">{email}</span>
          <button type="button" onClick={handleLogout} className="underline">
            Esci
          </button>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
