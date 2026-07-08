import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { getWorkspace } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { BoardClient } from "./board-client";
import type { Lead, Profile, Tag, LeadTagLink } from "@/lib/types";

export default async function BoardPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const activeOrgId = ws.activeOrgId;

  // Personen-Marker: aktive Org + Agentur (David). Kunde nutzt RLS (eigene Org +
  // Agentur-Profile via 0014); die Agentur filtert explizit auf [aktive, Agentur],
  // damit nicht die Personen ALLER Mandanten vermischt werden.
  const profilesSelect = supabase
    .from("profiles")
    .select("id, email, display_name, role, org_id, marker_color, avatar_emoji");
  const profilesQuery = ws.isAgency
    ? profilesSelect.in("org_id", [activeOrgId, ws.homeOrgId])
    : profilesSelect;

  const [{ data: leads }, { data: profiles }, { data: lastActivities }, { data: tags }, { data: leadTags }] = await Promise.all([
    supabase.from("leads").select("*").eq("org_id", activeOrgId).is("trashed_at", null).order("updated_at", { ascending: false }),
    profilesQuery,
    supabase
      .from("activities")
      .select("lead_id, created_at")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("tags").select("id, org_id, category_id, label, description").eq("org_id", activeOrgId).order("label"),
    supabase.from("lead_tags").select("lead_id, tag_id").eq("org_id", activeOrgId),
  ]);

  // Reduce to lastActivityByLead
  const lastActivityByLead: Record<string, string> = {};
  for (const a of lastActivities ?? []) {
    if (!lastActivityByLead[a.lead_id]) {
      lastActivityByLead[a.lead_id] = a.created_at;
    }
  }

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="px-4 py-6 max-w-[1800px] mx-auto">
        <BoardClient
          leads={(leads ?? []) as Lead[]}
          profiles={(profiles ?? []) as Profile[]}
          lastActivityByLead={lastActivityByLead}
          currentUserId={user.id}
          tags={(tags ?? []) as Tag[]}
          leadTags={(leadTags ?? []) as LeadTagLink[]}
        />
      </main>
    </>
  );
}
