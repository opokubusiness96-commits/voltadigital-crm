"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { getActiveOrgId, firstNameOf } from "@/lib/org";
import { LOST_STAGES, MAX_CALL_ATTEMPTS, type Stage, type Source, type TagCategoryId } from "@/lib/types";
import { sendStageEmail, STAGE_EMAIL_MAP, stageEntryTemplate, isBrevoEnabledOrg } from "@/lib/brevo";

type LeadUpdate = Partial<{
  stage: Stage;
  owner_id: string | null;
  value_estimate: number | null;
  notes: string;
  name: string;
  email: string;
  phone: string;
  lost_reason: string | null;
  source_manual: string | null;
}>;

export async function updateLead(id: string, patch: LeadUpdate) {
  const supabase = await getSupabaseServer();

  // Wenn Stage in eine Lost-Stage wandert: lost_reason ist Pflicht
  if (patch.stage && LOST_STAGES.has(patch.stage) && !patch.lost_reason) {
    return { ok: false, error: "lost_reason required for lost stages" };
  }

  // Vor Update: aktuellen Lead lesen (für Stage-from + Brevo-Daten)
  const { data: before } = await supabase
    .from("leads")
    .select("stage, email, email_opt_out, first_name, last_name, name, org_id, owner_id, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Stage-Transition → Brevo Email feuern (best-effort, Fehler nicht propagieren)
  // Nur für freigeschaltete Orgs (Absender info@jeromederes.com → nur Jerome).
  if (before && patch.stage && patch.stage !== before.stage && isBrevoEnabledOrg(before.org_id)) {
    // Stage 1 ohne Calendly-Termin → Buchungs-Einladung statt Bestätigung.
    const template = stageEntryTemplate(patch.stage, {
      hasSetterAppt: !!before.calendly_setter_scheduled_at,
    });
    if (template && before.email) {
      try {
        const admin = getSupabaseServiceRole();
        // Setter-Vorname (= zugewiesener Owner) für den Merge-Tag auflösen.
        let setterName: string | null = null;
        if (before.owner_id) {
          const { data: ownerProfile } = await admin
            .from("profiles")
            .select("display_name")
            .eq("id", before.owner_id)
            .maybeSingle();
          setterName = firstNameOf(ownerProfile?.display_name);
        }
        await sendStageEmail(admin as never, {
          id,
          org_id: before.org_id,
          email: before.email,
          email_opt_out: !!before.email_opt_out,
          first_name: before.first_name,
          last_name: before.last_name,
          name: before.name,
          setter_name: setterName,
          calendly_setter_scheduled_at: before.calendly_setter_scheduled_at,
          calendly_erstgespraech_scheduled_at: before.calendly_erstgespraech_scheduled_at,
        }, template);
      } catch (err) {
        console.error("sendStageEmail failed", err);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

// Button B — "Nummer prüfen": sendet SOFORT die feste Brevo-Vorlage an die Lead-
// Mail, Stage-unabhängig, Re-Send erlaubt (force → Dedup umgangen). Nur für die
// Jerome-Org (isBrevoEnabledOrg). Brevo-Fehler blockiert nichts, wird geloggt +
// zurückgemeldet. Auslöser = "manual" (email_log.meta.trigger).
export async function requestNumberCheck(leadId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: "unauthenticated", error: "not authenticated" };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, org_id, email, email_opt_out, first_name, last_name, name, owner_id, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, status: "not_found", error: "lead not found" };

  // Scoping: kein anderer Mandant darf diese Mail auslösen.
  if (!isBrevoEnabledOrg(lead.org_id)) {
    return { ok: false, status: "org_not_enabled", error: "org not enabled for brevo" };
  }
  if (!lead.email) return { ok: false, status: "no_email", error: "Lead hat keine E-Mail-Adresse" };

  const admin = getSupabaseServiceRole();

  // Setter-Vorname (= Owner) für den Merge-Tag.
  let setterName: string | null = null;
  if (lead.owner_id) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", lead.owner_id)
      .maybeSingle();
    setterName = firstNameOf(ownerProfile?.display_name);
  }

  let status = "failed";
  let error: string | undefined;
  try {
    const res = await sendStageEmail(
      admin as never,
      {
        id: lead.id,
        org_id: lead.org_id,
        email: lead.email,
        email_opt_out: !!lead.email_opt_out,
        first_name: lead.first_name,
        last_name: lead.last_name,
        name: lead.name,
        setter_name: setterName,
        calendly_setter_scheduled_at: lead.calendly_setter_scheduled_at,
        calendly_erstgespraech_scheduled_at: lead.calendly_erstgespraech_scheduled_at,
      },
      "wrong_number_check",
      { force: true, trigger: "manual" },
    );
    status = res.status;
    error = res.error;
  } catch (err) {
    console.error("requestNumberCheck failed", err);
    error = err instanceof Error ? err.message : String(err);
  }

  revalidatePath("/board");
  revalidatePath(`/leads/${leadId}`);
  return { ok: status === "sent", status, error, sentAt: new Date().toISOString() };
}

// "−/+"-Buttons auf der Lead-Karte: telefonische Anrufversuche hoch-/runterzählen.
// delta wird auf ±1 normalisiert und das Ergebnis auf 0..MAX_CALL_ATTEMPTS geklemmt
// (Minus nimmt Fehlklicks zurück). Rein operativ, org-scoping via RLS. Die UI updatet
// optimistisch und gleicht auf den Rückgabewert ab.
export async function adjustCallAttempts(leadId: string, delta: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, call_attempts")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "lead not found" };

  const cur = lead.call_attempts ?? 0;
  const step = delta >= 0 ? 1 : -1;
  const next = Math.max(0, Math.min(cur + step, MAX_CALL_ATTEMPTS));
  // Grenzen erreicht → kein Schreibzugriff nötig.
  if (next === cur) return { ok: true, callAttempts: next };

  const { error } = await supabase.from("leads").update({ call_attempts: next }).eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/board");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, callAttempts: next };
}

// "Nicht erreicht – Mail"-Button (erscheint ab MAX_CALL_ATTEMPTS): sendet EINMALIG
// die No-Show-Recovery-Vorlage (mit Simons Calendly-Buchungslink) an die Lead-Mail.
// Analog zu requestNumberCheck: Jerome-Org-scoped, best-effort, Fehler geloggt.
// Doppel-Schutz: (1) Guard auf no_show_email_sent_at hier, (2) email_log-Idempotenz
// in sendStageEmail (force weggelassen → default false).
export async function sendNoShowMail(leadId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: "unauthenticated", error: "not authenticated" };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, org_id, email, email_opt_out, first_name, last_name, name, owner_id, call_attempts, no_show_email_sent_at, calendly_setter_scheduled_at, calendly_erstgespraech_scheduled_at")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, status: "not_found", error: "lead not found" };

  // Scoping: nur die Brevo-freigeschaltete Org (Jerome) darf diese Mail auslösen.
  if (!isBrevoEnabledOrg(lead.org_id)) {
    return { ok: false, status: "org_not_enabled", error: "org not enabled for brevo" };
  }
  if (lead.no_show_email_sent_at) {
    return { ok: false, status: "already_sent", error: "Mail wurde bereits gesendet" };
  }
  if (!lead.email) return { ok: false, status: "no_email", error: "Lead hat keine E-Mail-Adresse" };

  const admin = getSupabaseServiceRole();

  // Setter-Vorname (= Owner) für den Merge-Tag setterName.
  let setterName: string | null = null;
  if (lead.owner_id) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", lead.owner_id)
      .maybeSingle();
    setterName = firstNameOf(ownerProfile?.display_name);
  }

  let status = "failed";
  let error: string | undefined;
  try {
    const res = await sendStageEmail(
      admin as never,
      {
        id: lead.id,
        org_id: lead.org_id,
        email: lead.email,
        email_opt_out: !!lead.email_opt_out,
        first_name: lead.first_name,
        last_name: lead.last_name,
        name: lead.name,
        setter_name: setterName,
        calendly_setter_scheduled_at: lead.calendly_setter_scheduled_at,
        calendly_erstgespraech_scheduled_at: lead.calendly_erstgespraech_scheduled_at,
      },
      "no_show_after_calls",
      { trigger: "manual" },
    );
    status = res.status;
    error = res.error;
  } catch (err) {
    console.error("sendNoShowMail failed", err);
    error = err instanceof Error ? err.message : String(err);
  }

  // Guard + Marker nur setzen, wenn die Mail real raus ist ODER laut email_log
  // bereits als gesendet gilt (skipped_dup) — in beiden Fällen hat der Lead die
  // Mail. Bei Opt-Out / Fehler bleibt der Button aktiv (Setter sieht den Toast).
  const effectivelySent = status === "sent" || status === "skipped_dup";
  let sentAt: string | undefined;
  if (effectivelySent) {
    sentAt = new Date().toISOString();
    await supabase.from("leads").update({ no_show_email_sent_at: sentAt }).eq("id", leadId);
    await supabase.from("activities").insert({
      org_id: lead.org_id,
      lead_id: leadId,
      type: "lead_updated",
      content: `„Nicht erreicht"-Mail gesendet (nach ${lead.call_attempts ?? 0} Anrufversuchen)`,
      meta: { action: "no_show_mail_sent", status },
      created_by: user.id,
    });
  }

  revalidatePath("/board");
  revalidatePath(`/leads/${leadId}`);
  return { ok: effectivelySent, status, error, sentAt };
}

