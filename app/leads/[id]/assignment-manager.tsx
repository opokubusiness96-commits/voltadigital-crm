"use client";

import { useState, useTransition } from "react";
import type { Profile } from "@/lib/types";
import { assignUser, unassignUser } from "../actions";

export function AssignmentManager({
  leadId,
  assignedUsers,
  allProfiles,
}: {
  leadId: string;
  assignedUsers: Profile[];
  allProfiles: Profile[];
}) {
  const [users, setUsers] = useState<Profile[]>(assignedUsers);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(users.map((u) => u.id));
  const available = allProfiles.filter((p) => !assignedIds.has(p.id));

  function add(p: Profile) {
    const before = users;
    setUsers((prev) => [...prev, p]);
    setError(null);
    startTransition(async () => {
      const res = await assignUser(leadId, p.id);
      if (!res.ok) {
        setError(res.error ?? "Fehler");
        setUsers(before);
      }
    });
  }

  function remove(p: Profile) {
    const before = users;
    setUsers((prev) => prev.filter((u) => u.id !== p.id));
    setError(null);
    startTransition(async () => {
      const res = await unassignUser(leadId, p.id);
      if (!res.ok) {
        setError(res.error ?? "Fehler");
        setUsers(before);
      }
    });
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
          Zugewiesen
        </h2>
        {pending && <span className="text-xs text-[color:var(--color-muted)]">speichern…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {users.length === 0 && (
          <span className="text-sm text-[color:var(--color-muted)]">Niemand zugewiesen</span>
        )}
        {users.map((u) => {
          const label = u.display_name || u.email.split("@")[0];
          return (
            <div
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-1 py-1 border"
              style={{
                background: `${u.marker_color ?? "#666"}26`,
                borderColor: `${u.marker_color ?? "#666"}66`,
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: u.marker_color ?? "#666" }}
              >
                {u.avatar_emoji ? (
                  <span className="text-[14px] leading-none">{u.avatar_emoji}</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase text-white">
                    {label.slice(0, 2)}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium" style={{ color: u.marker_color ?? "#fff" }}>
                {label}
              </span>
              <button
                type="button"
                onClick={() => remove(u)}
                className="w-4 h-4 rounded-full bg-black/30 hover:bg-[color:var(--color-red)] text-white text-[12px] leading-none flex items-center justify-center"
                title="Zuweisung entfernen"
              >
                ×
              </button>
            </div>
          );
        })}

        {available.length > 0 && (
          <details className="relative">
            <summary className="cursor-pointer list-none inline-flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-surface-2)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-accent-fg)] text-lg leading-none border border-[color:var(--color-border)]">
              +
            </summary>
            <div className="absolute z-10 top-full mt-1 left-0 bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-md p-1 shadow-lg min-w-[180px]">
              {available.map((p) => {
                const label = p.display_name || p.email.split("@")[0];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      const det = (e.currentTarget.closest("details") as HTMLDetailsElement);
                      if (det) det.open = false;
                      add(p);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[color:var(--color-surface)] text-sm"
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: p.marker_color ?? "#666" }}
                    >
                      {p.avatar_emoji && (
                        <span className="text-[12px] leading-none">{p.avatar_emoji}</span>
                      )}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {error && <p className="text-xs text-[color:var(--color-red)] mt-2">{error}</p>}
    </div>
  );
}
