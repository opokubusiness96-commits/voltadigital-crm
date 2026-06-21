import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityKind =
  | "note_added"
  | "tag_added"
  | "tag_removed"
  | "stage_change"
  | "followup_scheduled"
  | "task_created"
  | "assignee_changed"
  | "marked_won"
  | "marked_lost"
  | "lead_duplicated"
  | "lead_archived"
  | "lead_deleted"
  | "call_logged"
  | "lead_updated";

type LogArgs = {
  supabase: SupabaseClient;
  orgId: string;
  leadId: string;
  type: ActivityKind;
  content?: string | null;
  meta?: Record<string, unknown> | null;
  userId?: string | null;
};

export async function logActivity({
  supabase,
  orgId,
  leadId,
  type,
  content = null,
  meta = null,
  userId = null,
}: LogArgs) {
  const { error } = await supabase.from("activities").insert({
    org_id: orgId,
    lead_id: leadId,
    type,
    content,
    meta,
    created_by: userId,
  });
  if (error) {
    console.error("[activityLog]", type, error.message);
  }
}
