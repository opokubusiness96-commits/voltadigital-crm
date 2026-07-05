import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Users, CheckSquare, Receipt, TrendingUp } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { isAgencyUser } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { Card, PriorityBadge, InvoiceStatusBadge } from "@/components/cockpit/ui";
import { formatEUR } from "@/lib/utils";
import {
  CLIENTS,
  TASKS,
  INVOICES,
  AD_PERFORMANCE,
  CAL_EVENTS,
  NOTES,
  PIPELINE_BY_CLIENT,
  FUNNEL_LABELS,
  FUNNEL_TONE,
  TODAY,
  fmtDate,
} from "@/lib/mock/agency";

export const dynamic = "force-dynamic";

export default async function KundeDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");
  // Agentur-Cockpit: nur Volta-Org — Kunden-Accounts zu ihrem eigenen Dashboard.
  if (!(await isAgencyUser())) redirect("/dashboard");

  const client = CLIENTS.find((c) => c.slug === slug);
  if (!client) return notFound();

  const pipe = PIPELINE_BY_CLIENT[slug] ?? { leads: 0, hot: 0, stages: [0, 0, 0, 0] };
  const tasks = TASKS.filter((t) => t.client === slug && !t.done).sort((a, b) => (a.due < b.due ? -1 : 1));
  const invoices = INVOICES.filter((i) => i.client === slug);
  const openInvoices = invoices.filter((i) => i.status !== "bezahlt");
  const ads = AD_PERFORMANCE.filter((a) => a.client === slug);
  const events = CAL_EVENTS.filter((e) => e.client === slug && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const notes = NOTES.filter((n) => n.client === slug);
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const avgRoas = ads.length ? ads.reduce((s, a) => s + a.roas, 0) / ads.length : 0;
  const openInvoiceSum = openInvoices.reduce((s, i) => s + i.amount, 0);
  const funnelTotal = pipe.stages.reduce((a, s) => a + s, 0) || 1;

  const KPIS = [
    { label: "Leads", value: String(pipe.leads), sub: `${pipe.hot} hot`, Icon: Users },
    { label: "Offene Aufgaben", value: String(tasks.length), sub: "zu erledigen", Icon: CheckSquare },
    { label: "Offene Rechnungen", value: formatEUR(openInvoiceSum), sub: `${openInvoices.length} Rechnung(en)`, Icon: Receipt, accent: openInvoiceSum > 0 },
    { label: "ROAS", value: ads.length ? `${avgRoas.toFixed(1)}×` : "—", sub: `${formatEUR(totalSpend)} Spend`, Icon: TrendingUp },
  ];

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Zurück + Kunden-Kopf */}
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] mb-4">
          <ArrowLeft className="w-4 h-4" /> Übersicht
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-accent)] mb-2">Kunden-Dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-[color:var(--color-muted)] mt-1">
              {client.type}
              {client.mrr ? ` · ${formatEUR(client.mrr)} / Monat` : ""} · Status: {client.status}
            </p>
          </div>
          <Link href="/board" className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-4 py-2 text-sm">
            Zur Pipeline <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {KPIS.map((k) => (
            <Card key={k.label} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[color:var(--color-muted)]">{k.label}</span>
                <k.Icon className="w-4 h-4 text-[color:var(--color-accent)]" />
              </div>
              <div className={`text-3xl font-bold font-display ${k.accent ? "text-[color:var(--color-accent)]" : ""}`}>{k.value}</div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Pipeline (Funnel) */}
        <Card className="p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold tracking-tight">Pipeline</h2>
            <Link href="/board" className="text-xs text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-2)] flex items-center gap-1">
              Öffnen <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
            {pipe.stages.map((count, i) => (
              <div key={i} style={{ width: `${(count / funnelTotal) * 100}%`, background: FUNNEL_TONE[i] }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
            {pipe.stages.map((count, i) => (
              <span key={i} className="text-xs text-[color:var(--color-muted)] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: FUNNEL_TONE[i] }} />
                {FUNNEL_LABELS[i]} <span className="text-[color:var(--color-text)]">{count}</span>
              </span>
            ))}
          </div>
        </Card>

        {/* Bento: Aufgaben · Termine · Rechnungen · Notizen */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card className="p-5">
            <h2 className="text-base font-semibold tracking-tight mb-3">Aufgaben</h2>
            <div className="divide-y divide-[color:var(--color-border)]">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <div className="flex-1 min-w-0 text-sm truncate">{t.title}</div>
                  <PriorityBadge priority={t.priority} />
                  <span className="text-xs text-[color:var(--color-muted)] tabular-nums shrink-0 w-12 text-right">{fmtDate(t.due)}</span>
                </div>
              ))}
              {tasks.length === 0 && <p className="text-sm text-[color:var(--color-muted)] py-2">Keine offenen Aufgaben.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold tracking-tight mb-3">Anstehende Termine</h2>
            <div className="divide-y divide-[color:var(--color-border)]">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.type === "deadline" ? "transparent" : "var(--color-accent)", border: e.type === "deadline" ? "1px solid var(--color-muted)" : "none" }} />
                  <div className="flex-1 min-w-0 text-sm truncate">{e.title}</div>
                  <span className="text-xs text-[color:var(--color-muted)] tabular-nums shrink-0">
                    {fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}
                  </span>
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-[color:var(--color-muted)] py-2">Keine Termine.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold tracking-tight mb-3">Rechnungen</h2>
            <div className="divide-y divide-[color:var(--color-border)]">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-[color:var(--color-muted)] tabular-nums w-16 shrink-0">{inv.number}</span>
                  <span className="flex-1" />
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="tabular-nums w-20 text-right shrink-0">{formatEUR(inv.amount)}</span>
                </div>
              ))}
              {invoices.length === 0 && <p className="text-sm text-[color:var(--color-muted)] py-2">Keine Rechnungen.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold tracking-tight mb-3">Notizen</h2>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm leading-snug">
                  {n.body}
                </div>
              ))}
              {notes.length === 0 && <p className="text-sm text-[color:var(--color-muted)] py-2">Keine Notizen.</p>}
            </div>
          </Card>
        </div>

        {/* Ad-Performance */}
        {ads.length > 0 && (
          <Card className="p-5">
            <h2 className="text-base font-semibold tracking-tight mb-4">Ad-Performance (30 Tage)</h2>
            <div className="space-y-3">
              {ads.map((a, i) => (
                <div key={i} className="grid grid-cols-[5rem_1fr_auto] items-center gap-4">
                  <span className="text-sm">{a.channel}</span>
                  <div className="text-xs text-[color:var(--color-muted)]">
                    {formatEUR(a.spend)} Spend · {a.leads} Leads · CPL {formatEUR(a.cpl)}
                  </div>
                  <span className="text-lg font-bold font-display text-[color:var(--color-accent)]">{a.roas.toFixed(1)}×</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
