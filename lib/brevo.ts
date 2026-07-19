import "server-only";
import type { Stage } from "@/lib/types";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "info@jeromederes.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Jerome Deres Coaching";

// Absender ist info@jeromederes.com → automatische Mails NUR für Jeromes Org
// feuern, damit andere Mandanten keine Mails von dieser Adresse bekommen.
// Kommagetrennte Liste via BREVO_ENABLED_ORG_IDS überschreibbar; Default = Jerome.
const BREVO_ENABLED_ORG_IDS: ReadonlySet<string> = new Set(
  (process.env.BREVO_ENABLED_ORG_IDS || "326f2401-8450-41ad-8f43-0dba76e4a868")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isBrevoEnabledOrg(orgId: string | null | undefined): boolean {
  return !!orgId && BREVO_ENABLED_ORG_IDS.has(orgId);
}

export type EmailTemplate =
  | "lead_first_contact"
  | "setter_call_confirmation"
  | "setter_call_reminder_24h"
  | "setter_call_reminder_1h"
  | "setter_followup"
  | "setter_no_show_recovery"
  | "closer_call_confirmation"
  | "closer_followup"
  | "closer_no_show_recovery"
  | "welcome_onboarding"
  | "lost_nurture"
  // Manueller Button "Nummer prüfen" (Button B) — Stage-unabhängig, kein Auto-Trigger.
  | "wrong_number_check"
  // Manueller Button "Nicht erreicht" (ab 4 Anrufversuchen) — nutzt die bestehende
  // No-Show-Vorlage, aber mit EIGENEM Log-Key, damit die "einmal senden"-Idempotenz
  // unabhängig vom automatischen setter_no_show-Stage-Mail bleibt.
  | "no_show_after_calls";

// Brevo-Template-IDs aus env (Numerische ID aus Brevo Dashboard)
const TEMPLATE_ENV_MAP: Record<EmailTemplate, string> = {
  lead_first_contact: "BREVO_TPL_FIRST_CONTACT",
  setter_call_confirmation: "BREVO_TPL_SETTER_CONFIRMATION",
  setter_call_reminder_24h: "BREVO_TPL_SETTER_REMINDER_24H",
  setter_call_reminder_1h: "BREVO_TPL_SETTER_REMINDER_1H",
  setter_followup: "BREVO_TPL_SETTER_FOLLOWUP",
  setter_no_show_recovery: "BREVO_TPL_SETTER_NO_SHOW",
  closer_call_confirmation: "BREVO_TPL_CLOSER_CONFIRMATION",
  closer_followup: "BREVO_TPL_CLOSER_FOLLOWUP",
  closer_no_show_recovery: "BREVO_TPL_CLOSER_NO_SHOW",
  welcome_onboarding: "BREVO_TPL_WELCOME_ONBOARDING",
  lost_nurture: "BREVO_TPL_LOST_NURTURE",
  wrong_number_check: "BREVO_TPL_NUMBER_CHECK",
  // Bewusst dieselbe Brevo-Vorlage wie die No-Show-Recovery (enthält bereits
  // Simons Setter-Calendly als reschedule/calendarUrl). Kein neues Env nötig.
  no_show_after_calls: "BREVO_TPL_SETTER_NO_SHOW",
};

// Templates die TRANSAKTIONAL sind (auch bei Opt-Out senden, weil direkt zum
// gebuchten Termin bzw. zu einer bewussten operativen Aktion gehörig).
const TRANSACTIONAL_TEMPLATES: ReadonlySet<EmailTemplate> = new Set([
  "setter_call_confirmation",
  "setter_call_reminder_24h",
  "setter_call_reminder_1h",
  "closer_call_confirmation",
  // Manuelle "Nummer prüfen"-Mail ist eine bewusste operative Aktion des Setters.
  "wrong_number_check",
]);

// Bestätigungs-Mails dürfen NUR raus, wenn der zugehörige Termin bereits gebucht
// ist (sonst käme "dein Termin ist bestätigt" ohne Datum). Beim manuellen Ziehen
// einer Karte ohne Buchung wird der Versand daher übersprungen — die echte
// Bestätigung feuert der Calendly-Webhook, sobald der Termin (mit Datum) steht.
const CONFIRMATION_DATE_FIELD: Partial<Record<EmailTemplate, keyof LeadForEmail>> = {
  setter_call_confirmation: "calendly_setter_scheduled_at",
  closer_call_confirmation: "calendly_erstgespraech_scheduled_at",
};

// Mapping Stage-Transition → Email-Template. Bewusst NUR die drei von der Spec
// freigegebenen Stages (A): alle anderen Stages → keine Mail. won /
// klarheitsgespraech_no_show / klarheitsgespraech_lost sind absichtlich NICHT
// gemappt (Templates existieren in Brevo weiter, falls später gewünscht).
export const STAGE_EMAIL_MAP: Partial<Record<Stage, EmailTemplate>> = {
  setter_call_booked: "setter_call_confirmation",
  setter_no_show: "setter_no_show_recovery",
  klarheitsgespraech_booked: "closer_call_confirmation",
};

export type LeadForEmail = {
  id: string;
  org_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email_opt_out: boolean;
  calendly_setter_scheduled_at: string | null;
  calendly_erstgespraech_scheduled_at: string | null;
  // Vorname des zugewiesenen Setters (für Merge-Tag setterName); optional.
  setter_name?: string | null;
};

type AdminClient = {
  from: (table: string) => {
    select: (cols?: string) => unknown;
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => unknown;
    update: (patch: Record<string, unknown>) => unknown;
  };
};

function templateId(t: EmailTemplate): number | null {
  const envKey = TEMPLATE_ENV_MAP[t];
  const raw = process.env[envKey];
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

// Termin-Formatierung de-DE / Europe-Berlin (deckt AT/DE ab).
const APPT_DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Berlin",
});
const APPT_TIME_FMT = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
});
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : APPT_DATE_FMT.format(d);
}
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : APPT_TIME_FMT.format(d);
}
function fmtFull(iso: string | null | undefined): string {
  const date = fmtDate(iso);
  return date ? `${date} um ${fmtTime(iso)} Uhr` : "";
}

