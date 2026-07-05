import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AGENCY_ORG_SLUG, getOrgInfo } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/cockpit/ui";
import { CAL_EVENTS, TODAY, day, clientName, type CalEvent } from "@/lib/mock/agency";
import { CATEGORY_COLOR, todayBerlin, type CalendarItem } from "@/lib/team/types";
import { getCalendarItems } from "@/lib/team/calendar-data";
import { EventForm, DeleteEventButton } from "./event-form";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// "YYYY-MM" → Zellen des Monatsrasters (Mo-basiert), null = Leerzelle.
function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  const orgInfo = await getOrgInfo();
  if (!orgInfo) redirect("/board");

  // Kunden-Orgs: echter Team-Kalender (Monatsansicht) mit manuellen Terminen
  // + automatisch eingespielten Calendly-Buchungen der Leads.
  if (orgInfo.slug !== AGENCY_ORG_SLUG) {
    const today = todayBerlin();
    const { monat } = await searchParams;
    const month = monat && /^\d{4}-(0[1-9]|1[0-2])$/.test(monat) ? monat : today.slice(0, 7);
    const cells = monthGrid(month);
    const monthDays = cells.filter(Boolean) as string[];
    const items = await getCalendarItems(supabase, monthDays[0], monthDays[monthDays.length - 1]);
    const byDay = new Map<string, CalendarItem[]>();
    for (const item of items) {
      byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
    }
    const [y, m] = month.split("-").map(Number);

    return (
      <>
        <AppHeader email={user.email ?? ""} />
        <main className="mx-auto max-w-[1500px] px-6 py-8">
          <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Kalender</h1>
              <p className="text-sm text-[color:var(--color-muted)]">
                Termine, Launches & Planung — Calendly-Buchungen eurer Leads laufen automatisch ein.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/kalender?monat=${shiftMonth(month, -1)}`}
                aria-label="Voriger Monat"
                className="rounded-md border border-[color:var(--color-border)] p-2 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-accent)] transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <span className="text-sm font-semibold tabular-nums min-w-[140px] text-center">
                {MONTH_NAMES[m - 1]} {y}
              </span>
              <Link
                href={`/kalender?monat=${shiftMonth(month, 1)}`}
                aria-label="Nächster Monat"
                className="rounded-md border border-[color:var(--color-border)] p-2 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-accent)] transition"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* key={month}: bei Monatswechsel neu mounten, damit das Datumsfeld mitwandert */}
          <EventForm key={month} defaultDate={today.slice(0, 7) === month ? today : monthDays[0]} />

          {/* Wochentags-Kopf */}
          <div className="hidden sm:grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] px-1">
                {w}
              </div>
            ))}
          </div>

          {/* Monatsraster */}
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {cells.map((iso, i) =>
              iso === null ? (
                <div key={`blank-${i}`} className="hidden sm:block" />
              ) : (
                <Card
                  key={iso}
                  className={`p-2 min-h-[110px] ${iso === today ? "border-[color:var(--color-accent)]/60" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="sm:hidden text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
                      {WEEKDAYS[i % 7]}
                    </span>
                    <span
                      className={`text-xs tabular-nums ml-auto ${
                        iso === today
                          ? "w-5 h-5 grid place-items-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold"
                          : "text-[color:var(--color-muted)]"
                      }`}
                    >
                      {Number(iso.slice(8))}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(byDay.get(iso) ?? []).map((item) => (
                      <CalendarChip key={item.id} item={item} />
                    ))}
                  </div>
                </Card>
              ),
            )}
          </div>
        </main>
      </>
    );
  }

  // ── Agentur-Cockpit (Volta): Mock-Wochenansicht wie bisher ────────────────
  const base = new Date(TODAY + "T00:00:00");
  const dow = (base.getDay() + 6) % 7; // 0 = Montag
  const week = Array.from({ length: 7 }, (_, i) => day(i - dow));

  const eventsOn = (iso: string) =>
    CAL_EVENTS.filter((e) => e.date === iso).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-[1500px] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Kalender</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Termine & Deadlines dieser Woche — Calendly-Buchungen laufen hier später automatisch ein.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {week.map((iso, i) => {
            const isToday = iso === TODAY;
            const dayNum = new Date(iso + "T00:00:00").getDate();
            const events = eventsOn(iso);
            return (
              <Card
                key={iso}
                className={`p-3 min-h-[180px] ${isToday ? "border-[color:var(--color-accent)]/60" : ""}`}
              >
                <div className="flex items-baseline justify-between mb-3">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isToday ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-muted)]"
                    }`}
                  >
                    {WEEKDAYS[i]}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      isToday
                        ? "w-6 h-6 grid place-items-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold"
                        : "text-[color:var(--color-muted)]"
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>
                <div className="space-y-2">
                  {events.map((e) => (
                    <EventChip key={e.id} event={e} />
                  ))}
                  {events.length === 0 && (
                    <span className="text-[11px] text-[color:var(--color-muted)]/60">—</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}

function CalendarChip({ item }: { item: CalendarItem }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: CATEGORY_COLOR[item.category] }}
        />
        {item.time && (
          <span className="text-[10px] tabular-nums text-[color:var(--color-muted)]">{item.time}</span>
        )}
        {item.source === "calendly" && (
          <span className="text-[9px] uppercase tracking-wide text-[color:var(--color-muted)]">Calendly</span>
        )}
        {item.source === "event" && <DeleteEventButton id={item.id} />}
      </div>
      <div className="text-xs mt-0.5 leading-tight">{item.title}</div>
    </>
  );
  const cls =
    "group block rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-1.5";
  if (item.source === "calendly" && item.leadId) {
    return (
      <Link href={`/leads/${item.leadId}`} className={`${cls} hover:border-[color:var(--color-accent)]/50 transition`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

function EventChip({ event }: { event: CalEvent }) {
  const isDeadline = event.type === "deadline";
  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: isDeadline ? "transparent" : "var(--color-accent)",
            border: isDeadline ? "1px solid var(--color-muted)" : "none",
          }}
        />
        {event.time && (
          <span className="text-[10px] tabular-nums text-[color:var(--color-muted)]">{event.time}</span>
        )}
        {isDeadline && (
          <span className="text-[9px] uppercase tracking-wide text-[color:var(--color-muted)]">Deadline</span>
        )}
      </div>
      <div className="text-xs mt-0.5 leading-tight">{event.title}</div>
      {event.client && (
        <div className="text-[10px] text-[color:var(--color-muted)] mt-0.5">{clientName(event.client)}</div>
      )}
    </div>
  );
}
