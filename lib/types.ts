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
export const STAGE_BADGE: Record<Stage, string> = {
  setter_call_booked:           "bg-blue-500/15 text-blue-300 border-blue-500/30",
  setter_no_show:               "bg-amber-500/15 text-amber-300 border-amber-500/30",
  setter_lost:                  "bg-red-500/15 text-red-300 border-red-500/30",
  klarheitsgespraech_booked:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
  klarheitsgespraech_no_show:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  klarheitsgespraech_lost:      "bg-red-500/15 text-red-300 border-red-500/30",
  won:                          "bg-green-500/20 text-green-300 border-green-500/40",
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
};

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

export const TAG_CATEGORY_COLOR: Record<TagCategoryId, string> = {
  action: "#ef4444",
  waiting: "#eab308",
  positive: "#22c55e",
  source: "#3b82f6",
  archive: "#6b7280",
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