// Templates rund um den Closer/Klarheitsgespräch (Jerome) — steuert Termin-Feld
// und Reschedule-Link (Jerome vs. Simon).
const CLOSER_TEMPLATES: ReadonlySet<EmailTemplate> = new Set([
  "closer_call_confirmation",
  "closer_followup",
  "closer_no_show_recovery",
]);

function templateParams(lead: LeadForEmail, template?: EmailTemplate): Record<string, unknown> {
  const firstName = lead.first_name || lead.name?.split(" ")[0] || "";
  const lastName = lead.last_name || lead.name?.split(" ").slice(1).join(" ") || "";
  const isCloser = !!template && CLOSER_TEMPLATES.has(template);
  const apptIso = isCloser ? lead.calendly_erstgespraech_scheduled_at : lead.calendly_setter_scheduled_at;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://crm.voltadigital.agency";
  const setterUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const closerUrl = process.env.NEXT_PUBLIC_CLOSER_CALENDLY_URL || setterUrl;
  const rescheduleUrl = isCloser ? closerUrl : setterUrl;

  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    email: lead.email,
    coachName: "Jerome Deres",
    setterName: lead.setter_name || "Simon",
    // Legacy-Tags, die die bestehenden Brevo-Templates schon nutzen — jetzt schön
    // formatiert (de-DE) statt roher ISO-String.
    setterScheduledAt: fmtFull(lead.calendly_setter_scheduled_at),
    closerScheduledAt: fmtFull(lead.calendly_erstgespraech_scheduled_at),
    // Neue, granular platzierbare Tags (Datum/Uhrzeit getrennt + Reschedule-Link).
    terminDatum: fmtDate(apptIso),
    terminUhrzeit: fmtTime(apptIso),
    rescheduleUrl,
    calendarUrl: rescheduleUrl,
    unsubscribeUrl: `${siteUrl}/api/unsubscribe?lead=${lead.id}`,
  };
}

