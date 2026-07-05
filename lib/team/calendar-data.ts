import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { berlinDate, berlinTime, type CalendarItem, type TeamEvent } from "@/lib/team/types";

type Supabase = Awaited<ReturnType<typeof getSupabaseServer>>;

type CalendlyLead = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  calendly_setter_scheduled_at: string | null;
  calendly_erstgespraech_scheduled_at: string | null;
};

function leadName(l: CalendlyLead): string {
  return (
    l.name?.trim() ||
    [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
    "Unbekannter Lead"
  );
}

// Manuelle Termine + Calendly-Buchungen der Leads im Zeitraum [from, to]
// (beides RLS-gescoped auf die Org des eingeloggten Users), sortiert nach
// Datum + Uhrzeit (Einträge ohne Uhrzeit zuletzt).
export async function getCalendarItems(
  supabase: Supabase,
  from: string,
  to: string,
): Promise<CalendarItem[]> {
  const [{ data: events }, { data: leads }] = await Promise.all([
    supabase
      .from("team_events")
      .select("id, org_id, title, date, time, category, notes")
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("leads")
      .select(
        "id, name, first_name, last_name, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at",
      )
      .is("trashed_at", null)
      .or(
        "calendly_setter_scheduled_at.not.is.null,calendly_erstgespraech_scheduled_at.not.is.null",
      ),
  ]);

  const items: CalendarItem[] = ((events ?? []) as TeamEvent[]).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time,
    category: e.category,
    source: "event",
  }));

  for (const lead of (leads ?? []) as CalendlyLead[]) {
    const slots: Array<[string | null, string]> = [
      [lead.calendly_setter_scheduled_at, "Setter-Call"],
      [lead.calendly_erstgespraech_scheduled_at, "Klarheitsgespräch"],
    ];
    for (const [ts, label] of slots) {
      if (!ts) continue;
      const date = berlinDate(ts);
      if (date < from || date > to) continue;
      items.push({
        id: `calendly-${lead.id}-${label}`,
        title: `${label}: ${leadName(lead)}`,
        date,
        time: berlinTime(ts),
        category: "sales",
        source: "calendly",
        leadId: lead.id,
      });
    }
  }

  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"),
  );
  return items;
}
