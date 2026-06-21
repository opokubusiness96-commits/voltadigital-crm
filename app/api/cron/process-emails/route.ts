import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { sendStageEmail, type EmailTemplate } from "@/lib/brevo";

export const runtime = "nodejs";

const VALID_TEMPLATES: Set<EmailTemplate> = new Set([
  "lead_first_contact",
  "setter_call_confirmation",
  "setter_call_reminder_24h",
  "setter_call_reminder_1h",
  "setter_followup",
  "closer_call_confirmation",
  "closer_followup",
  "welcome_onboarding",
  "lost_nurture",
]);

export async function GET(req: Request) {
  // Vercel Cron sendet "Authorization: Bearer ${CRON_SECRET}"
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceRole();
  const nowIso = new Date().toISOString();

  // Fällige Reminders holen (max 50 pro Lauf)
  const { data: due, error } = await supabase
    .from("scheduled_emails")
    .select("id, org_id, lead_id, template")
    .eq("status", "pending")
    .lte("run_at", nowIso)
    .limit(50);

  if (error) {
    console.error("cron: load due failed", error);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }

  if (!due?.length) return NextResponse.json({ ok: true, processed: 0 });

  let sent = 0;
  let failed = 0;

  for (const job of due) {
    if (!VALID_TEMPLATES.has(job.template as EmailTemplate)) {
      await supabase
        .from("scheduled_emails")
        .update({ status: "failed", error: "invalid template", sent_at: new Date().toISOString() })
        .eq("id", job.id);
      failed++;
      continue;
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("id, org_id, email, email_opt_out, first_name, last_name, name, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at")
      .eq("id", job.lead_id)
      .maybeSingle();
    if (!lead) {
      await supabase
        .from("scheduled_emails")
        .update({ status: "failed", error: "lead not found", sent_at: new Date().toISOString() })
        .eq("id", job.id);
      failed++;
      continue;
    }

    const result = await sendStageEmail(supabase as never, lead as never, job.template as EmailTemplate);
    await supabase
      .from("scheduled_emails")
      .update({
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : (result.error ?? result.status),
        sent_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, processed: due.length, sent, failed });
}
