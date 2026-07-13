import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { sendStageEmail, STAGE_EMAIL_MAP, isBrevoEnabledOrg } from "@/lib/brevo";
import type { Stage } from "@/lib/types";

export const runtime = "nodejs";

// Calendly schickt v1=...,t=... — wir brauchen sowohl den Body-Hash als auch den Timestamp
function verifyCalendlySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k.trim(), v?.trim() ?? ""];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const data = `${t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("hex");

  // Length-safe compare
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type CalendlyInvitee = {
  uri?: string;
  name?: string;
  email?: string;
  text_reminder_number?: string | null;
  timezone?: string | null;
  questions_and_answers?: Array<{ question?: string; answer?: string }>;
  tracking?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  } | null;
};

type CalendlyEvent = {
  uri?: string;
  start_time?: string;
  name?: string;
  event_type?: string;
  // Hosts/Members des Events — in v2 immer mit user_uri pro Member.
  // Wir nutzen das Array zur Setter-Identifikation (siehe SETTERS-Map weiter unten).
  event_memberships?: Array<{
    user?: string;
    user_email?: string;
    user_name?: string;
  }>;
};

// Calendly v2 Webhook: Invitee-Daten sind FLACH unter payload (kein invitee-Sub-Object).
// v1 hatte payload.invitee.{email,name,...}. Wir akzeptieren beides defensiv.
type CalendlyPayload = {
  event: "invitee.created" | "invitee.canceled" | string;
  payload: CalendlyInvitee & {
    invitee?: CalendlyInvitee; // v1 Fallback
    event?: CalendlyEvent;
    scheduled_event?: CalendlyEvent;
    cancellation?: { reason?: string; canceled_by?: string };
  };
};

// Vereinheitlicht v1 und v2 Payload-Strukturen
function extractInvitee(payload: CalendlyPayload["payload"]): CalendlyInvitee {
  // v2: alles flach unter payload. v1: payload.invitee. Wir nehmen v2 zuerst, fallback v1.
  return {
    uri: payload.uri ?? payload.invitee?.uri,
    name: payload.name ?? payload.invitee?.name,
    email: payload.email ?? payload.invitee?.email,
    text_reminder_number: payload.text_reminder_number ?? payload.invitee?.text_reminder_number,
    timezone: payload.timezone ?? payload.invitee?.timezone,
    questions_and_answers: payload.questions_and_answers ?? payload.invitee?.questions_and_answers,
    tracking: payload.tracking ?? payload.invitee?.tracking,
  };
}

function detectStageFromEventName(eventName: string | undefined): Stage | null {
  if (!eventName) return null;
  const n = eventName.toLowerCase();
  // Setter Call = 15-Minuten Qualifikations-Call (Clarity Call)
  if (n.includes("clarity") || n.includes("klarheit") || n.includes("setter") || n.includes("15"))
    return "setter_call_booked";
  // Klarheitsgespräch / Strategy Call = 60-Minuten Pitch-Call mit Jerome
  if (n.includes("klarheitsgespraech") || n.includes("klarheitsgespräch") || n.includes("erstgespraech") || n.includes("erstgespräch") || n.includes("strategy") || n.includes("60"))
    return "klarheitsgespraech_booked";
  return null;
}

// Mappt Calendly questions_and_answers auf bekannte CRM-Felder
function extractAnswers(qaList: Array<{ question?: string; answer?: string }> | undefined) {
  const out: { phone?: string; business_years?: string; revenue_band?: string } = {};
  if (!Array.isArray(qaList)) return out;

  const businessYearsMap: Record<string, string> = {
    "noch nicht selbstständig": "noch_nicht",
    "noch nicht selbststaendig": "noch_nicht",
    "weniger als 1 jahr": "unter_1",
    "1 bis 3 jahre": "1_3",
    "3 bis 5 jahre": "3_5",
    "mehr als 5 jahre": "ueber_5",
  };
  const revenueMap: Record<string, string> = {
    "unter 50.000": "unter_50k",
    "50.000 bis 150.000": "50_150k",
    "150.000 bis 500.000": "150_500k",
    "500.000": "500k_1m", // Anfang von "500.000 € bis 1 Mio €"
    "über 1 mio": "ueber_1m",
    "ueber 1 mio": "ueber_1m",
  };

  for (const qa of qaList) {
    const q = (qa.question ?? "").toLowerCase();
    const a = (qa.answer ?? "").trim();
    if (!a) continue;
    if (/telefon|phone/i.test(q)) {
      out.phone = a;
    } else if (/unternehm|seit wann|business/i.test(q)) {
      const ak = a.toLowerCase();
      const matched = Object.entries(businessYearsMap).find(([k]) => ak.includes(k));
      if (matched) out.business_years = matched[1];
    } else if (/umsatz|revenue|jahresumsatz/i.test(q)) {
      const ak = a.toLowerCase();
      const matched = Object.entries(revenueMap).find(([k]) => ak.includes(k));
      if (matched) out.revenue_band = matched[1];
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setter-Mapping: welcher Calendly-Account gehört zu welchem Setter
// ─────────────────────────────────────────────────────────────────────────────
// Slug = lesbarer Key (matcht visuell die Calendly-URL `calendly.com/<slug>`).
// Calendly-Webhook-Payload enthält den Slug NICHT direkt — wir matchen daher
// gegen `event_memberships[].user` (canonical user_uri). profile_email wird
// für den Lookup gegen die DB-Tabelle `profiles` benutzt, um den `owner_id`
// des Leads zu setzen.
//
// Neuen Setter hinzufügen:
//   1. Calendly Personal Access Token vom neuen Setter holen
//   2. GET /users/me → uri kopieren
//   3. Neuer Eintrag hier: slug aus calendly.com/<slug>, user_uri aus Schritt 2,
//      profile_email = Email mit der sich der Setter im CRM einloggt
const SETTERS: Record<string, { calendly_user_uri: string; profile_email: string }> = {
  "simon-damm": {
    calendly_user_uri: "https://api.calendly.com/users/bc4deb97-377b-41cf-a34d-7d411388768e",
    profile_email: "Simon.damm007@gmail.com",
  },
  // "jerome-deres": { calendly_user_uri: "...", profile_email: "..." },
  // "heidi-yeboah": { calendly_user_uri: "...", profile_email: "..." },
};

type SetterMatch = { slug: string; calendly_user_uri: string; profile_email: string };

function findSetter(eventObj: CalendlyEvent | undefined): SetterMatch | null {
  const memberships = eventObj?.event_memberships;
  if (!Array.isArray(memberships) || memberships.length === 0) return null;
  const userUris = new Set(
    memberships.map((m) => m?.user).filter((u): u is string => typeof u === "string"),
  );
  for (const [slug, cfg] of Object.entries(SETTERS)) {
    if (userUris.has(cfg.calendly_user_uri)) {
      return { slug, ...cfg };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage-Promotion-Klassifikation (für Lead-Update auf existing Lead)
// ─────────────────────────────────────────────────────────────────────────────
// Calendly liefert keine "Funnel-Ranking-Info" — die Listen unten klassifizieren
// die EXISTIERENDE Lead-Stage gegenüber der NEUEN Stage aus dem Webhook
// (i.d.R. setter_call_booked). klarheitsgespraech_booked hat eigene Vorrang-
// Logik weiter unten (späteste Funnel-Stage, immer erlaubt).
//
// Erweitern:
//   - Wenn neue Vor-Setter-Stages dazukommen (Lead-Magnet, Import, etc.)
//     → in EARLY_STAGES eintragen (dokumentarisch, da Default-Verhalten
//       sowieso "überschreiben" ist).
//   - Wenn neue Post-Setter-Stages dazukommen (neuer Funnel-Schritt nach
//     setter_call_booked) → in TERMINAL_STAGES eintragen.

// Stages aus denen ein erneuter setter_call_booked-Webhook hochpromoten darf.
// Aktuell leer im Active-Code, reserviert für künftige Vor-Setter-Stages.
const EARLY_STAGES: readonly string[] = [
  // z.B. "neu", "lead_imported", "manual_entry"
];

// Stages bei denen ein erneuter setter_call_booked-Webhook NICHT überschreiben
// darf (sonst würde der Lead im Funnel zurückspringen). Umfasst Active-Stages
// aus lib/types.ts STAGES PLUS Legacy-DB-Enum-Werte (siehe Kommentar dort).
const TERMINAL_STAGES: readonly string[] = [
  // Active (lib/types.ts STAGES) — alles ab setter_call_booked aufwärts
  "setter_no_show",
  "setter_lost",
  "klarheitsgespraech_booked",
  "klarheitsgespraech_no_show",
  "klarheitsgespraech_lost",
  "won",
  // Legacy DB-Enum (UI rendert sie nicht mehr, DB hat sie noch)
  "setter_call_done",
  "setter_won",
  "erstgespraech_done",
  "lost",
];

export async function POST(req: Request) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CALENDLY_WEBHOOK_SECRET not set");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("calendly-webhook-signature");

  if (!verifyCalendlySignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let body: CalendlyPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();

  const orgSlug = process.env.DEFAULT_ORG_SLUG || "jerome";
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();

  if (orgErr || !org) {
    console.error("Organization lookup failed", orgErr);
    return NextResponse.json({ ok: false, error: "org not found" }, { status: 500 });
  }
  const orgId = org.id;

  const invitee = extractInvitee(body.payload);
  const eventObj = body.payload?.scheduled_event || body.payload?.event;
  // Wichtig: in v2 ist payload.name der Invitee-Name, NICHT der Event-Typ-Name. Daher nicht als Fallback nutzen.
  const eventName = eventObj?.name;
  const eventUri = eventObj?.uri;
  const scheduledAt = eventObj?.start_time;
  const setter = findSetter(eventObj);

  if (body.event === "invitee.created") {
    // Setter-Bookings (z.B. Simon's "Discovery Call") matchen die existierende
    // Name-Detection nicht — daher Fallback: jedes Mapped-Setter-Booking ist
    // ein Setter-Call. Falls Name-Detection schon trifft (z.B. "15 Min Setter"),
    // hat die Vorrang und bleibt unangefasst.
    const stage: Stage | null =
      detectStageFromEventName(eventName) ??
      (setter ? ("setter_call_booked" as Stage) : null);
    if (!stage) {
      console.warn("Calendly event with unknown type", eventName);
      return NextResponse.json({ ok: true, skipped: "unknown event type" });
    }

    const isSetterStage = stage === "setter_call_booked";
    const utm = invitee?.tracking ?? {};
    const answers = extractAnswers(invitee?.questions_and_answers);
    const phoneFromAnswers = answers.phone ?? invitee?.text_reminder_number ?? undefined;

    // Versuch: bestehenden Lead anhand Email finden, sonst neuen anlegen
    let leadId: string | null = null;
    let existingStage: string | null = null;
    if (invitee?.email) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id, stage, phone, business_years, revenue_band")
        .eq("org_id", orgId)
        .eq("email", invitee.email.toLowerCase())
        .maybeSingle();
      if (existing) {
        leadId = existing.id;
        existingStage = (existing as { stage?: string | null }).stage ?? null;
      }
    }

    // Name in first/last splitten
    const fullName = invitee?.name || undefined;
    const nameParts = fullName?.trim().split(/\s+/) ?? [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

    const updatePayload: Record<string, unknown> = {
      stage,
      source: isSetterStage ? "calendly_setter" : "calendly_erstgespraech",
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      email: invitee?.email?.toLowerCase() || undefined,
      phone: phoneFromAnswers || undefined,
      business_years: answers.business_years || undefined,
      revenue_band: answers.revenue_band || undefined,
      utm_source: utm.utm_source || undefined,
      utm_medium: utm.utm_medium || undefined,
      utm_campaign: utm.utm_campaign || undefined,
      utm_content: utm.utm_content || undefined,
    };

    if (isSetterStage) {
      updatePayload.calendly_setter_event_uri = eventUri;
      updatePayload.calendly_setter_scheduled_at = scheduledAt;
    } else {
      updatePayload.calendly_erstgespraech_event_uri = eventUri;
      updatePayload.calendly_erstgespraech_scheduled_at = scheduledAt;
    }

    // Setter Auto-Assignment: wenn der Calendly-Account des Bookings in SETTERS
    // gemappt ist, sein Profile per Email finden und als owner_id setzen.
    // Wenn das Profile (yet) nicht existiert — z.B. Setter hat sich noch nicht
    // im CRM eingeloggt — fällt der Assign still durch und der Lead bleibt
    // ohne owner_id (manuelle Zuweisung über Board weiterhin möglich).
    let setterProfileId: string | null = null;
    if (setter) {
      const { data: setterProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("org_id", orgId)
        .ilike("email", setter.profile_email)
        .maybeSingle();
      if (setterProfile?.id) {
        setterProfileId = setterProfile.id;
        updatePayload.owner_id = setterProfileId;
      } else {
        console.warn(
          `Calendly: Setter-Match auf slug=${setter.slug} (uri=${setter.calendly_user_uri}),`,
          `aber profiles-Row für ${setter.profile_email} fehlt —`,
          `Lead bleibt unassigned bis Setter sich einmal im CRM einloggt.`,
        );
      }
    }

    if (leadId) {
      // Stage-Promotion-Regeln (siehe EARLY_STAGES / TERMINAL_STAGES oben):
      //   - klarheitsgespraech_booked: immer (späteste Funnel-Stage)
      //   - setter_call_booked: nur wenn existing.stage NICHT in TERMINAL_STAGES
      //   - Andere Stages: kein Override (kommen aus dem Code-Pfad aktuell nicht)
      const isTerminal = TERMINAL_STAGES.includes(existingStage ?? "");
      const stageUpdateAllowed =
        stage === "klarheitsgespraech_booked" ||
        (stage === "setter_call_booked" && !isTerminal);

      // EARLY_STAGES wird aktuell nicht ausgewertet (Default: alles was nicht
      // TERMINAL ist, darf promoten). Reserviert für künftige Strict-Mode-Variante.
      void EARLY_STAGES;

      if (
        !stageUpdateAllowed &&
        existingStage &&
        existingStage !== stage
      ) {
        console.warn(
          `Calendly: Stage-Override blockiert für lead_id=${leadId}.`,
          `existing=${existingStage}, incoming=${stage} —`,
          `Lead bleibt in existierender Stage (TERMINAL_STAGES enthält ${existingStage}).`,
        );
      }

      const finalUpdate = stageUpdateAllowed
        ? updatePayload
        : { ...updatePayload, stage: undefined };

      await supabase.from("leads").update(finalUpdate).eq("id", leadId);
    } else {
      const { data: newLead, error: insertErr } = await supabase
        .from("leads")
        .insert({ org_id: orgId, ...updatePayload })
        .select("id")
        .single();
      if (insertErr || !newLead) {
        console.error("Lead insert failed", insertErr);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      leadId = newLead.id;
    }

    await supabase.from("activities").insert({
      org_id: orgId,
      lead_id: leadId,
      type: "booking",
      content: `${eventName ?? "Calendly"} gebucht (${invitee?.email ?? "unbekannt"})`,
      meta: {
        event_uri: eventUri,
        scheduled_at: scheduledAt,
        utm,
        ...(setter ? { setter_slug: setter.slug } : {}),
      },
    });

    // lead_assignments-Mirror für den Setter (analog wie app/leads/actions.ts
    // es beim manuellen Drag-and-Drop im Board macht). Idempotent via upsert
    // mit Composite-Key (lead_id, user_id).
    if (setterProfileId && leadId) {
      const { error: assignErr } = await supabase
        .from("lead_assignments")
        .upsert(
          { lead_id: leadId, user_id: setterProfileId, org_id: orgId },
          { onConflict: "lead_id,user_id" },
        );
      if (assignErr) {
        console.error("lead_assignments upsert failed", assignErr);
      }
    }

    // Brevo: Confirmation-Email + Reminder-Scheduling (best-effort).
    // isBrevoEnabledOrg absichert zusätzlich, dass NUR Jerome-Leads Mails auslösen
    // (der Webhook läuft ohnehin nur für DEFAULT_ORG_SLUG, aber doppelt hält besser).
    if (invitee?.email && isBrevoEnabledOrg(orgId)) {
      const { data: leadFull } = await supabase
        .from("leads")
        .select("id, org_id, email, email_opt_out, first_name, last_name, name, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at")
        .eq("id", leadId)
        .maybeSingle();
      if (leadFull) {
        const template = STAGE_EMAIL_MAP[stage];
        if (template) {
          try {
            await sendStageEmail(supabase as never, leadFull as never, template);
          } catch (e) {
            console.error("Calendly webhook: Brevo confirmation send failed", e);
          }
        }
        // Zeitbasierte Reminder (24h/1h) bewusst noch NICHT scharf — nur wenn
        // REMINDERS_ENABLED=true. Sonst bleibt scheduled_emails/Cron ein Stub.
        if (isSetterStage && scheduledAt && process.env.REMINDERS_ENABLED === "true") {
          const scheduled = new Date(scheduledAt).getTime();
          const reminders: Array<{ template: string; offsetMs: number }> = [
            { template: "setter_call_reminder_24h", offsetMs: -24 * 3_600_000 },
            { template: "setter_call_reminder_1h", offsetMs: -3_600_000 },
          ];
          for (const r of reminders) {
            const runAt = new Date(scheduled + r.offsetMs);
            if (runAt.getTime() > Date.now() + 60_000) {
              await supabase.from("scheduled_emails").insert({
                org_id: orgId,
                lead_id: leadId,
                template: r.template,
                run_at: runAt.toISOString(),
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, lead_id: leadId, stage });
  }

  if (body.event === "invitee.canceled") {
    // Lead identifizieren: bevorzugt über event_uri, fallback Email
    let leadId: string | null = null;

    if (eventUri) {
      const { data: byUri } = await supabase
        .from("leads")
        .select("id")
        .eq("org_id", orgId)
        .or(
          `calendly_setter_event_uri.eq.${eventUri},calendly_erstgespraech_event_uri.eq.${eventUri}`,
        )
        .maybeSingle();
      if (byUri) leadId = byUri.id;
    }

    if (!leadId && invitee?.email) {
      const { data: byEmail } = await supabase
        .from("leads")
        .select("id")
        .eq("org_id", orgId)
        .eq("email", invitee.email)
        .maybeSingle();
      if (byEmail) leadId = byEmail.id;
    }

    if (leadId) {
      await supabase.from("activities").insert({
        org_id: orgId,
        lead_id: leadId,
        type: "booking_canceled",
        content: `${eventName ?? "Calendly"} abgesagt${
          body.payload?.cancellation?.reason
            ? ` — Grund: ${body.payload.cancellation.reason}`
            : ""
        }`,
        meta: {
          event_uri: eventUri,
          cancellation: body.payload?.cancellation ?? null,
        },
      });

      // Pending Reminders für diesen Lead canceln
      await supabase
        .from("scheduled_emails")
        .update({ status: "canceled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");
    } else {
      console.warn("invitee.canceled für unbekannten Lead", { eventUri, email: invitee?.email });
    }

    return NextResponse.json({ ok: true, lead_id: leadId, canceled: true });
  }

  return NextResponse.json({ ok: true, skipped: body.event });
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "Calendly webhook endpoint" });
}
