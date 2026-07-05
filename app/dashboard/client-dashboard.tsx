import Link from "next/link";
import {
  ArrowUpRight,
  TrendingUp,
  Users,
  Trophy,
  Wallet,
  Package,
  KanbanSquare,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/cockpit/ui";
import { formatEUR } from "@/lib/utils";
import { LOST_STAGES, type Lead, type Stage } from "@/lib/types";
import { getOrgProducts } from "@/lib/products";

// Kunden-Dashboard (z. B. Nikola MDK System): Umsatz, Verläufe, Produkte und
// Absprung in die Pipeline. Datenzugriff läuft über das User-JWT — RLS liefert
// automatisch nur Leads der eigenen Org, hier ist keine org-Filterung nötig.

type MonthBucket = {
  key: string; // YYYY-MM
  label: string; // "Feb"
  revenue: number;
  newLeads: number;
  wonCount: number;
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function lastMonths(count: number): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: d.toLocaleDateString("de-DE", { month: "short" }),
      revenue: 0,
      newLeads: 0,
      wonCount: 0,
    });
  }
  return buckets;
}

export async function ClientDashboard({
  email,
  orgName,
  orgSlug,
}: {
  email: string;
  orgName: string;
  orgSlug: string;
}) {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("leads")
    .select("id, stage, value_estimate, created_at, updated_at")
    .is("trashed_at", null);
  const leads = (data ?? []) as Pick<
    Lead,
    "id" | "stage" | "value_estimate" | "created_at" | "updated_at"
  >[];

  const won = leads.filter((l) => l.stage === "won");
  const lost = leads.filter((l) => LOST_STAGES.has(l.stage as Stage));
  const revenueTotal = won.reduce((s, l) => s + Number(l.value_estimate ?? 0), 0);

  // Won-Zeitpunkt wird nicht separat gespeichert — updated_at als Näherung.
  const months = lastMonths(6);
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const l of leads) {
    const created = byKey.get(monthKey(l.created_at));
    if (created) created.newLeads += 1;
    if (l.stage === "won") {
      const wonMonth = byKey.get(monthKey(l.updated_at));
      if (wonMonth) {
        wonMonth.revenue += Number(l.value_estimate ?? 0);
        wonMonth.wonCount += 1;
      }
    }
  }
  const currentMonth = months[months.length - 1];
  const decided = won.length + lost.length;
  const winRate = decided > 0 ? Math.round((won.length / decided) * 100) : null;

  const maxRevenue = Math.max(...months.map((m) => m.revenue), 1);
  const maxLeads = Math.max(...months.map((m) => m.newLeads), 1);
  const products = getOrgProducts(orgSlug);

  const KPIS = [
    { label: "Umsatz gesamt", value: formatEUR(revenueTotal), sub: `${won.length} Abschlüsse (Won)`, Icon: Wallet, accent: true },
    { label: "Umsatz diesen Monat", value: formatEUR(currentMonth.revenue), sub: `${currentMonth.wonCount} Abschlüsse`, Icon: TrendingUp },
    { label: "Leads gesamt", value: String(leads.length), sub: `${currentMonth.newLeads} neu diesen Monat`, Icon: Users },
    { label: "Win-Rate", value: winRate === null ? "—" : `${winRate}%`, sub: `${won.length} Won · ${lost.length} Lost`, Icon: Trophy },
  ];

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Kopf + Pipeline-CTA */}
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-accent)] mb-2">
              {orgName} · Dashboard
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Willkommen zurück</h1>
            <p className="text-[color:var(--color-muted)] mt-1">
              Umsatz, Verläufe und Produkte auf einen Blick — Leads bearbeitest du in der Pipeline.
            </p>
          </div>
          <Link
            href="/board"
            className="inline-flex items-center gap-2 rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition"
          >
            <KanbanSquare className="w-4 h-4" /> Zur Pipeline <ArrowUpRight className="w-4 h-4" />
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
              <div className={`text-3xl font-bold font-display ${k.accent ? "text-[color:var(--color-accent)]" : ""}`}>
                {k.value}
              </div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Verläufe */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card className="p-5">
            <ChartHead title="Umsatzverlauf" sub="Won-Abschlüsse, letzte 6 Monate" />
            <BarRow
              months={months}
              value={(m) => m.revenue}
              max={maxRevenue}
              tone="var(--color-accent)"
              fmt={(v) => formatEUR(v)}
            />
          </Card>
          <Card className="p-5">
            <ChartHead title="Lead-Verlauf" sub="Neue Leads, letzte 6 Monate" />
            <BarRow
              months={months}
              value={(m) => m.newLeads}
              max={maxLeads}
              tone="#8A8A92"
              fmt={(v) => String(v)}
            />
          </Card>
        </div>

        {/* Produkte */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[color:var(--color-accent)]" />
            <h2 className="text-xl font-semibold tracking-tight">Produkte</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {products.map((p) => (
            <Card key={p.name} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-base font-semibold leading-snug">{p.name}</div>
                {p.badge && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full border border-[color:var(--color-accent)]/35 text-[color:var(--color-accent)] px-2 py-0.5">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-[color:var(--color-muted)] flex-1">{p.description}</p>
              <div className="mt-4 text-lg font-bold font-display text-[color:var(--color-accent)]">
                {p.price === null ? "Preis individuell" : p.price === 0 ? "Kostenlos" : formatEUR(p.price)}
              </div>
            </Card>
          ))}
          {products.length === 0 && (
            <Card className="p-5 text-sm text-[color:var(--color-muted)]">
              Noch keine Produkte hinterlegt.
            </Card>
          )}
        </div>

        {/* Abschluss-CTA */}
        <Card className="p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Leads bearbeiten</h2>
            <p className="text-sm text-[color:var(--color-muted)] mt-0.5">
              Alle Leads mit Stages, Tags und Aktivitäten findest du im Kanban-Board.
            </p>
          </div>
          <Link
            href="/board"
            className="inline-flex items-center gap-2 rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition"
          >
            Zur Pipeline <ArrowUpRight className="w-4 h-4" />
          </Link>
        </Card>
      </main>
    </>
  );
}

function ChartHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-[color:var(--color-muted)]">{sub}</p>
    </div>
  );
}

function BarRow({
  months,
  value,
  max,
  tone,
  fmt,
}: {
  months: MonthBucket[];
  value: (m: MonthBucket) => number;
  max: number;
  tone: string;
  fmt: (v: number) => string;
}) {
  return (
    <div className="grid grid-cols-6 gap-3 items-end h-40">
      {months.map((m) => {
        const v = value(m);
        const pct = Math.round((v / max) * 100);
        return (
          <div key={m.key} className="flex flex-col items-center gap-1.5 h-full justify-end" title={`${m.label}: ${fmt(v)}`}>
            <span className="text-[10px] text-[color:var(--color-muted)] tabular-nums">
              {v > 0 ? fmt(v) : ""}
            </span>
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(pct, v > 0 ? 6 : 2)}%`,
                background: v > 0 ? tone : "var(--color-surface-2)",
              }}
            />
            <span className="text-[10px] text-[color:var(--color-muted)]">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}