export async function addTagToLead(leadId: string, tagId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { data: lead } = await supabase
    .from("leads")
    .select("org_id")
    .eq("id", leadId)
    .single();
  if (!lead) return { ok: false, error: "lead not found" };

  const { error } = await supabase.from("lead_tags").insert({
    lead_id: leadId,
    tag_id: tagId,
    org_id: lead.org_id,
    created_by: user.id,
  });
  if (error && !/duplicate/i.test(error.message)) {
    return { ok: false, error: error.message };
  }

  // Activity-Log
  const { data: tag } = await supabase
    .from("tags")
    .select("label, category_id")
    .eq("id", tagId)
    .single();
  if (tag) {
    await supabase.from("activities").insert({
      org_id: lead.org_id,
      lead_id: leadId,
      type: "lead_updated",
      content: `Tag hinzugefügt: ${tag.label} (${tag.category_id})`,
      meta: { action: "tag_added", tag_id: tagId, tag_label: tag.label },
      created_by: user.id,
    });
  }

  revalidatePath("/board");
  revalidatePath("/list");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function removeTagFromLead(leadId: string, tagId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { data: tag } = await supabase
    .from("tags")
    .select("label, category_id, org_id")
    .eq("id", tagId)
    .single();

  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", leadId)
    .eq("tag_id", tagId);
  if (error) return { ok: false, error: error.message };

  if (tag) {
    await supabase.from("activities").insert({
      org_id: tag.org_id,
      lead_id: leadId,
      type: "lead_updated",
      content: `Tag entfernt: ${tag.label}`,
      meta: { action: "tag_removed", tag_id: tagId, tag_label: tag.label },
      created_by: user.id,
    });
  }

  revalidatePath("/board");
  revalidatePath("/list");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function createTag(label: string, categoryId: TagCategoryId) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  // Aktive Org: Kunde = eigene, Agentur = gewählte Kunden-Org (Cookie),
  // damit neue Tags in der aktuell bearbeiteten Pipeline landen.
  const orgId = await getActiveOrgId();
  if (!orgId) return { ok: false, error: "keine aktive Org" };

  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "label required" };

  const { data, error } = await supabase
    .from("tags")
    .insert({ org_id: orgId, category_id: categoryId, label: trimmed })
    .select("id, label, category_id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/board");
  return { ok: true, tag: data };
}