export async function sendBrevoEmail(opts: {
  to: { email: string; name?: string };
  templateId: number;
  params: Record<string, unknown>;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY not set" };

  // TESTMODUS: Solange TEST_EMAIL gesetzt ist, gehen ALLE Mails (A + B) an diese
  // Inbox statt an die echte Lead-Adresse. Das Logging in sendStageEmail schreibt
  // weiterhin die ECHTE Lead-Adresse (to_email), damit der Nachweis stimmt.
  const testEmail = process.env.TEST_EMAIL?.trim();
  const recipient = testEmail
    ? { email: testEmail, name: `TEST → ${opts.to.email}` }
    : opts.to;

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [recipient],
      templateId: opts.templateId,
      params: opts.params,
      replyTo: { email: SENDER_EMAIL, name: SENDER_NAME },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `${res.status}: ${text}` };
  try {
    const data = JSON.parse(text);
    return { ok: true, messageId: data.messageId || "" };
  } catch {
    return { ok: true, messageId: "" };
  }
}

export async function sendStageEmail(
  supabase: AdminClient,
  lead: LeadForEmail,
  template: EmailTemplate,
  opts: { force?: boolean; trigger?: "auto" | "manual" } = {},
): Promise<{ ok: boolean; status: string; error?: string }> {
  if (!lead.email) return { ok: false, status: "no_email" };

  // Auslöser (auto = Stage-Wechsel, manual = Button "Nummer prüfen") — landet im
  // email_log.meta, damit kein Schema-Change nötig ist.
  const trigger = opts.trigger ?? "auto";

  // Bestätigungs-Mails nur mit gebuchtem Termin senden (siehe CONFIRMATION_DATE_FIELD).
  const dateField = CONFIRMATION_DATE_FIELD[template];
  if (dateField && !lead[dateField]) {
    return { ok: false, status: "skipped_no_date" };
  }

  // Opt-Out prüfen — Transaktionale Templates dürfen weiter
  if (lead.email_opt_out && !TRANSACTIONAL_TEMPLATES.has(template)) {
    await (supabase.from("email_log") as { insert: (r: Record<string, unknown>) => Promise<unknown> }).insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template,
      to_email: lead.email,
      status: "skipped_optout",
      meta: { trigger },
    });
    return { ok: false, status: "skipped_optout" };
  }

  // Idempotency: gleicher Template wurde bereits gesendet?
  if (!opts.force) {
    const existing = await (supabase
      .from("email_log") as {
        select: (cols: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                limit: (n: number) => Promise<{ data: unknown[] | null }>;
              };
            };
          };
        };
      })
      .select("id")
      .eq("lead_id", lead.id)
      .eq("template", template)
      .eq("status", "sent")
      .limit(1);
    if (existing.data && existing.data.length > 0) {
      return { ok: false, status: "skipped_dup" };
    }
  }

  const tpl = templateId(template);
  if (!tpl) {
    await (supabase.from("email_log") as { insert: (r: Record<string, unknown>) => Promise<unknown> }).insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template,
      to_email: lead.email,
      status: "failed",
      error: `template id env missing: ${TEMPLATE_ENV_MAP[template]}`,
      meta: { trigger },
    });
    return { ok: false, status: "failed", error: "template_id_missing" };
  }

  const result = await sendBrevoEmail({
    to: { email: lead.email, name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || undefined },
    templateId: tpl,
    params: templateParams(lead, template),
  });

  if (!result.ok) {
    await (supabase.from("email_log") as { insert: (r: Record<string, unknown>) => Promise<unknown> }).insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template,
      to_email: lead.email,
      status: "failed",
      error: result.error,
      meta: { trigger },
    });
    return { ok: false, status: "failed", error: result.error };
  }

  await (supabase.from("email_log") as { insert: (r: Record<string, unknown>) => Promise<unknown> }).insert({
    org_id: lead.org_id,
    lead_id: lead.id,
    template,
    to_email: lead.email,
    status: "sent",
    brevo_message_id: result.messageId,
    meta: { trigger },
  });
  return { ok: true, status: "sent" };
}
