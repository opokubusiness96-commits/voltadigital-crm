"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(`Fehler: ${updateError.message}`);
        setLoading(false);
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setError("Unbekannter Fehler. Versuche es nochmal.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-center text-[color:var(--color-text)]">
        Passwort erfolgreich geändert. Du wirst weitergeleitet…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
          Neues Passwort (min. 8 Zeichen)
        </label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2.5 outline-none focus:border-[color:var(--color-accent)]"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
          Passwort bestätigen
        </label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {loading ? "Wird gespeichert…" : "Passwort speichern"}
      </button>

      <div className="text-center text-xs pt-2">
        <Link
          href="/login"
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition-colors"
        >
          Zurück zum Login
        </Link>
      </div>
    </form>
  );
}
