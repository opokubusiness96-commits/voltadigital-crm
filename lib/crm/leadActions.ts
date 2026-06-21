"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logActivity } from "./activityLog";
import type { CallOutcome, LossReason } from "./types";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getCtx() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error("Kein Profil");
  return { supabase, userId: user.id, orgId: profile.org_id as string };
}

function bust() {
  revalidatePath("/board");
  revalidatePath("/list");
}

// ─────────────────────────────────────────────────────────── notes
export async function addNote(leadId: string, content: string): Promise<ActionResult> {
  if (!content.trim()) return { ok: false, error: "Notiz darf nicht leer sein" };
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("notes").insert({
      org_id: orgId,
      lead_id: leadId,
      content: content.trim(),
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };
    await logActivity({
      supabase,
      orgId,
      leadId,
      type: "note_added",
      content: content.trim().slice(0, 200),
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────── call_logs
export async function logCall(args: {
  leadId: string;
  outcome: CallOutcome;
  durationMinutes?: number | null;
  note?: string | null;
  setFollowUpTag?: boolean;
}): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("call_logs").insert({
      org_id: orgId,
      lead_id: args.leadId,
      outcome: args.outcome,
      duration_minutes: args.durationMinutes ?? null,
      note: args.note?.trim() || null,
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };
    await logActivity({
      supabase,
      orgId,
      leadId: args.leadId,
      type: "call_logged",
      content: `${args.outcome}${args.durationMinutes ? ` · ${args.durationMinutes} min` : ""}`,
      meta: { outcome: args.outcome, duration_minutes: args.durationMinutes ?? null },
      userId,
    });

    if (args.setFollowUpTag) {
      const { data: tag } = await supabase
        .from("tags")
        .select("id")
        .ilike("label", "Follow-Up faellig")
        .maybeSingle();
      if (tag) {
        await supabase.from("lead_tags").upsert(
          { lead_id: args.leadId, tag_id: tag.id },
          { onConflict: "lead_id,tag_id" },
        );
      }
    }
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────── tasks
export async function createTask(args: {
  leadId: string;
  title: string;
  dueDate?: string | null;
  assigneeId?: string | null;
}): Promise<ActionResult> {
  if (!args.title.trim()) return { ok: false, error: "Titel fehlt" };
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("tasks").insert({
      org_id: orgId,
      lead_id: args.leadId,
      title: args.title.trim(),
      due_date: args.dueDate ?? null,
      assignee_id: args.assigneeId ?? null,
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };
    await logActivity({
      supabase,
      orgId,
      leadId: args.leadId,
      type: "task_created",
      content: args.title.trim(),
      meta: { due_date: args.dueDate ?? null, assignee_id: args.assigneeId ?? null },
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────── follow-up
export async function scheduleFollowUp(args: {
  leadId: string;
  dueAt: string;
  note?: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("tasks").insert({
      org_id: orgId,
      lead_id: args.leadId,
      title: args.note?.trim() || "Follow-Up",
      due_date: args.dueAt,
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };

    const { data: tag } = await supabase
      .from("tags")
      .select("id")
      .ilike("label", "Follow-Up faellig")
      .maybeSingle();
    if (tag) {
      await supabase.from("lead_tags").upsert(
        { lead_id: args.leadId, tag_id: tag.id },
        { onConflict: "lead_id,tag_id" },
      );
    }

    await logActivity({
      supabase,
      orgId,
      leadId: args.leadId,
      type: "followup_scheduled",
      content: args.dueAt,
      meta: { due_at: args.dueAt },
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────── assignee
export async function assignLead(leadId: string, assigneeId: string | null): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase
      .from("leads")
      .update({ assignee_id: assigneeId })
      .eq("id", leadId);
    if (error) return { ok: false, error: error.message };
    await logActivity({
      supabase,
      orgId,
      leadId,
      type: "assignee_changed",
      content: assigneeId ?? "(entfernt)",
      meta: { assignee_id: assigneeId },
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────── mark won/lost
export async function markWon(leadId: string): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("leads").update({ stage: "won" }).eq("id", leadId);
    if (error) return { ok: false, error: error.message };
    await logActivity({ supabase, orgId, leadId, type: "marked_won", userId });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markLost(args: {
  leadId: string;
  reason: LossReason;
  detail?: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase
      .from("leads")
      .update({
        stage: "klarheitsgespraech_lost",
        loss_reason: args.reason,
        loss_reason_detail: args.detail?.trim() || null,
      })
      .eq("id", args.leadId);
    if (error) return { ok: false, error: error.message };
    await logActivity({
      supabase,
      orgId,
      leadId: args.leadId,
      type: "marked_lost",
      content: args.reason,
      meta: { reason: args.reason, detail: args.detail ?? null },
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────── duplicate / archive / delete
export async function duplicateLead(leadId: string): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { data: original, error: fetchErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    if (fetchErr || !original) return { ok: false, error: fetchErr?.message ?? "Lead nicht gefunden" };
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      calendly_setter_event_uri: _cs,
      calendly_erstgespraech_event_uri: _ce,
      ...rest
    } = original as Record<string, unknown>;
    void _id; void _c; void _u; void _cs; void _ce;
    const insert = {
      ...rest,
      name: `${original.name ?? "Unbenannt"} (Kopie)`,
      calendly_setter_event_uri: null,
      calendly_erstgespraech_event_uri: null,
    };
    const { data: dup, error: insErr } = await supabase
      .from("leads")
      .insert(insert)
      .select("id")
      .single();
    if (insErr || !dup) return { ok: false, error: insErr?.message ?? "Insert fehlgeschlagen" };
    await logActivity({
      supabase,
      orgId,
      leadId: dup.id,
      type: "lead_duplicated",
      content: `Kopie von ${leadId}`,
      meta: { source_lead_id: leadId },
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function archiveLead(leadId: string, archived = true): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase
      .from("leads")
      .update({ archived })
      .eq("id", leadId);
    if (error) return { ok: false, error: error.message };
    await logActivity({
      supabase,
      orgId,
      leadId,
      type: "lead_archived",
      content: archived ? "archiviert" : "wiederhergestellt",
      meta: { archived },
      userId,
    });
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Soft-Delete: in den Papierkorb verschieben (trashed_at = now()).
// Falls die Spalte trashed_at noch nicht migriert ist, fällt der Code auf
// hartes DELETE zurück — damit das Löschen jederzeit funktioniert.
export async function deleteLead(leadId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase
      .from("leads")
      .update({ trashed_at: new Date().toISOString() })
      .eq("id", leadId);

    if (error) {
      const isMissingCol =
        error.code === "42703" ||
        /column .*trashed_at.* does not exist/i.test(error.message);
      if (isMissingCol) {
        const { error: delErr } = await supabase.from("leads").delete().eq("id", leadId);
        if (delErr) return { ok: false, error: delErr.message };
        bust();
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath("/papierkorb");
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function restoreLead(leadId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase
      .from("leads")
      .update({ trashed_at: null })
      .eq("id", leadId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/papierkorb");
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function purgeLead(leadId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/papierkorb");
    bust();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
