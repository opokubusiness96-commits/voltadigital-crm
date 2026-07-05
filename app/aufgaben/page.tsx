import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AGENCY_ORG_SLUG, getOrgInfo } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { TASKS } from "@/lib/mock/agency";
import { TasksClient } from "./tasks-client";
import { TeamTasksClient } from "./team-tasks-client";
import { todayBerlin, type TeamMember, type TeamTask } from "@/lib/team/types";

export const dynamic = "force-dynamic";

export default async function AufgabenPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  const orgInfo = await getOrgInfo();
  if (!orgInfo) redirect("/board");

  // Kunden-Orgs: echte Team-Aufgaben aus Supabase (RLS-gescoped auf die Org).
  if (orgInfo.slug !== AGENCY_ORG_SLUG) {
    const [{ data: tasks }, { data: members }] = await Promise.all([
      supabase
        .from("team_tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name, avatar_emoji").order("display_name"),
    ]);
    return (
      <>
        <AppHeader email={user.email ?? ""} />
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Aufgaben</h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              Sales, Marketing & Planung — fürs ganze Team, nach Fälligkeit sortiert.
            </p>
          </div>
          <TeamTasksClient
            initial={(tasks ?? []) as TeamTask[]}
            members={(members ?? []) as TeamMember[]}
            today={todayBerlin()}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Aufgaben</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Nach Priorität und Fälligkeit — über alle Kunden.
          </p>
        </div>
        <TasksClient initial={TASKS} />
      </main>
    </>
  );
}
