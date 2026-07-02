// Zentrale Mock-Daten für das Volta-Digital-Cockpit (Frontend-Demo, KEIN Backend).
// Sobald Supabase steht, werden diese pro Organisation aus der DB geladen.
// Fester Referenz-Tag, damit "Heute/Überfällig" deterministisch ist (kein Hydration-Mismatch).

export const TODAY = "2026-06-21";

function shiftDay(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  // Lokales Datum als YYYY-MM-DD — KEIN toISOString(), sonst UTC-Versatz (z. B. CEST → ein Tag zurück).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
/** Tagesversatz relativ zum Referenz-Tag, als ISO-Datum (YYYY-MM-DD). */
export const day = (offset: number) => shiftDay(TODAY, offset);

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short" });

// ---------------------------------------------------------------- Kunden
export type ClientStatus = "aktiv" | "onboarding" | "pausiert";
export type Client = {
  slug: string;
  name: string;
  type: string;
  mrr: number; // monatlicher Retainer
  status: ClientStatus;
  nextMeeting?: string; // ISO
};

export const CLIENTS: Client[] = [
  { slug: "jerome", name: "Jerome Deres Coaching", type: "Coaching", mrr: 2500, status: "aktiv", nextMeeting: day(1) },
  { slug: "heidi", name: "Heidi - The Salon CEO", type: "Beauty / Salon", mrr: 1200, status: "aktiv", nextMeeting: day(0) },
  { slug: "ellys", name: "Ellys Glow Up", type: "Beauty", mrr: 900, status: "onboarding", nextMeeting: day(2) },
  { slug: "nikola", name: "Nikola - MDK", type: "Physio / MDK System", mrr: 0, status: "aktiv" },
  { slug: "volta", name: "Volta — Inbound", type: "Agentur (intern)", mrr: 0, status: "aktiv" },
];

export const clientName = (slug: string) => CLIENTS.find((c) => c.slug === slug)?.name ?? slug;

// Pipeline / Funnel pro Kunde (jeder Kunde = eigene Org/Pipeline).
export const FUNNEL_LABELS = ["Neu", "Call", "Angebot", "Kunde"];
// Monochromer Funnel: dunkelgrau → hellgrau → Gold (gewonnen).
export const FUNNEL_TONE = ["#3A3A40", "#5A5A62", "#8A8A92", "var(--color-accent)"];
export type ClientPipeline = { leads: number; hot: number; stages: number[] };
export const PIPELINE_BY_CLIENT: Record<string, ClientPipeline> = {
  jerome: { leads: 42, hot: 6, stages: [14, 11, 9, 8] },
  heidi: { leads: 27, hot: 4, stages: [10, 8, 5, 4] },
  ellys: { leads: 12, hot: 2, stages: [6, 3, 2, 1] },
  nikola: { leads: 1, hot: 0, stages: [1, 0, 0, 0] },
  volta: { leads: 18, hot: 3, stages: [7, 5, 4, 2] },
};

// ---------------------------------------------------------------- Aufgaben
export type Priority = "hoch" | "mittel" | "niedrig";
export const PRIORITY_LABEL: Record<Priority, string> = { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig" };

export type Task = {
  id: string;
  title: string;
  client: string; // slug
  priority: Priority;
  due: string; // ISO
  done: boolean;
};

export const TASKS: Task[] = [
  { id: "t1", title: "Angebot an Heidi nachfassen", client: "heidi", priority: "hoch", due: day(-2), done: false },
  { id: "t3", title: "Jerome: 6 Hot Leads anrufen", client: "jerome", priority: "hoch", due: day(0), done: false },
  { id: "t5", title: "Ellys Onboarding-Call vorbereiten", client: "ellys", priority: "mittel", due: day(1), done: false },
  { id: "t6", title: "Reporting KW 25 erstellen", client: "volta", priority: "mittel", due: day(2), done: false },
  { id: "t7", title: "Jerome: Funnel-Texte gegenlesen", client: "jerome", priority: "niedrig", due: day(3), done: false },
  { id: "t8", title: "Heidi: neue Zielgruppe testen", client: "heidi", priority: "niedrig", due: day(8), done: false },
];

export type TaskBucket = "ueberfaellig" | "heute" | "woche" | "spaeter";
export const TASK_BUCKET_LABEL: Record<TaskBucket, string> = {
  ueberfaellig: "Überfällig",
  heute: "Heute",
  woche: "Diese Woche",
  spaeter: "Später",
};
export function taskBucket(due: string): TaskBucket {
  if (due < TODAY) return "ueberfaellig";
  if (due === TODAY) return "heute";
  if (due <= day(7)) return "woche";
  return "spaeter";
}

// ---------------------------------------------------------------- Notizen
export type Note = { id: string; body: string; client?: string; pinned: boolean; createdAt: string };
export const NOTES: Note[] = [
  { id: "n1", body: "Jerome will ab Juli auf Raten-Tarif umstellen — Stripe-Link anpassen.", client: "jerome", pinned: true, createdAt: day(-1) },
  { id: "n3", body: "Heidi fragt nach Google-Ads zusätzlich zu Meta — Angebot rechnen.", client: "heidi", pinned: true, createdAt: day(-3) },
  { id: "n4", body: "Idee: monatlicher Loom-Report statt PDF für alle Kunden.", pinned: false, createdAt: day(-4) },
];

// ---------------------------------------------------------------- Rechnungen
export type InvoiceStatus = "offen" | "bezahlt" | "ueberfaellig";
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  offen: "Offen",
  bezahlt: "Bezahlt",
  ueberfaellig: "Überfällig",
};
export type Invoice = {
  id: string;
  number: string;
  client: string; // slug
  amount: number;
  issued: string;
  due: string;
  status: InvoiceStatus;
};
export const INVOICES: Invoice[] = [
  { id: "r1", number: "2026-061", client: "jerome", amount: 2500, issued: day(-18), due: day(-4), status: "ueberfaellig" },
  { id: "r3", number: "2026-063", client: "heidi", amount: 1200, issued: day(-12), due: day(2), status: "offen" },
  { id: "r4", number: "2026-058", client: "jerome", amount: 2500, issued: day(-48), due: day(-34), status: "bezahlt" },
  { id: "r6", number: "2026-060", client: "ellys", amount: 900, issued: day(-10), due: day(4), status: "offen" },
  { id: "r7", number: "2026-064", client: "heidi", amount: 1200, issued: day(-40), due: day(-26), status: "bezahlt" },
];

export function financeSummary() {
  const offen = INVOICES.filter((i) => i.status === "offen").reduce((s, i) => s + i.amount, 0);
  const ueberfaellig = INVOICES.filter((i) => i.status === "ueberfaellig").reduce((s, i) => s + i.amount, 0);
  const bezahltMonat = INVOICES.filter((i) => i.status === "bezahlt").reduce((s, i) => s + i.amount, 0);
  const mrr = CLIENTS.reduce((s, c) => s + c.mrr, 0);
  return { offen, ueberfaellig, bezahltMonat, mrr };
}

// ---------------------------------------------------------------- Ad-Performance / Reporting
export type AdRow = {
  client: string; // slug
  channel: "Meta" | "Google";
  spend: number;
  leads: number;
  cpl: number; // cost per lead
  roas: number;
};
export const AD_PERFORMANCE: AdRow[] = [
  { client: "jerome", channel: "Meta", spend: 3200, leads: 84, cpl: 38, roas: 4.1 },
  { client: "heidi", channel: "Meta", spend: 1100, leads: 39, cpl: 28, roas: 5.2 },
  { client: "ellys", channel: "Meta", spend: 700, leads: 18, cpl: 39, roas: 2.6 },
];

// ---------------------------------------------------------------- Kalender
export type CalEventType = "termin" | "deadline" | "call";
export type CalEvent = { id: string; title: string; client?: string; date: string; time?: string; type: CalEventType };
export const CAL_EVENTS: CalEvent[] = [
  { id: "e1", title: "Heidi — Strategie-Call", client: "heidi", date: day(0), time: "10:00", type: "call" },
  { id: "e2", title: "Jerome — Hot Leads Slot", client: "jerome", date: day(0), time: "14:00", type: "termin" },
  { id: "e4", title: "Ellys — Onboarding", client: "ellys", date: day(2), time: "11:30", type: "termin" },
  { id: "e6", title: "Reporting KW 25 abgeben", client: "volta", date: day(2), type: "deadline" },
  { id: "e7", title: "Jerome — Funnel Walkthrough", client: "jerome", date: day(4), time: "16:00", type: "termin" },
];
