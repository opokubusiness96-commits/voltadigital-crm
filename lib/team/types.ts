// Typen + Datums-Helfer für den Team-Workspace (Aufgaben/Termine/Notizen)
// der Kunden-Orgs. Datumswerte sind reine ISO-Tage (YYYY-MM-DD); "heute" wird
// in Europe/Berlin berechnet, weil der Server (Vercel) auf UTC läuft.

export type TaskPriority = "hoch" | "mittel" | "niedrig";
export type TeamCategory = "sales" | "marketing" | "planung" | "sonstiges";

export const CATEGORIES: TeamCategory[] = ["sales", "marketing", "planung", "sonstiges"];

export const CATEGORY_LABEL: Record<TeamCategory, string> = {
  sales: "Sales",
  marketing: "Marketing",
  planung: "Planung",
  sonstiges: "Sonstiges",
};

// Monochrom wie TAG_CATEGORY_COLOR: Gold-Abstufungen + Grau.
export const CATEGORY_COLOR: Record<TeamCategory, string> = {
  sales: "#D4AF37",
  marketing: "#E5C76B",
  planung: "#B9952E",
  sonstiges: "#8A8A92",
};

export type TeamTask = {
  id: string;
  org_id: string;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
  category: TeamCategory;
  done: boolean;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamEvent = {
  id: string;
  org_id: string;
  title: string;
  date: string;
  time: string | null;
  category: TeamCategory;
  notes: string | null;
};

export type TeamNote = {
  id: string;
  org_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

export type TeamMember = {
  id: string;
  display_name: string | null;
  avatar_emoji: string | null;
};

// Kalender-Eintrag fürs Rendering: manuelle Events + automatisch
// eingespielte Calendly-Termine der Leads.
export type CalendarItem = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  category: TeamCategory;
  source: "event" | "calendly";
  leadId?: string;
};

export function todayBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type TaskBucket = "ueberfaellig" | "heute" | "woche" | "spaeter" | "ohne";

export const TASK_BUCKET_ORDER: TaskBucket[] = ["ueberfaellig", "heute", "woche", "spaeter", "ohne"];

export const TASK_BUCKET_LABEL: Record<TaskBucket, string> = {
  ueberfaellig: "Überfällig",
  heute: "Heute",
  woche: "Nächste 7 Tage",
  spaeter: "Später",
  ohne: "Ohne Datum",
};

export function taskBucket(due: string | null, today: string): TaskBucket {
  if (!due) return "ohne";
  if (due < today) return "ueberfaellig";
  if (due === today) return "heute";
  return due <= addDaysISO(today, 7) ? "woche" : "spaeter";
}

export function fmtDay(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

// Calendly-Timestamp (timestamptz) → Berliner Datum / Uhrzeit
export function berlinDate(ts: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

export function berlinTime(ts: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}
