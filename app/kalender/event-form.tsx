"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/cockpit/ui";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type TeamCategory,
} from "@/lib/team/types";
import { createEvent, deleteEvent } from "@/lib/team/actions";

export function EventForm({ defaultDate }: { defaultDate: string }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<TeamCategory>("sales");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setError(null);
    startTransition(async () => {
      const res = await createEvent({ title, date, time: time || null, category });
      if (!res.ok) setError(res.error);
      else setTitle("");
    });
  }

  return (
    <Card className="p-4 mb-6">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[220px]">
          <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
            Neuer Termin / Planung
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Content-Shooting, Kampagnen-Launch"
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
        </label>
        <label>
          <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
            Datum
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
        </label>
        <label>
          <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
            Uhrzeit
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
        </label>
        <label>
          <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
            Bereich
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TeamCategory)}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || !title.trim() || !date}
          className="rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Speichern…" : "Eintragen"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-[color:var(--color-accent)]">{error}</p>}
    </Card>
  );
}

export function DeleteEventButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(async () => void (await deleteEvent(id)))}
      disabled={pending}
      aria-label="Termin löschen"
      className="opacity-0 group-hover:opacity-100 text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition shrink-0 disabled:opacity-30"
    >
      <X className="w-3 h-3" />
    </button>
  );
}
