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
// Sofort-Einladung bei Lead-Anlage (lib/brevo stageEntryTemplate) — zählt als
// erster Buchungs-Touch, damit der Drip nicht direkt danach nochmal sendet.
const INVITE_TEMPLATE = "setter_booking_invitation";
// Einmalige Reaktivierungs-Broadcasts (email_log-Key reactivation_*) zählen
// ebenfalls als Buchungs-Touch — sonst käme direkt nach einem Broadcast schon
// die erste Drip-Mail.
const REACTIVATION_PREFIX = "reactivation_";

// Eskalierende Follow-up-Sequenz: enge Abstände am Anfang (Intention nach dem
// Eintragen am höchsten), dann auslaufend — jede Stufe mit eigenem Text/Winkel,
// aber immer Simons Buchungslink. afterDays = Abstand zum vorherigen Touch.
// maxSends ergibt sich aus der Länge; NURTURE_MAX_SENDS kann kürzen.
const NURTURE_SEQUENCE: Array<{ afterDays: number; tplEnv: string }> = [
  { afterDays: 2, tplEnv: "BREVO_TPL_NURTURE_1" }, // Erinnerung
  { afterDays: 3, tplEnv: "BREVO_TPL_NURTURE_2" }, // Was im Call passiert
  { afterDays: 5, tplEnv: "BREVO_TPL_NURTURE_3" }, // sanfte Dringlichkeit
  { afterDays: 7, tplEnv: "BREVO_TPL_NURTURE_4" }, // Breakup / letzte Mail
];

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

  // Template-IDs der Sequenz-Stufen auflösen; fehlt eine, wird die Sequenz dort
  // gekappt (lieber kürzere Sequenz als ein 500, das den ganzen Lauf abbricht).
  const steps = NURTURE_SEQUENCE.map((s) => ({
    afterDays: s.afterDays,
    tplId: parseInt(process.env[s.tplEnv] || "", 10),
  })).filter((s) => Number.isFinite(s.tplId));
  if (steps.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no BREVO_TPL_NURTURE_* configured" },
      { status: 500 },
    );
  }
  // NURTURE_MAX_SENDS kann die Sequenz zusätzlich kürzen (nicht verlängern).
  const cap = parseInt(process.env.NURTURE_MAX_SENDS || "", 10);
  const maxSends = Number.isFinite(cap) ? Math.min(steps.length, Math.max(1, cap)) : steps.length;

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
    // liefe nie in maxSends. email_log.sent_at ist auch bei failed gesetzt.
    // Die Sofort-Einladung bei Lead-Anlage (setter_booking_invitation) zählt als
    // erster Touch mit — sonst käme direkt nach ihr die erste Drip-Mail.
    const { data: logs } = await supabase
      .from("email_log")
      .select("template, sent_at")
      .eq("lead_id", lead.id)
      .or(
        `template.eq.${INVITE_TEMPLATE},template.like.${LOG_PREFIX}%,template.like.${REACTIVATION_PREFIX}%`,
      )
      .in("status", ["sent", "failed"])
      .order("sent_at", { ascending: false });

    const touches = logs ?? [];
    const totalTouches = touches.length;
    // nurtureCount = bereits gesendete Drip-Mails → bestimmt die nächste Stufe.
    // Sofort-Einladung + Reaktivierung zählen NICHT als Stufe, aber als Touch
    // fürs Timing (touches[0] = letzter beliebiger Buchungs-Touch).
    const nurtureCount = touches.filter((t) => (t.template as string).startsWith(LOG_PREFIX)).length;
    if (nurtureCount >= maxSends) {
      skippedMax++;
      continue;
    }
    const step = steps[nurtureCount];
    // Abstand dieser Stufe zum letzten Touch (eskalierend), −1 h Cron-Toleranz.
    const stepIntervalMs = step.afterDays * 24 * 3_600_000 - 3_600_000;
    if (totalTouches > 0 && Date.now() - new Date(touches[0].sent_at).getTime() < stepIntervalMs) {
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
        templateId: step.tplId,
        params: templateParams(lead as LeadForEmail),
      });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    const { error: logErr } = await supabase.from("email_log").insert({
      org_id: lead.org_id,
      lead_id: lead.id,
      template: `${LOG_PREFIX}${nurtureCount + 1}`,
      to_email: lead.email,
      status: result.ok ? "sent" : "failed",
      ...(result.ok ? { brevo_message_id: result.messageId } : { error: result.error }),
      meta: { trigger: "nurture", seq: nurtureCount + 1 },
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
