"use client";

import { useState, useTransition } from "react";
import { addNote } from "../actions";

export function NoteForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addNote(leadId, text);
      if (!res.ok) setError(res.error ?? "Fehler");
      else setText("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Notiz hinzufügen — Cmd+Enter zum Speichern"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit(e);
        }}
        rows={2}
        className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        {error && <span className="text-sm text-[color:var(--color-red)]">{error}</span>}
        <button
          disabled={pending || !text.trim()}
          className="ml-auto bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-medium rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "speichern…" : "Notiz speichern"}
        </button>
      </div>
    </form>
  );
}
