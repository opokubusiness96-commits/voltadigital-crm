"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Phone } from "lucide-react";
import { requestNumberCheck } from "@/app/leads/actions";
import { cn } from "@/lib/utils";

// Button B — "Nummer prüfen": roter Kreis mit Telefonhörer auf jeder Lead-Karte.
// Klick (mit Bestätigungsdialog gegen Fehlklicks) sendet die feste Brevo-Vorlage
// an die Lead-Mail. Ohne E-Mail-Adresse: deaktiviert. Re-Send bewusst erlaubt.
export function NumberCheckButton({
  leadId,
  email,
  onSent,
}: {
  leadId: string;
  email: string | null;
  onSent: (isoTimestamp: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const disabled = !email;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || pending) return;
    if (!window.confirm(`„Nummer prüfen"-Mail an ${email} senden?`)) return;
    startTransition(async () => {
      const res = await requestNumberCheck(leadId);
      if (res.ok) {
        onSent(res.sentAt ?? new Date().toISOString());
        setToast("Nummer-Anfrage gesendet ✓");
      } else {
        setToast(`Versand fehlgeschlagen: ${res.error ?? res.status}`);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleClick}
        disabled={disabled || pending}
        aria-label="Lead telefonisch nicht erreicht / Nummer prüfen"
        title={
          disabled
            ? "Keine E-Mail-Adresse hinterlegt — Versand nicht möglich"
            : "Lead telefonisch nicht erreicht / Nummer prüfen"
        }
        className={cn(
          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-transform",
          disabled
            ? "bg-transparent border-[color:var(--color-border)] text-[color:var(--color-muted)] opacity-40 cursor-not-allowed"
            : "bg-[color:var(--color-red)] border-[color:var(--color-red)] text-white hover:scale-110 shadow cursor-pointer",
          pending && "opacity-60",
        )}
      >
        <Phone className="w-3 h-3" />
      </button>
      {toast &&
        mounted &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[200] bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-md px-4 py-2 text-sm shadow-2xl">
            {toast}
          </div>,
          document.body,
        )}
    </>
  );
}
