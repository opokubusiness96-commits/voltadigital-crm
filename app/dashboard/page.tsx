import Link from "next/link";
import {
  Users,
  GitBranch,
  CheckSquare,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Briefcase,
  Circle,
} from "lucide-react";

/*
  Volta-Digital-Plattform-Dashboard (FRONTEND, Mock-Daten).
  Gesamtüberblick: Kunden-Pipelines als Kachel-/Gitter-Ansicht (anklickbar),
  plus Projekte und Aufgaben. Design wie die Landing Page (dunkel + Gold).
  Echte Daten + Auth folgen mit dem Supabase-Backend; aktuell statische Mocks.
*/

// --- Mock-Daten (werden später aus Supabase pro Organisation geladen) ---
const STATS = [
  { label: "Kunden", value: "3", icon: Users, sub: "aktive Accounts" },
  { label: "Pipelines", value: "3", icon: GitBranch, sub: "in Bearbeitung" },
  { label: "Offene Aufgaben", value: "7", icon: CheckSquare, sub: "diese Woche" },
  { label: "Leads (7 Tage)", value: "24", icon: TrendingUp, sub: "+18% ggü. Vorwoche" },
];

type Pipeline = {
  slug: string;
  name: string;
  type: string;
  leads: number;
  hot: number;
  stages: { label: string; count: number; tone: string }[];
};

const PIPELINES: Pipeline[] = [
  {
    slug: "jerome",
    name: "Jerome Deres Coaching",
    type: "Coaching",
    leads: 42,
    hot: 6,
    stages: [
      { label: "Neu", count: 14, tone: "var(--color-blue)" },
      { label: "Call", count: 11, tone: "var(--color-purple)" },
      { label: "Angebot", count: 9, tone: "var(--color-amber)" },
      { label: "Kunde", count: 8, tone: "var(--color-green)" },
    ],
  },
  {
    slug: "heidi",
    name: "Heidi — The Salon",
    type: "Beauty / Salon",
    leads: 27,
    hot: 4,
    stages: [
      { label: "Neu", count: 10, tone: "var(--color-blue)" },
      { label: "Termin", count: 8, tone: "var(--color-purple)" },
      { label: "Angebot", count: 5, tone: "var(--color-amber)" },
      { label: "Kunde", count: 4, tone: "var(--color-green)" },
    ],
  },
  {
    slug: "volta",
    name: "Volta Digital — Inbound",
    type: "Agentur",
    leads: 18,
    hot: 3,
    stages: [
      { label: "Neu", count: 7, tone: "var(--color-blue)" },
      { label: "Call", count: 5, tone: "var(--color-purple)" },
      { label: "Angebot", count: 4, tone: "var(--color-amber)" },
      { label: "Kunde", count: 2, tone: "var(--color-green)" },
    ],
  },
];

const PROJECTS = [
  { name: "Jerome — Funnel Relaunch", client: "Jerome Coaching", status: "Aktiv", progress: 70 },
  { name: "Heidi — Meta Ads Setup", client: "Heidi Salon", status: "Aktiv", progress: 40 },
  { name: "Volta — CRM Rollout", client: "Intern", status: "In Arbeit", progress: 25 },
];

const TASKS = [
  { title: "Angebot an Heidi nachfassen", due: "Heute", client: "Heidi Salon", urgent: true },
  { title: "Jerome: 6 Hot Leads anrufen", due: "Heute", client: "Jerome", urgent: true },
  { title: "Ad-Creatives Volta freigeben", due: "Morgen", client: "Intern", urgent: false },
  { title: "Reporting Woche 25 erstellen", due: "Fr", client: "Alle", urgent: false },
];

