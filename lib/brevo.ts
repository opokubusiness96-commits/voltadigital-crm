import "server-only";
import type { Stage } from "@/lib/types";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "info@jeromederes.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Jerome Deres Coaching";

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
  | "lost_nurture";

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
};

// Templates die TRANSAKTIONAL sind (auch bei Opt-Out senden, weil direkt zum gebuchten Termin gehörig)
const TRANSACTIONAL_TEMPLATES: ReadonlySet<EmailTemplate> = new Set([
  "setter_call_confirmation",
  "setter_call_reminder_24h",
  "setter_call_reminder_1h",
  "closer_call_confirmation",
]);

// Mapping Stage-Transition → Email-Template (Stage = neue Stage; from-stage hier nicht entscheidend)
export const STAGE_EMAIL_MAP: Partial<Record<Stage, EmailTemplate>> = {
  setter_call_booked: "setter_call_confirmation",
  setter_no_show: "setter_no_show_recovery",
  setter_lost: undefined,
  klarheitsgespraech_booked: "closer_call_confirmation",
  klarheitsgespraech_no_show: "closer_no_show_recovery",
  klarheitsgespraech_lost: "lost_nurture",
  won: "welcome_onboarding",
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

function templateParams(lead: LeadForEmail): Record<string, unknown> {
  const firstName = lead.first_name || lead.name?.split(" ")[0] || "";
  const lastName = lead.last_name || lead.name?.split(" ").slice(1).join(" ") || "";
  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    coachName: "Jerome Deres",
    setterScheduledAt: lead.calendly_setter_scheduled_at,
    closerScheduledAt: lead.calendly_erstgespraech_scheduled_at,
    unsubscribeUrl: `https://crm.jeromederes.com/api/unsubscribe?lead=${lead.id}`,
  };
}

export async function sendBrevoEmail(opts: {
  to: { email: string; name?: string };
  templateId: number;
  params: Record<string, unknown>;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY not set" };

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [opts.to],
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
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; status: string; error?: string }> {
  if (!lead.email) return { ok: false, status: "no_email" };

  // Opt-Out prüfen — Transaktionale Templates dürfen weiter
  if (lead.email_opt_out && !TRANSACTIONAL_TEMPLATES.has(template)) {
    await (supabase.from("email_log") as { insert: (r: Record<string, unknown>) => Promise<unknown> }).insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template,
      to_email: lead.email,
      status: "skipped_optout",
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
    });
    return { ok: false, status: "failed", error: "template_id_missing" };
  }

  const result = await sendBrevoEmail({
    to: { email: lead.email, name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || undefined },
    templateId: tpl,
    params: templateParams(lead),
  });

  if (!result.ok) {
    await (supabase.from("email_log") as { insert: (r: Record<string, unknown>) => Promise<unknown> }).insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template,
      to_email: lead.email,
      status: "failed",
      error: result.error,
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
  });
  return { ok: true, status: "sent" };
}
