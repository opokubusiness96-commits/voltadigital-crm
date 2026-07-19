"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus } from "lucide-react";
import { adjustCallAttempts, sendNoShowMail } from "@/app/leads/actions";
import { MAX_CALL_ATTEMPTS } from "@/lib/types";
import { cn } from "@/lib/utils";

// Anruf-Versuche auf der Lead-Karte, direkt hinter der Telefonnummer: kompakte
// "−  N  +"-Pille (0..MAX_CALL_ATTEMPTS, Minus nimmt Fehlklicks zurück). Ab dem
// Maximum klappt der "Nicht erreicht – Mail"-Button in eine eigene Zeile darunter
// und schickt die No-Show-Vorlage (mit Simons Calendly-Link) an den Lead. Beides
// updatet optimistisch; die Karte spiegelt danach den Server-Stand.
export function CallAttemptsControl({
  leadId,
  email,
  callAttempts,
  noShowEmailSentAt,
}: {
  leadId: string;
  email: string | null;
  callAttempts: number;
  noShowEmailSentAt: string | null;
}) {
  const [attempts, setAttempts] = useState(callAttempts ?? 0);
  const [sentAt, setSentAt] = useState<string | null>(noShowEmailSentAt);
  const [adjPending, startAdj] = useTransition();
  const [mailPending, startMail] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  // Server-Props → lokal spiegeln, wenn sie sich ändern (Reload / revalidate).
  useEffect(() => setAttempts(callAttempts ?? 0), [callAttempts]);
  useEffect(() => setSentAt(noShowEmailSentAt), [noShowEmailSentAt]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const atMax = attempts >= MAX_CALL_ATTEMPTS;
  const atMin = attempts <= 0;

  function adjust(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (adjPending) return;
    const prev = attempts;
    const next = Math.max(0, Math.min(prev + (delta >= 0 ? 1 : -1), MAX_CALL_ATTEMPTS));
    if (next === prev) return;
    setAttempts(next); // optimistisch
    startAdj(async () => {
      const res = await adjustCallAttempts(leadId, delta);
      if (res.ok && typeof res.callAttempts === "number") {
        setAttempts(res.callAttempts);
      } else if (!res.ok) {
        setAttempts(prev); // Rollback
        setToast(`Fehler: ${res.error ?? "Update fehlgeschlagen"}`);
      }
    });
  }

  function onSendMail(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (mailPending || sentAt) return;
    if (!email) {
      setToast("Keine E-Mail-Adresse hinterlegt");
      return;
    }
    if (!window.confirm(`„Nicht erreicht"-Mail mit Termin-Link an ${email} senden?`)) return;
    startMail(async () => {
      const res = await sendNoShowMail(leadId);
      if (res.ok) {
        setSentAt(res.sentAt ?? new Date().toISOString());
        setToast("„Nicht erreicht\"-Mail gesendet ✓");
      } else {
        setToast(`Versand fehlgeschlagen: ${res.error ?? res.status}`);
      }
    });
  }

  return (
    <>
      {/* −  N  +  — inline direkt hinter der Telefonnummer */}
      <span
        onPointerDown={(e) => e.stopPropagation()}
        title={`Telefonische Anrufversuche: ${attempts}/${MAX_CALL_ATTEMPTS}`}
        className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-white/[0.03] px-1 py-0.5 leading-none"
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => adjust(-1, e)}
          disabled={atMin || adjPending}
          aria-label="Anrufversuch abziehen"
          className={cn(
            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-muted)] transition-transform",
            atMin ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:scale-110",
          )}
        >
          <Minus className="h-2.5 w-2.5" />
        </button>
        <span className="min-w-[1.15em] text-center text-[10px] font-bold tabular-nums text-[color:var(--color-text)]">
          {attempts}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => adjust(1, e)}
          disabled={atMax || adjPending}
          aria-label="Anrufversuch hinzufügen"
          className={cn(
            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full transition-transform",
            atMax
              ? "cursor-not-allowed bg-transparent text-[color:var(--color-muted)] opacity-30"
              : "cursor-pointer bg-[color:var(--color-accent)] text-black hover:scale-110",
          )}
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      </span>

      {/* Ab dem 4. Versuch: Mail-Button in eigener Zeile (basis-full = Zeilenumbruch) */}
      {atMax && !sentAt && (
        <span className="mt-0.5 basis-full">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onSendMail}
            disabled={mailPending || !email}
            title={
              email
                ? "Lead nicht erreicht – Mail mit Buchungslink senden"
                : "Keine E-Mail-Adresse hinterlegt"
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight transition-colors",
              email
                ? "cursor-pointer border-[color:var(--color-red)] text-[color:var(--color-red)] hover:bg-[color:var(--color-red)]/10"
                : "cursor-not-allowed border-[color:var(--color-border)] text-[color:var(--color-muted)] opacity-50",
              mailPending && "opacity-60",
            )}
          >
            ✉ Nicht erreicht – Mail
          </button>
        </span>
      )}

      {/* Nach dem Versand */}
      {sentAt && (
        <span className="mt-0.5 basis-full">
          <span
            className="inline-flex items-center gap-1 text-[10px] text-[color:var(--color-green)]"
            title="Nicht-erreicht-Mail wurde gesendet"
          >
            ✓ Mail gesendet
          </span>
        </span>
      )}

      {toast &&
        mounted &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[200] rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-2 text-sm shadow-2xl">
            {toast}
          </div>,
          document.body,
        )}
    </>
  );
}
