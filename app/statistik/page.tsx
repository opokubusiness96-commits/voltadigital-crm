import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { getWorkspace } from "@/lib/org";
import { AppHeader } from "@/components/AppHeader";
import {
  STAGES,
  STAGE_LABEL,
  STAGE_BADGE,
  type Lead,
  type Stage,
} from "@/lib/types";
import { cn, formatEUR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StatistikPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  const ws = await getWorkspace();
  if (!ws) redirect("/login");

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, first_name, last_name, email, stage, value_estimate, updated_at")
    .eq("org_id", ws.activeOrgId)
    .is("trashed_at", null)
    .order("updated_at", { ascending: false });

  const all = (leads ?? []) as Lead[];
  const total = all.length;
  const totalValue = all.reduce((sum, l) => sum + Number(l.value_estimate ?? 0), 0);

  const byStage = new Map<Stage, Lead[]>();
  for (const s of STAGES) byStage.set(s, []);
  for (const l of all) {
    if (byStage.has(l.stage as Stage)) {
      byStage.get(l.stage as Stage)!.push(l);
    }
  }

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="px-4 py-6 max-w-[1400px] mx-auto">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-semibold">Statistik</h1>
          <p className="text-xs text-[color:var(--color-muted)]">
            {total} Leads gesamt
            {totalValue > 0 && ` · Pipeline-Wert ${formatEUR(totalValue)}`}
          </p>
        </div>

        {/* Top-Bar: Counts pro Stage */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 px-2">
          {STAGES.map((s) => {
            const count = byStage.get(s)?.length ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div
                key={s}
                className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 flex flex-col gap-1"
              >
                <span
                  className={cn(
                    "inline-flex items-center self-start rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full",
                    STAGE_BADGE[s],
                  )}
                  title={STAGE_LABEL[s]}
                >
                  {STAGE_LABEL[s]}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold tabular-nums">{count}</span>
                  <span className="text-[10px] text-[color:var(--color-muted)]">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pro Stage: Liste der Leads */}
        <div className="space-y-6 px-2">
          {STAGES.map((s) => {
            const stageLeads = byStage.get(s) ?? [];
            const stageValue = stageLeads.reduce(
              (sum, l) => sum + Number(l.value_estimate ?? 0),
              0,
            );
            return (
              <section
                key={s}
                className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden"
              >
                <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                        STAGE_BADGE[s],
                      )}
                    >
                      {STAGE_LABEL[s]}
                    </span>
                    <span className="text-xs text-[color:var(--color-muted)]">
                      {stageLeads.length} Lead{stageLeads.length === 1 ? "" : "s"}
                      {stageValue > 0 && ` · ${formatEUR(stageValue)}`}
                    </span>
                  </div>
                </header>
                {stageLeads.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-[color:var(--color-muted)]">
                    Keine Leads in dieser Stage.
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--color-border)]">
                    {stageLeads.map((l) => {
                      const display =
                        [l.first_name, l.last_name].filter(Boolean).join(" ") ||
                        l.name ||
                        "Unbenannt";
                      return (
                        <li key={l.id} className="px-4 py-2 flex items-center gap-3 hover:bg-[color:var(--color-surface-2)]">
                          <Link
                            href={`/leads/${l.id}`}
                            className="flex-1 min-w-0 text-sm font-medium hover:underline truncate"
                          >
                            {display}
                          </Link>
                          {l.email && (
                            <span className="hidden sm:inline text-xs text-[color:var(--color-muted)] truncate max-w-[220px]">
                              {l.email}
                            </span>
                          )}
                          {l.value_estimate != null && (
                            <span className="text-xs text-[color:var(--color-muted)] tabular-nums shrink-0">
                              {formatEUR(l.value_estimate)}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
