"use client";

import { useEffect, useState, useTransition } from "react";
import { Pin, Trash2 } from "lucide-react";
import type { TeamNote } from "@/lib/team/types";
import { createNote, deleteNote, toggleNotePin } from "@/lib/team/actions";

// Team-Pinnwand auf dem Kunden-Dashboard: Notizen anlegen, anpinnen, löschen.
export function NoteBoard({ initial }: { initial: TeamNote[] }) {
  const [notes, setNotes] = useState<TeamNote[]>(initial);
  useEffect(() => setNotes(initial), [initial]);

  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await createNote(body);
      if (!res.ok) setError(res.error);
      else setText("");
    });
  }

  function pin(note: TeamNote) {
    const before = notes;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
    startTransition(async () => {
      const res = await toggleNotePin(note.id, !note.pinned);
      if (!res.ok) {
        setError(res.error);
        setNotes(before);
      }
    });
  }

  function remove(note: TeamNote) {
    const before = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    startTransition(async () => {
      const res = await deleteNote(note.id);
      if (!res.ok) {
        setError(res.error);
        setNotes(before);
      }
    });
  }

  const sorted = [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at),
  );

  return (
    <div>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Notiz fürs Team…"
          className="flex-1 min-w-0 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-3 py-2 text-sm disabled:opacity-50"
        >
          +
        </button>
      </form>
      {error && <p className="mb-2 text-sm text-[color:var(--color-accent)]">{error}</p>}
      <div className="space-y-2">
        {sorted.slice(0, 8).map((n) => (
          <div
            key={n.id}
            className="group rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 flex items-start gap-2"
          >
            <div className="flex-1 min-w-0 text-sm leading-snug whitespace-pre-wrap break-words">{n.body}</div>
            <button
              onClick={() => pin(n)}
              aria-label={n.pinned ? "Notiz lösen" : "Notiz anpinnen"}
              className={`shrink-0 transition ${
                n.pinned
                  ? "text-[color:var(--color-accent)]"
                  : "opacity-0 group-hover:opacity-100 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => remove(n)}
              aria-label="Notiz löschen"
              className="shrink-0 opacity-0 group-hover:opacity-100 text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-[color:var(--color-muted)]">Noch keine Notizen.</p>
        )}
      </div>
    </div>
  );
}
