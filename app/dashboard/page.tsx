import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  Repeat,
  CheckSquare,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  StickyNote,
  CalendarDays,
  Receipt,
  BarChart3,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AGENCY_ORG_SLUG, firstNameOf, getOrgInfo } from "@/lib/org";
import { ClientDashboard } from "./client-dashboard";
import { Card, PriorityBadge, InvoiceStatusBadge } from "@/components/cockpit/ui";
import { formatEUR } from "@/lib/utils";
import {
  CLIENTS,
  TASKS,
  NOTES,
  INVOICES,
  CAL_EVENTS,
  AD_PERFORMANCE,
  PIPELINE_BY_CLIENT,
  FUNNEL_LABELS,
  FUNNEL_TONE,
  TODAY,
  financeSummary,
  taskBucket,
  clientName,
  fmtDate,
} from "@/lib/mock/agency";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");
  // Agentur-Cockpit nur für die Volta-Org — Kunden-Orgs (Nikola, Jerome, …)
  // bekommen ihr eigenes Dashboard (Umsatz, Verläufe, Produkte → Pipeline).
  const orgInfo = await getOrgInfo();
  if (!orgInfo) redirect("/board");
  const firstName = firstNameOf(orgInfo.displayName);
  if (orgInfo.slug !== AGENCY_ORG_SLUG) {
    return (
      <ClientDashboard
        email={user.email ?? ""}
        orgName={orgInfo.name}
        orgSlug={orgInfo.slug}
        firstName={firstName}
      />
    );
  }
  const email = user.email ?? "";

  const fin = financeSummary();
  const openTasks = TASKS.filter((t) => !t.done);
  const todayOverdue = openTasks
    .filter((t) => taskBucket(t.due) === "ueberfaellig" || taskBucket(t.due) === "heute")
    .sort((a, b) => (a.due < b.due ? -1 : 1));
  const upcoming = CAL_EVENTS.filter((e) => e.date >= TODAY).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"),
  );
  const openInvoices = INVOICES.filter((i) => i.status !== "bezahlt").sort((a, b) =>
    a.status === "ueberfaellig" ? -1 : b.status === "ueberfaellig" ? 1 : 0,
  );
  const pinnedNotes = NOTES.filter((n) => n.pinned);
  const maxSpend = Math.max(...AD_PERFORMANCE.map((a) => a.spend));

  const KPIS = [
    { label: "Kunden", value: String(CLIENTS.filter((c) => c.status !== "pausiert").length), sub: "aktive Accounts", Icon: Users },
    { label: "MRR", value: formatEUR(fin.mrr), sub: "wiederkehrend / Monat", Icon: Repeat },
    { label: "Offene Aufgaben", value: String(openTasks.length), sub: `${todayOverdue.length} heute / überfällig`, Icon: CheckSquare },
    { label: "Überfällig", value: formatEUR(fin.ueberfaellig), sub: "offene Rechnungen", Icon: AlertTriangle, accent: true },
  ];

  const QUICK = [
    { label: "Aufgabe", href: "/aufgaben" },
    { label: "Notiz", href: "/dashboard" },
    { label: "Rechnung", href: "/rechnungen" },
    { label: "Lead", href: "/leads/new" },
  ];

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-[1500px] px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-display text-lg font-bold tracking-tight">
              VoltaDigital<span className="text-[color:var(--color-accent)]">CRM</span>
            </Link>
            <nav className="hidden md:flex items-center gap-5 text-sm">
              <span className="text-[color:var(--color-text)]">Übersicht</span>
              <Link href="/board" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Pipeline</Link>
              <Link href="/aufgaben" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Aufgaben</Link>
              <Link href="/kalender" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Kalender</Link>
              <Link href="/rechnungen" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Rechnungen</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[color:var(--color-muted)] hidden sm:inline">{email}</span>
            <form action="/api/auth/signout" method="post">
              <button className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Logout</button>
            </form>
            <div className="w-8 h-8 rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] grid place-items-center font-semibold">D</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-8">
        {/* Begrüßung + Quick-Actions */}
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-accent)] mb-2">Volta Digital · Übersicht</p>
            <h1 className="text-3xl font-bold tracking-tight">Willkommen zurück{firstName ? `, ${firstName}` : ""}</h1>
            <p className="text-[color:var(--color-muted)] mt-1">Wähle einen Kunden für sein Dashboard — oder dein Tagesüberblick darunter.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-muted)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)] transition"
              >
                <Plus className="w-3.5 h-3.5" /> {q.label}
              </Link>
            ))}
          </div>
        </div>

        {/* KPI-Kacheln */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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

        {/* Kunden — Kachel-Ansicht, Klick → eigenes Kunden-Dashboard */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Kunden</h2>
          <span className="text-xs text-[color:var(--color-muted)]">Klick öffnet das Kunden-Dashboard</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {CLIENTS.map((c) => {
            const pipe = PIPELINE_BY_CLIENT[c.slug] ?? { leads: 0, hot: 0, stages: [0, 0, 0, 0] };
            const total = pipe.stages.reduce((a, s) => a + s, 0) || 1;
            const open = openTasks.filter((t) => t.client === c.slug).length;
            return (
              <Link
                key={c.slug}
                href={`/kunde/${c.slug}`}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 block transition hover:border-[color:var(--color-accent)] group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold group-hover:text-[color:var(--color-accent)] transition">{c.name}</div>
                    <div className="text-xs text-[color:var(--color-muted)] mt-0.5">{c.type}</div>
                  </div>
                  <StatusPill status={c.status} />
                </div>

                <div className="flex items-end gap-6 mt-4">
                  <div>
                    <div className="text-2xl font-bold font-display">{pipe.leads}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">Leads</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-display text-[color:var(--color-accent)]">{pipe.hot}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">Hot</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 ml-auto text-[color:var(--color-muted)] group-hover:text-[color:var(--color-accent)] transition" />
                </div>

                {/* Mini-Funnel */}
                <div className="mt-4">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
                    {pipe.stages.map((count, i) => (
                      <div key={i} style={{ width: `${(count / total) * 100}%`, background: FUNNEL_TONE[i] }} />
                    ))}
                  </div>
                </div>

                {/* Fußzeile: MRR · Aufgaben · Termin */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <Foot label="MRR" value={c.mrr ? formatEUR(c.mrr) : "—"} />
                  <Foot label="Aufgaben" value={String(open)} />
                  <Foot label="Termin" value={c.nextMeeting ? fmtDate(c.nextMeeting) : "—"} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Dein Tagesüberblick (über alle Kunden) */}
        <h2 className="text-xl font-semibold tracking-tight mb-4">Dein Tag</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Aufgaben */}
          <Card className="p-5">
            <WidgetHead Icon={CheckSquare} title="Aufgaben heute & überfällig" href="/aufgaben" />
            <div className="mt-3 divide-y divide-[color:var(--color-border)]">
              {todayOverdue.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: taskBucket(t.due) === "ueberfaellig" ? "var(--color-accent)" : "#C7C7CC" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.title}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">{clientName(t.client)}</div>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <span className="text-xs text-[color:var(--color-muted)] tabular-nums shrink-0 w-12 text-right">{fmtDate(t.due)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Kalender */}
          <Card className="p-5">
            <WidgetHead Icon={CalendarDays} title="Anstehende Termine" href="/kalender" />
            <div className="mt-3 divide-y divide-[color:var(--color-border)]">
              {upcoming.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.type === "deadline" ? "transparent" : "var(--color-accent)", border: e.type === "deadline" ? "1px solid var(--color-muted)" : "none" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{e.title}</div>
                    {e.client && <div className="text-xs text-[color:var(--color-muted)]">{clientName(e.client)}</div>}
                  </div>
                  <span className="text-xs text-[color:var(--color-muted)] tabular-nums shrink-0">
                    {fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Rechnungen / Finanzen */}
          <Card className="p-5">
            <WidgetHead Icon={Receipt} title="Rechnungen & Finanzen" href="/rechnungen" />
            <div className="mt-3 grid grid-cols-3 gap-2 mb-3">
              <Foot label="Offen" value={formatEUR(fin.offen)} />
              <Foot label="Überfällig" value={formatEUR(fin.ueberfaellig)} accent />
              <Foot label="Bezahlt" value={formatEUR(fin.bezahltMonat)} />
            </div>
            <div className="divide-y divide-[color:var(--color-border)]">
              {openInvoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-[color:var(--color-muted)] tabular-nums w-16 shrink-0">{inv.number}</span>
                  <span className="flex-1 min-w-0 truncate">{clientName(inv.client)}</span>
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="tabular-nums w-20 text-right shrink-0">{formatEUR(inv.amount)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Notizen */}
          <Card className="p-5">
            <WidgetHead Icon={StickyNote} title="Notizen" href="/dashboard" />
            <div className="mt-3 space-y-2">
              {pinnedNotes.map((n) => (
                <div key={n.id} className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2">
                  <div className="text-sm leading-snug">{n.body}</div>
                  {n.client && <div className="text-[10px] text-[color:var(--color-muted)] mt-1">{clientName(n.client)}</div>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Ad-Performance / Reporting */}
        <Card className="p-5">
          <WidgetHead Icon={BarChart3} title="Ad-Performance (30 Tage)" />
          <div className="mt-4 space-y-3">
            {AD_PERFORMANCE.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-center gap-4">
                <div className="min-w-0">
                  <div className="text-sm truncate">{clientName(a.client)}</div>
                  <div className="text-[10px] text-[color:var(--color-muted)]">{a.channel}</div>
                </div>
                <div>
                  <div className="h-2 w-full rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
                    <div className="h-full rounded-full bg-[color:var(--color-accent)]" style={{ width: `${(a.spend / maxSpend) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-[color:var(--color-muted)] mt-1">
                    {formatEUR(a.spend)} Spend · {a.leads} Leads · CPL {formatEUR(a.cpl)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-display text-[color:var(--color-accent)]">{a.roas.toFixed(1)}×</div>
                  <div className="text-[10px] text-[color:var(--color-muted)]">ROAS</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}

function WidgetHead({ Icon, title, href }: { Icon: React.ComponentType<{ className?: string }>; title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-[color:var(--color-accent)]" />
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-xs text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-2)] flex items-center gap-1">
          Alle <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function Foot({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-[color:var(--color-surface-2)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${accent ? "text-[color:var(--color-accent)]" : ""}`}>{value}</div>
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  aktiv: "text-[color:var(--color-accent)] border-[color:var(--color-accent)]/35",
  onboarding: "text-[color:var(--color-text)] border-white/20",
  pausiert: "text-[color:var(--color-muted)] border-white/10",
};
function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[10px] uppercase tracking-wide rounded-full border px-2 py-0.5 ${STATUS_PILL[status] ?? ""}`}>
      {status}
    </span>
  );
}
