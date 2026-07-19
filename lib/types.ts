// Hinweis: setter_call_done, setter_won, erstgespraech_done, lost bleiben im DB-Enum für
// Rückwärts-Kompatibilität, werden aber NICHT mehr in der UI gerendert (gestrichene Stages).
export const STAGES = [
  "setter_call_booked",
  "setter_no_show",
  "setter_lost",
  "klarheitsgespraech_booked",
  "klarheitsgespraech_no_show",
  "won",
  "klarheitsgespraech_lost",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  setter_call_booked: "Setter Call gebucht",
  setter_no_show: "Setter No-Show",
  setter_lost: "Setter Lost",
  klarheitsgespraech_booked: "Klarheitsgespräch gebucht",
  klarheitsgespraech_no_show: "Klarheitsgespräch No-Show",
  klarheitsgespraech_lost: "Lost",
  won: "Won",
};

// Tailwind-Klassen-Mapping für Badges
// Schlichtes Monochrom-Mapping: aktive Stages neutral (weiß/grau),
// No-Show/Lost gedämpft, "Won" als einziges mit Gold-Akzent.
export const STAGE_BADGE: Record<Stage, string> = {
  setter_call_booked:           "bg-white/[0.06] text-[color:var(--color-text)] border-white/15",
  setter_no_show:               "bg-white/[0.03] text-[color:var(--color-muted)] border-white/10",
  setter_lost:                  "bg-transparent text-[color:var(--color-muted)] border-white/10",
  klarheitsgespraech_booked:    "bg-white/[0.06] text-[color:var(--color-text)] border-white/15",
  klarheitsgespraech_no_show:   "bg-white/[0.03] text-[color:var(--color-muted)] border-white/10",
  klarheitsgespraech_lost:      "bg-transparent text-[color:var(--color-muted)] border-white/10",
  won:                          "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/40",
};

export const LOST_STAGES: ReadonlySet<Stage> = new Set(["setter_lost", "klarheitsgespraech_lost"]);

export const BUSINESS_YEARS_LABEL: Record<string, string> = {
  noch_nicht: "Noch nicht",
  unter_1: "<1J",
  "1_3": "1–3J",
  "3_5": "3–5J",
  ueber_5: "5J+",
};

export const REVENUE_LABEL: Record<string, string> = {
  unter_50k: "<50k",
  "50_150k": "50–150k",
  "150_500k": "150–500k",
  "500k_1m": "500k–1M",
  ueber_1m: "1M+",
};

export const SOURCES = [
  "calendly_setter",
  "calendly_erstgespraech",
  "manual",
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  calendly_setter: "Calendly Setter",
  calendly_erstgespraech: "Calendly Erstgespräch",
  manual: "Manuell",
};

export type Lead = {
  id: string;
  org_id: string;
  created_at: string;
  updated_at: string;
  source: Source;
  source_manual: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_opt_out: boolean;
  phone: string | null;
  business_years: string | null;
  revenue_band: string | null;
  quiz_score: number | null;
  stage: Stage;
  owner_id: string | null;
  value_estimate: number | null;
  lost_reason: string | null;
  notes: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  calendly_setter_event_uri: string | null;
  calendly_setter_scheduled_at: string | null;
  calendly_erstgespraech_event_uri: string | null;
  calendly_erstgespraech_scheduled_at: string | null;
  // Manueller Anruf-Versuch-Zähler (0..MAX_CALL_ATTEMPTS) + Guard für die
  // einmalige "Nicht erreicht"-Mail. Siehe Migration 0016.
  call_attempts: number;
  no_show_email_sent_at: string | null;
};

// Ab diesem Zählerstand erscheint der "Nicht erreicht – Mail"-Button; zugleich
// die Obergrenze des "+"-Buttons. Single source of truth für Server-Action + UI.
export const MAX_CALL_ATTEMPTS = 4;

export type Profile = {
  id: string;
  org_id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "closer" | "setter" | "viewer";
  marker_color: string | null;
  avatar_emoji: string | null;
};

export type TagCategoryId = "action" | "waiting" | "positive" | "source" | "archive";

export type TagCategory = {
  id: TagCategoryId;
  label: string;
  color: string;
};

export type Tag = {
  id: string;
  org_id: string;
  category_id: TagCategoryId;
  label: string;
  description: string | null;
};

export type LeadTagLink = {
  lead_id: string;
  tag_id: string;
};

export const TAG_CATEGORY_LABEL: Record<TagCategoryId, string> = {
  action: "Action",
  waiting: "Waiting",
  positive: "Positiv",
  source: "Quelle",
  archive: "Archiv",
};

// Schlicht: Gold-Abstufungen + Grau statt bunter Kategorie-Farben.
export const TAG_CATEGORY_COLOR: Record<TagCategoryId, string> = {
  action: "#E5C76B",   /* helles Gold (wichtig) */
  waiting: "#B9952E",  /* gedämpftes Gold */
  positive: "#D4AF37", /* Gold */
  source: "#8A8A92",   /* Grau */
  archive: "#5A5A60",  /* dunkles Grau */
};

export const TAG_CATEGORY_ORDER: TagCategoryId[] = ["action", "waiting", "positive", "source", "archive"];

export type Activity = {
  id: string;
  lead_id: string;
  type:
    | "booking"
    | "booking_canceled"
    | "stage_change"
    | "note"
    | "call_done"
    | "lead_created"
    | "lead_updated";
  content: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
};
