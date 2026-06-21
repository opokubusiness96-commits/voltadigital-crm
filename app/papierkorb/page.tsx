import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { STAGE_LABEL, STAGE_BADGE, type Stage } from "@/lib/types";

type TrashedLead = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  trashed_at: string | null;
  updated_at: string;
};
import { cn, timeAgo } from "@/lib/utils";
import { TrashRow } from "./trash-row";

export const dynamic = "force-dynamic";

export default async function PapierkorbPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, first_name, last_name, email, phone, stage, trashed_at, updated_at")
    .not("trashed_at", "is", null)
    .order("trashed_at", { ascending: false });

  const trashed = (leads ?? []) as TrashedLead[];

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="px-4 py-6 max-w-[1400px] mx-auto">
        <div className="mb-6 px-2 flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold">Papierkorb</h1>
            <p className="text-xs text-[color:var(--color-muted)]">
              {trashed.length} gelöschte{trashed.length === 1 ? "r" : ""} Lead
              {trashed.length === 1 ? "" : "s"} · wiederherstellbar oder endgültig löschen
            </p>
          </div>
        </div>

        {error && (
          <div className="mx-2 mb-4 rounded border border-[color:var(--color-red)]/40 bg-[color:var(--color-red)]/10 px-3 py-2 text-xs text-[color:var(--color-red)]">
            Fehler: {error.message}
            {error.message.includes("trashed_at") && (
              <div className="mt-1">
                Tipp: Migration <code>0009_lead_trash.sql</code> in Supabase SQL Editor
                anwenden, dann funktioniert der Papierkorb.
              </div>
            )}
          </div>
        )}

        {trashed.length === 0 && !error ? (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-8 text-center text-sm text-[color:var(--color-muted)] mx-2">
            Papierkorb ist leer.
          </div>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden mx-2">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Stage</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Gelöscht</th>
                  <th className="text-right px-4 py-2.5 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {trashed.map((l) => {
                  const display =
                    [l.first_name, l.last_name].filter(Boolean).join(" ") || l.name || "Unbenannt";
                  const stage = l.stage as Stage;
                  return (
                    <tr key={l.id} className="hover:bg-[color:var(--color-surface-2)]">
                      <td className="px-4 py-2.5 font-medium">{display}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span
                          className={cn(
                            "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            STAGE_BADGE[stage] ?? "",
                          )}
                        >
                          {STAGE_LABEL[stage] ?? stage}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[color:var(--color-muted)] hidden md:table-cell text-xs truncate max-w-[260px]">
                        {l.email ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[color:var(--color-muted)] hidden lg:table-cell text-xs">
                        {l.trashed_at ? timeAgo(l.trashed_at) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <TrashRow leadId={l.id} leadName={display} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
