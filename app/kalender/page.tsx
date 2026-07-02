import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { isAgencyUser } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/cockpit/ui";
import { CAL_EVENTS, TODAY, day, clientName, type CalEvent } from "@/lib/mock/agency";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default async function KalenderPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");
  // Agentur-Cockpit: nur Volta-Org — Kunden-Accounts direkt zu ihrer Pipeline.
  if (!(await isAgencyUser())) redirect("/board");

  // Woche (Mo–So) rund um den Referenz-Tag.
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
