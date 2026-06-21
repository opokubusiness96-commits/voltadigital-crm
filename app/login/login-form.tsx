"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Whitelist serverseitig prüfen, bevor Supabase überhaupt angesprochen wird
      const allowed = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }).then((r) => r.json());

      if (!allowed.ok) {
        setError("Diese Email ist nicht autorisiert.");
        setLoading(false);
        return;
      }

      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Login fehlgeschlagen — Email oder Passwort prüfen.");
        setLoading(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Unbekannter Fehler. Versuche es nochmal.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
          Benutzername (Email)
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hallo@voltadigital.agency"
          className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2.5 outline-none focus:border-[color:var(--color-accent)]"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
          Passwort
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2.5 outline-none focus:border-[color:var(--color-accent)]"
        />
      </div>

      {error && (
        <p className="text-sm text-[color:var(--color-red)]">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md py-2.5 disabled:opacity-50"
      >
        {loading ? "Anmelden…" : "Anmelden"}
      </button>

      <div className="flex items-center justify-between text-xs pt-2">
        <Link
          href="/register"
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition-colors"
        >
          Account erstellen
        </Link>
        <Link
          href="/forgot-password"
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition-colors"
        >
          Passwort vergessen?
        </Link>
      </div>
    </form>
  );
}
