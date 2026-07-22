import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import {
  isBrevoEnabledOrg,
  sendBrevoEmail,
  templateParams,
  type LeadForEmail,
} from "@/lib/brevo";

export const runtime = "nodejs";

// Nurture-Drip (täglicher Vercel-Cron): Leads in "Setter Call gebucht", die
// noch KEINEN Calendly-Termin haben, bekommen alle 2 Tage eine individuelle
// Einladung, sich bei Simon einzutragen — bis sie buchen, die Stage verlassen,
// sich abmelden, im Papierkorb landen oder NURTURE_MAX_SENDS erreicht ist.
// Buchung beendet den Drip automatisch: der Calendly-Webhook setzt
// calendly_setter_scheduled_at, damit fällt der Lead aus der Query.
//
// Kein neuer Stage-Zustand, kein Scheduling-State: die Sende-Historie lebt im
// email_log (template = nurture_booking_<n>), daraus ergeben sich Zähler und
// Abstand. Scharf nur mit NURTURE_ENABLED=true.
const LOG_PREFIX = "nurture_booking_";

export async function GET(req: Request) {
  // Vercel Cron sendet "Authorization: Bearer ${CRON_SECRET}"
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.NURTURE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "nurture disabled" });
  }

  const tplId = parseInt(process.env.BREVO_TPL_NURTURE_BOOKING || "", 10);
  if (!Number.isFinite(tplId)) {
    return NextResponse.json(
      { ok: false, error: "BREVO_TPL_NURTURE_BOOKING missing" },
      { status: 500 },
    );
  }

  const maxSends = Math.max(1, parseInt(process.env.NURTURE_MAX_SENDS || "5", 10) || 5);
  // 2 Tage minus 1 h Toleranz, damit ein täglicher Cron nicht wegen weniger
  // Minuten Versatz einen ganzen Tag überspringt.
  const intervalMs = 2 * 24 * 3_600_000 - 3_600_000;

  const supabase = getSupabaseServiceRole();

  const orgSlug = process.env.DEFAULT_ORG_SLUG || "jerome";
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();
  if (orgErr || !org || !isBrevoEnabledOrg(org.id)) {
    return NextResponse.json(
      { ok: false, error: "org not found or not brevo-enabled" },
      { status: 500 },
    );
  }

  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select(
      "id, org_id, email, first_name, last_name, name, email_opt_out, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at",
    )
    .eq("org_id", org.id)
    .eq("stage", "setter_call_booked")
    .is("calendly_setter_scheduled_at", null)
    .is("trashed_at", null)
    .eq("archived", false)
    .eq("email_opt_out", false)
    .not("email", "is", null)
    // Älteste zuerst — deterministisch, damit bei >200 Leads nicht immer
    // dieselben (durch skippedMax/skippedRecent belegten) Slots gewinnen.
    .order("created_at", { ascending: true })
    .limit(200);
  if (leadsErr) {
    return NextResponse.json({ ok: false, error: leadsErr.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skippedRecent = 0;
  let skippedMax = 0;

  for (const lead of leads ?? []) {
    if (!lead.email) continue;

    // sent UND failed zählen: sonst würde eine dauerhaft an Brevo scheiternde
    // Adresse (4xx) täglich neu angemailt (failed erhöht count/sent_at nie) und
    // liefe nie in maxSends. Jeder Versuch = eine Zeile → count = Versuchszahl.
    // email_log.sent_at ist auch bei failed gesetzt (Schema-Default now()).
    const { data: logs } = await supabase
      .from("email_log")
      .select("sent_at")
      .eq("lead_id", lead.id)
      .like("template", `${LOG_PREFIX}%`)
      .in("status", ["sent", "failed"])
      .order("sent_at", { ascending: false });

    const count = logs?.length ?? 0;
    if (count >= maxSends) {
      skippedMax++;
      continue;
    }
    if (count > 0 && Date.now() - new Date(logs![0].sent_at).getTime() < intervalMs) {
      skippedRecent++;
      continue;
    }

    // Netzwerk-/DNS-Fehler wirft sendBrevoEmail (fängt nur HTTP-Status ab) — ohne
    // Guard würde eine Rejection den ganzen Tageslauf abbrechen (alle weiteren
    // Leads unversendet). Als failed behandeln, Loop läuft weiter.
    let result: Awaited<ReturnType<typeof sendBrevoEmail>>;
    try {
      result = await sendBrevoEmail({
        to: {
          email: lead.email,
          name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || undefined,
        },
        templateId: tplId,
        params: templateParams(lead as LeadForEmail),
      });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    const { error: logErr } = await supabase.from("email_log").insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template: `${LOG_PREFIX}${count + 1}`,
      to_email: lead.email,
      status: result.ok ? "sent" : "failed",
      ...(result.ok ? { brevo_message_id: result.messageId } : { error: result.error }),
      meta: { trigger: "nurture", seq: count + 1 },
    });
    // Der gesamte Drip-Zustand (Zähler, Abstand) lebt in dieser Zeile. Schlägt der
    // Insert nach erfolgreichem Versand fehl, würde der nächste Lauf erneut senden
    // — sichtbar machen statt still schlucken.
    if (logErr) {
      console.error(`nurture: email_log insert failed for lead ${lead.id} after send (${result.ok ? "sent" : "failed"}):`, logErr.message);
    }

    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    checked: (leads ?? []).length,
    sent,
    failed,
    skippedRecent,
    skippedMax,
  });
}