function card(extra = "") {
  return `rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] ${extra}`;
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-[1500px] px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-display text-lg font-bold tracking-tight">
              VoltaDigital<span className="text-[color:var(--color-accent)]">CRM</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm">
              <span className="text-[color:var(--color-text)]">Übersicht</span>
              <Link href="/board" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Pipelines</Link>
              <Link href="/dashboard" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Kunden</Link>
              <Link href="/dashboard" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">Aufgaben</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[color:var(--color-muted)] hidden sm:inline">hallo@voltadigital.agency</span>
            <div className="w-8 h-8 rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] grid place-items-center font-semibold">D</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-8">
        {/* Begrüßung */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-accent)] mb-2">Volta Digital · Übersicht</p>
          <h1 className="text-3xl font-bold tracking-tight">Willkommen zurück, David</h1>
          <p className="text-[color:var(--color-muted)] mt-1">Alle Kunden, Pipelines und Aufgaben auf einen Blick.</p>
        </div>

        {/* Stat-Kacheln */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={card("p-5")}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[color:var(--color-muted)]">{s.label}</span>
                  <Icon className="w-4 h-4 text-[color:var(--color-accent)]" />
                </div>
                <div className="text-3xl font-bold font-display">{s.value}</div>
                <div className="text-xs text-[color:var(--color-muted)] mt-1">{s.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Pipelines — Kachel-/Gitter-Ansicht */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Pipelines</h2>
          <Link href="/board" className="text-sm text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-2)] flex items-center gap-1">
            Alle ansehen <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {PIPELINES.map((p) => {
            const total = p.stages.reduce((a, s) => a + s.count, 0) || 1;
            return (
              <Link
                key={p.slug}
                href="/board"
                className={card("p-5 block transition hover:border-[color:var(--color-accent)] group")}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold group-hover:text-[color:var(--color-accent)] transition">{p.name}</div>
                    <div className="text-xs text-[color:var(--color-muted)] mt-0.5">{p.type}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[color:var(--color-muted)] group-hover:text-[color:var(--color-accent)] transition" />
                </div>

                <div className="flex items-end gap-6 mt-5">
                  <div>
                    <div className="text-2xl font-bold font-display">{p.leads}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">Leads gesamt</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-display text-[color:var(--color-accent)]">{p.hot}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">Hot Leads</div>
                  </div>
                </div>

                {/* Stage-Balken */}
                <div className="mt-5">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
                    {p.stages.map((st) => (
                      <div key={st.label} style={{ width: `${(st.count / total) * 100}%`, background: st.tone }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                    {p.stages.map((st) => (
                      <span key={st.label} className="text-xs text-[color:var(--color-muted)] flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: st.tone }} />
                        {st.label} <span className="text-[color:var(--color-text)]">{st.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Kunde hinzufügen */}
          <Link
            href="/dashboard"
            className="rounded-xl border border-dashed border-[color:var(--color-border)] grid place-items-center p-5 min-h-[180px] text-[color:var(--color-muted)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            <span className="flex flex-col items-center gap-2">
              <Plus className="w-6 h-6" />
              <span className="text-sm">Kunde / Pipeline hinzufügen</span>
            </span>
          </Link>
        </div>

        {/* Projekte + Aufgaben */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={card("p-5")}>
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-[color:var(--color-accent)]" />
              <h2 className="text-lg font-semibold tracking-tight">Projekte</h2>
            </div>
            <div className="flex flex-col gap-4">
              {PROJECTS.map((pr) => (
                <div key={pr.name}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{pr.name}</div>
                    <span className="text-xs text-[color:var(--color-muted)]">{pr.status}</span>
                  </div>
                  <div className="text-xs text-[color:var(--color-muted)] mb-1.5">{pr.client}</div>
                  <div className="h-1.5 w-full rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
                    <div className="h-full bg-[color:var(--color-accent)]" style={{ width: `${pr.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={card("p-5")}>
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="w-4 h-4 text-[color:var(--color-accent)]" />
              <h2 className="text-lg font-semibold tracking-tight">Aufgaben</h2>
            </div>
            <div className="flex flex-col divide-y divide-[color:var(--color-border)]">
              {TASKS.map((tk) => (
                <div key={tk.title} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <Circle className={`w-4 h-4 shrink-0 ${tk.urgent ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-muted)]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{tk.title}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">{tk.client}</div>
                  </div>
                  <span className={`text-xs ${tk.urgent ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-muted)]"}`}>{tk.due}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
