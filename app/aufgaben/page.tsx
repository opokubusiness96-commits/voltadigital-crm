import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { isAgencyUser } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import { TASKS } from "@/lib/mock/agency";
import { TasksClient } from "./tasks-client";

export const dynamic = "force-dynamic";

export default async function AufgabenPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");
  // Agentur-Cockpit: nur Volta-Org — Kunden-Accounts direkt zu ihrer Pipeline.
  if (!(await isAgencyUser())) redirect("/board");

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
