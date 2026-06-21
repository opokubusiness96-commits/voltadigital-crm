"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { restoreLead, purgeLead } from "@/lib/crm/leadActions";

export function TrashRow({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRestore() {
    setError(null);
    startTransition(async () => {
      const res = await restoreLead(leadId);
      if (!res.ok) setError(res.error);
    });
  }

  function onPurge() {
    if (!window.confirm(`„${leadName}“ ENDGÜLTIG löschen? Kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await purgeLead(leadId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {error && (
        <span className="text-[10px] text-[color:var(--color-red)] mr-1.5">{error}</span>
      )}
      <button
        type="button"
        onClick={onRestore}
        disabled={pending}
        title="Wiederherstellen"
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-[color:var(--color-border)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50"
      >
        <RotateCcw className="w-3 h-3" />
        Wiederherstellen
      </button>
      <button
        type="button"
        onClick={onPurge}
        disabled={pending}
        title="Endgültig löschen"
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-[color:var(--color-red)]/30 text-[color:var(--color-red)] hover:bg-[color:var(--color-red)]/10 disabled:opacity-50"
      >
        <Trash2 className="w-3 h-3" />
        Endgültig
      </button>
    </div>
  );
}
