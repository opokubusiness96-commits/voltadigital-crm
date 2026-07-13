import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { getWorkspace } from "@/lib/org";
import { isBrevoEnabledOrg } from "@/lib/brevo";
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

  // Der manuelle "Nummer prüfen"-Button (+ Marker) ist nur für Brevo-freigeschaltete
  // Orgs (Jerome) aktiv — kein anderer Mandant kann Mails auslösen.
  const brevoEnabled = isBrevoEnabledOrg(activeOrgId);

  const [{ data: leads }, { data: profiles }, { data: lastActivities }, { data: tags }, { data: leadTags }, numberChecks] = await Promise.all([
    supabase.from("leads").select("*").eq("org_id", activeOrgId).is("trashed_at", null).order("created_at", { ascending: false }),
    profilesQuery,
    supabase
      .from("activities")
      .select("lead_id, created_at")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("tags").select("id, org_id, category_id, label, description").eq("org_id", activeOrgId).order("label"),
    supabase.from("lead_tags").select("lead_id, tag_id").eq("org_id", activeOrgId),
    brevoEnabled
      ? supabase
          .from("email_log")
          .select("lead_id, sent_at")
          .eq("org_id", activeOrgId)
          .eq("template", "wrong_number_check")
          .eq("status", "sent")
          .order("sent_at", { ascending: false })
      : Promise.resolve({ data: [] as { lead_id: string; sent_at: string }[] }),
  ]);

  // Reduce to lastActivityByLead
  const lastActivityByLead: Record<string, string> = {};
  for (const a of lastActivities ?? []) {
    if (!lastActivityByLead[a.lead_id]) {
      lastActivityByLead[a.lead_id] = a.created_at;
    }
  }

  // Neuester "Nummer angefragt am"-Zeitpunkt je Lead (für den Karten-Marker).
  const numberCheckByLead: Record<string, string> = {};
  for (const r of (numberChecks?.data ?? []) as { lead_id: string; sent_at: string }[]) {
    if (!numberCheckByLead[r.lead_id]) numberCheckByLead[r.lead_id] = r.sent_at;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppHeader email={user.email ?? ""} />
      <main className="flex-1 min-h-0 flex flex-col px-4 py-6 w-full max-w-[1800px] mx-auto">
        <BoardClient
          leads={(leads ?? []) as Lead[]}
          profiles={(profiles ?? []) as Profile[]}
          lastActivityByLead={lastActivityByLead}
          numberCheckByLead={numberCheckByLead}
          brevoEnabled={brevoEnabled}
          currentUserId={user.id}
          tags={(tags ?? []) as Tag[]}
          leadTags={(leadTags ?? []) as LeadTagLink[]}
          orgName={ws.activeOrgName}
        />
      </main>
    </div>
  );
}
