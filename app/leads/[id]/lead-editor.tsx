"use client";

import { useState, useTransition } from "react";
import {
  STAGES,
  STAGE_LABEL,
  LOST_STAGES,
  type Stage,
  type Lead,
  type Profile,
} from "@/lib/types";
import { updateLead } from "../actions";

export function LeadEditor({
  lead,
  profiles,
}: {
  lead: Lead;
  profiles: Profile[];
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Lead>(lead);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  function commit(patch: Partial<Lead>) {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
    startTransition(async () => {
      const res = await updateLead(lead.id, patch as never);
      if (!res.ok) setError(res.error ?? "Fehler beim Speichern");
      else setSavedTick((t) => t + 1);
    });
  }

  function handleStageChange(next: Stage) {
    if (LOST_STAGES.has(next)) {
      const reason = window.prompt(
        `Grund für "${STAGE_LABEL[next]}" — Pflicht (z.B. no_show, kein_budget, falscher_zeitpunkt):`,
        draft.lost_reason ?? "",
      );
      if (!reason) return;
      commit({ stage: next, lost_reason: reason });
    } else {
      commit({ stage: next });
    }
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
          Lead-Daten
        </h2>
        <span className="text-xs text-[color:var(--color-muted)]">
          {pending ? "speichern…" : savedTick > 0 ? "gespeichert ✓" : ""}
        </span>
      </div>

      <Row label="Stage">
        <select
          value={draft.stage}
          onChange={(e) => handleStageChange(e.target.value as Stage)}
          className="bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded px-2 py-1.5 text-sm"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Owner">
        <select
          value={draft.owner_id ?? ""}
          onChange={(e) => commit({ owner_id: e.target.value || null })}
          className="bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded px-2 py-1.5 text-sm"
        >
          <option value="">— ohne —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name || p.email}
            </option>
          ))}
        </select>
      </Row>

      <TextField
        label="Name"
        value={draft.name ?? ""}
        onCommit={(v) => commit({ name: v })}
      />
      <TextField
        label="Email"
        value={draft.email ?? ""}
        onCommit={(v) => commit({ email: v })}
        type="email"
      />
      <TextField
        label="Telefon"
        value={draft.phone ?? ""}
        onCommit={(v) => commit({ phone: v })}
      />
      <TextField
        label="Geschätzter Wert (EUR)"
        value={draft.value_estimate?.toString() ?? ""}
        onCommit={(v) =>
          commit({ value_estimate: v ? Number(v) : null })
        }
        type="number"
      />
      <TextField
        label="Quelle (manuell)"
        value={draft.source_manual ?? ""}
        onCommit={(v) => commit({ source_manual: v || null })}
      />
      {(draft.stage === "setter_lost" || draft.stage === "klarheitsgespraech_lost") && (
        <TextField
          label="Lost-Grund"
          value={draft.lost_reason ?? ""}
          onCommit={(v) => commit({ lost_reason: v || null })}
        />
      )}
      <TextArea
        label="Notizen"
        value={draft.notes ?? ""}
        onCommit={(v) => commit({ notes: v })}
      />

      <div className="text-xs text-[color:var(--color-muted)] grid grid-cols-2 gap-2 pt-2 border-t border-[color:var(--color-border)]">
        <Meta k="Source" v={draft.source} />
        <Meta k="UTM Campaign" v={draft.utm_campaign} />
        <Meta k="UTM Source" v={draft.utm_source} />
        <Meta k="UTM Medium" v={draft.utm_medium} />
      </div>

      {error && <p className="text-sm text-[color:var(--color-red)]">{error}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[color:var(--color-muted)]">{label}</span>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onCommit,
  type = "text",
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  type?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
        {label}
      </label>
      <input
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        className="w-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
        {label}
      </label>
      <textarea
        rows={3}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        className="w-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <div className="uppercase tracking-wider">{k}</div>
      <div className="text-[color:var(--color-text)]">{v || "—"}</div>
    </div>
  );
}
