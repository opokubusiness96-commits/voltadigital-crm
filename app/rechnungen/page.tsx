import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { isAgencyUser } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { Card, InvoiceStatusBadge } from "@/components/cockpit/ui";
import { INVOICES, clientName, fmtDate, financeSummary } from "@/lib/mock/agency";
import { formatEUR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_ORDER = { ueberfaellig: 0, offen: 1, bezahlt: 2 } as const;

export default async function RechnungenPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");
  // Agentur-Cockpit: nur Volta-Org — Kunden-Accounts direkt zu ihrer Pipeline.
  if (!(await isAgencyUser())) redirect("/board");

  const { offen, ueberfaellig, bezahltMonat, mrr } = financeSummary();
  const invoices = [...INVOICES].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.due < b.due ? -1 : 1),
  );

  const kpis = [
    { label: "Offen", value: formatEUR(offen), sub: "noch nicht bezahlt" },
    { label: "Überfällig", value: formatEUR(ueberfaellig), sub: "über Fälligkeit", accent: true },
    { label: "Bezahlt (Monat)", value: formatEUR(bezahltMonat), sub: "eingegangen" },
    { label: "MRR", value: formatEUR(mrr), sub: "wiederkehrend / Monat" },
  ];

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Rechnungen</h1>
            <p className="text-sm text-[color:var(--color-muted)]">Finanzen & offene Beträge auf einen Blick.</p>
          </div>
          <button className="bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md px-4 py-2 text-sm">
            + Rechnung
          </button>
        </div>

        {/* Finanz-KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5">
              <div className="text-sm text-[color:var(--color-muted)] mb-2">{k.label}</div>
              <div
                className={`text-2xl font-bold font-display ${
                  k.accent ? "text-[color:var(--color-accent)]" : ""
                }`}
              >
                {k.value}
              </div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Rechnungs-Tabelle */}
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Nr.</th>
                <th className="text-left px-4 py-2.5 font-medium">Kunde</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Gestellt</th>
                <th className="text-left px-4 py-2.5 font-medium">Fällig</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[color:var(--color-surface-2)]">
                  <td className="px-4 py-3 font-medium tabular-nums">{inv.number}</td>
                  <td className="px-4 py-3">{clientName(inv.client)}</td>
                  <td className="px-4 py-3 text-[color:var(--color-muted)] hidden sm:table-cell">{fmtDate(inv.issued)}</td>
                  <td className="px-4 py-3 text-[color:var(--color-muted)]">{fmtDate(inv.due)}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatEUR(inv.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
