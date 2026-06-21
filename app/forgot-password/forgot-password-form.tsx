"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(`Fehler: ${resetError.message}`);
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch {
      setError("Unbekannter Fehler. Versuche es nochmal.");
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-[color:var(--color-text)]">
          Reset-Link gesendet an <strong>{email}</strong>.
          <br />
          Prüfe dein Postfach (auch Spam).
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-[color:var(--color-accent)] hover:underline"
        >
          Zurück zum Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
          Email
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

      {error && (
        <p className="text-sm text-[color:var(--color-red)]">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md py-2.5 disabled:opacity-50"
      >
        {loading ? "Wird gesendet…" : "Reset-Link senden"}
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
