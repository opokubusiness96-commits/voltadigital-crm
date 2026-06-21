// Schlichte, monochrome UI-Bausteine fürs Cockpit (nur Gold / Weiß / Grau).
import { type Priority, type InvoiceStatus, INVOICE_STATUS_LABEL, PRIORITY_LABEL } from "@/lib/mock/agency";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] ${className}`}
    >
      {children}
    </div>
  );
}

const PRIORITY_CLS: Record<Priority, string> = {
  hoch: "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/35",
  mittel: "bg-white/[0.06] text-[color:var(--color-text)] border-white/15",
  niedrig: "bg-transparent text-[color:var(--color-muted)] border-white/10",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${PRIORITY_CLS[priority]}`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: priority === "hoch" ? "var(--color-accent)" : priority === "mittel" ? "#C7C7CC" : "#6B6B72" }}
      />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const STATUS_CLS: Record<InvoiceStatus, string> = {
  ueberfaellig: "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/40",
  offen: "bg-white/[0.05] text-[color:var(--color-text)] border-white/15",
  bezahlt: "bg-transparent text-[color:var(--color-muted)] border-white/10",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[status]}`}
    >
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
