"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Whitelist serverseitig prüfen, bevor Supabase signUp angesprochen wird
      const allowed = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }).then((r) => r.json());

      if (!allowed.ok) {
        setError("Diese Email ist nicht autorisiert. Bitte Admin kontaktieren.");
        setLoading(false);
        return;
      }

      if (password.length < 8) {
        setError("Passwort muss mindestens 8 Zeichen lang sein.");
        setLoading(false);
        return;
      }

      const supabase = getSupabaseBrowser();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(`Registrierung fehlgeschlagen: ${signUpError.message}`);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Unbekannter Fehler. Versuche es nochmal.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-[color:var(--color-text)]">
          Bestätigungs-Email gesendet an <strong>{email}</strong>.
          <br />
          Bitte Link in der Email anklicken, um den Account zu aktivieren.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-[color:var(--color-accent)] hover:underline"
        >
          Zum Login
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

      <div>
        <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
          Passwort (min. 8 Zeichen)
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

      {error && (
        <p className="text-sm text-[color:var(--color-red)]">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md py-2.5 disabled:opacity-50"
      >
        {loading ? "Account wird erstellt…" : "Account erstellen"}
      </button>

      <div className="text-center text-xs pt-2">
        <Link
          href="/login"
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition-colors"
        >
          Bereits ein Account? Anmelden
        </Link>
      </div>
    </form>
  );
}