export async function claimLead(leadId: string, userId: string | null) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { error } = await supabase
    .from("leads")
    .update({ owner_id: userId })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  const { data: lead } = await supabase
    .from("leads")
    .select("org_id")
    .eq("id", leadId)
    .single();

  // Sync zu lead_assignments: bei null owner alle clearen, sonst den als single Assignment
  if (lead) {
    if (userId === null) {
      await supabase.from("lead_assignments").delete().eq("lead_id", leadId);
    } else {
      // Alle bestehenden löschen + neuen Eintrag (= "exclusive claim" Verhalten via Board-Card)
      await supabase.from("lead_assignments").delete().eq("lead_id", leadId);
      await supabase.from("lead_assignments").insert({
        lead_id: leadId,
        user_id: userId,
        org_id: lead.org_id,
        assigned_by: user.id,
      });
    }

    await supabase.from("activities").insert({
      org_id: lead.org_id,
      lead_id: leadId,
      type: "lead_updated",
      content: userId ? "Lead beansprucht" : "Lead freigegeben",
      created_by: user.id,
    });
  }

  revalidatePath("/board");
  revalidatePath("/list");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function assignUser(leadId: string, userId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { data: lead } = await supabase
    .from("leads")
    .select("org_id, owner_id")
    .eq("id", leadId)
    .single();
  if (!lead) return { ok: false, error: "lead not found" };

  const { error } = await supabase.from("lead_assignments").insert({
    lead_id: leadId,
    user_id: userId,
    org_id: lead.org_id,
    assigned_by: user.id,
  });
  if (error && !/duplicate/i.test(error.message)) {
    return { ok: false, error: error.message };
  }

  // Wenn noch kein primary owner → diesen User als primary setzen
  if (!lead.owner_id) {
    await supabase.from("leads").update({ owner_id: userId }).eq("id", leadId);
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .single();
  await supabase.from("activities").insert({
    org_id: lead.org_id,
    lead_id: leadId,
    type: "lead_updated",
    content: `User zugewiesen: ${target?.display_name || target?.email || userId}`,
    created_by: user.id,
  });

  revalidatePath("/board");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function unassignUser(leadId: string, userId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { error } = await supabase
    .from("lead_assignments")
    .delete()
    .eq("lead_id", leadId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  // Falls primary owner entfernt → fallback auf nächsten Assignment, sonst null
  const { data: lead } = await supabase
    .from("leads")
    .select("org_id, owner_id")
    .eq("id", leadId)
    .single();
  if (lead?.owner_id === userId) {
    const { data: remaining } = await supabase
      .from("lead_assignments")
      .select("user_id")
      .eq("lead_id", leadId)
      .order("assigned_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    await supabase.from("leads")
      .update({ owner_id: remaining?.user_id ?? null })
      .eq("id", leadId);
  }

  if (lead) {
    const { data: target } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", userId)
      .single();
    await supabase.from("activities").insert({
      org_id: lead.org_id,
      lead_id: leadId,
      type: "lead_updated",
      content: `User entfernt: ${target?.display_name || target?.email || userId}`,
      created_by: user.id,
    });
  }

  revalidatePath("/board");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function addNote(leadId: string, content: string) {
  if (!content.trim()) return { ok: false, error: "empty note" };
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: lead } = await supabase
    .from("leads")
    .select("org_id")
    .eq("id", leadId)
    .single();
  if (!lead) return { ok: false, error: "lead not found" };

  const { error } = await supabase.from("activities").insert({
    org_id: lead.org_id,
    lead_id: leadId,
    type: "note",
    content: content.trim(),
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function createLead(input: {
  name: string;
  email: string;
  phone?: string;
  source: Source;
  source_manual?: string;
  value_estimate?: number;
  notes?: string;
}) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  // Aktive Org: Kunde = eigene, Agentur = gewählte Kunden-Org (Cookie).
  const orgId = await getActiveOrgId();
  if (!orgId) return { ok: false, error: "keine aktive Org" };

  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id: orgId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      source: input.source,
      source_manual: input.source_manual ?? null,
      value_estimate: input.value_estimate ?? null,
      notes: input.notes ?? null,
      stage: "setter_call_booked",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  await supabase.from("activities").insert({
    org_id: orgId,
    lead_id: data.id,
    type: "lead_created",
    content: "Lead manuell angelegt",
    created_by: user.id,
  });

  // Manuell angelegte Leads kommen ohne Calendly-Termin rein → sofort die
  // Buchungs-Einladung mit Simons Kalender schicken (best-effort; nur für die
  // Brevo-freigeschaltete Org, kein Opt-out). So bekommt auch ein nicht über
  // Calendly reingekommener Lead direkt den Weg zum Erstgespräch.
  if (input.email && isBrevoEnabledOrg(orgId)) {
    const template = stageEntryTemplate("setter_call_booked", { hasSetterAppt: false });
    if (template) {
      try {
        const admin = getSupabaseServiceRole();
        await sendStageEmail(admin as never, {
          id: data.id,
          org_id: orgId,
          email: input.email,
          email_opt_out: false,
          first_name: null,
          last_name: null,
          name: input.name,
          calendly_setter_scheduled_at: null,
          calendly_erstgespraech_scheduled_at: null,
        } as never, template);
      } catch (err) {
        console.error("createLead: booking invitation failed", err);
      }
    }
  }

  revalidatePath("/");
  redirect(`/leads/${data.id}`);
}
