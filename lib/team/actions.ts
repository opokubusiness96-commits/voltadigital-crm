"use server";

// Server Actions für den Team-Workspace (Aufgaben/Termine/Notizen).
// Muster wie lib/crm/leadActions.ts: getCtx() → org_id explizit ins Insert,
// Result-Objekte statt throws, revalidatePath nach jedem Write.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CATEGORIES, type TaskPriority, type TeamCategory } from "@/lib/team/types";

type ActionResult = { ok: true } | { ok: false; error: string };

const PRIORITIES: TaskPriority[] = ["hoch", "mittel", "niedrig"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function getCtx() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error("Kein Profil");
  return { supabase, userId: user.id, orgId: profile.org_id as string };
}

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function normCategory(v: string | undefined): TeamCategory {
  return CATEGORIES.includes(v as TeamCategory) ? (v as TeamCategory) : "sonstiges";
}

// ── Aufgaben ────────────────────────────────────────────────────────────────

export async function createTask(input: {
  title: string;
  due_date?: string | null;
  priority?: string;
  category?: string;
  assigned_to?: string | null;
}): Promise<ActionResult> {
  try {
    const title = input.title?.trim();
    if (!title) return { ok: false, error: "Titel fehlt" };
    const { supabase, userId, orgId } = await getCtx();

    let assignedTo: string | null = null;
    if (input.assigned_to) {
      // RLS-gescoped: findet nur Profile der eigenen Org → validiert Zugehörigkeit
      const { data: member } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", input.assigned_to)
        .maybeSingle();
      assignedTo = member?.id ?? null;
    }

    const { error } = await supabase.from("team_tasks").insert({
      org_id: orgId,
      title: title.slice(0, 300),
      due_date: input.due_date && ISO_DAY.test(input.due_date) ? input.due_date : null,
      priority: PRIORITIES.includes(input.priority as TaskPriority) ? input.priority : "mittel",
      category: normCategory(input.category),
      assigned_to: assignedTo,
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/aufgaben");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("team_tasks").update({ done }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/aufgaben");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("team_tasks").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/aufgaben");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Termine ─────────────────────────────────────────────────────────────────

export async function createEvent(input: {
  title: string;
  date: string;
  time?: string | null;
  category?: string;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const title = input.title?.trim();
    if (!title) return { ok: false, error: "Titel fehlt" };
    if (!input.date || !ISO_DAY.test(input.date)) return { ok: false, error: "Datum fehlt" };
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("team_events").insert({
      org_id: orgId,
      title: title.slice(0, 300),
      date: input.date,
      time: input.time && HHMM.test(input.time) ? input.time : null,
      category: normCategory(input.category),
      notes: input.notes?.trim().slice(0, 1000) || null,
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/kalender");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("team_events").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/kalender");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Notizen ─────────────────────────────────────────────────────────────────

export async function createNote(body: string): Promise<ActionResult> {
  try {
    const text = body?.trim();
    if (!text) return { ok: false, error: "Notiz ist leer" };
    const { supabase, userId, orgId } = await getCtx();
    const { error } = await supabase.from("team_notes").insert({
      org_id: orgId,
      body: text.slice(0, 2000),
      created_by: userId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleNotePin(id: string, pinned: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("team_notes").update({ pinned }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("team_notes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
