import { notFound, redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { StageBadge } from "@/components/StageBadge";
import { LeadEditor } from "./lead-editor";
import { NoteForm } from "./note-form";
import { AssignmentManager } from "./assignment-manager";
import { formatDate, timeAgo } from "@/lib/utils";
import { type Activity, type Lead, type Profile } from "@/lib/types";

type ActivityMeta = { icon: string; label: string; color: string };
// Schlicht: Gold für positive Ereignisse, Grautöne sonst (kein Bunt).
const ACTIVITY_META_DEFAULT: ActivityMeta = { icon: "•", label: "Update", color: "#8E8E92" };
const ACTIVITY_META: Record<Activity["type"], ActivityMeta> = {
  booking:           { icon: "📅", label: "Termin gebucht",   color: "#D4AF37" },
  booking_canceled:  { icon: "✕",  label: "Termin abgesagt",  color: "#8E8E92" },
  stage_change:      { icon: "→",  label: "Stage gewechselt", color: "#E5C76B" },
  note:              { icon: "✎",  label: "Notiz",            color: "#8E8E92" },
  call_done:         { icon: "☎",  label: "Anruf erledigt",   color: "#D4AF37" },
  lead_created:      { icon: "✨", label: "Lead angelegt",    color: "#D4AF37" },
  lead_updated:      { icon: "✎",  label: "Lead bearbeitet",  color: "#8E8E92" },
};

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  const [{ data: lead }, { data: activities }, { data: profiles }, { data: assignments }] =
    await Promise.all([
      supabase.from("leads").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("activities")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, display_name, role, org_id, marker_color, avatar_emoji"),
      supabase.from("lead_assignments").select("user_id, assigned_at").eq("lead_id", id),
    ]);

  if (!lead) return notFound();

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">{lead.name || "Unbenannter Lead"}</h1>
            <div className="text-sm text-[color:var(--color-muted)] mt-1 flex flex-wrap gap-x-4">
              {lead.email && <span>{lead.email}</span>}
              {lead.phone && <span>{lead.phone}</span>}
              <span>Erstellt {formatDate(lead.created_at)}</span>
            </div>
          </div>
          <StageBadge stage={lead.stage} />
        </div>

        <AssignmentManager
          leadId={lead.id}
          assignedUsers={(assignments ?? [])
            .map((a) => profileById.get(a.user_id))
            .filter((p): p is Profile => !!p)}
          allProfiles={(profiles ?? []).filter((p) => !!p.marker_color) as Profile[]}
        />

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 mt-6">
          <LeadEditor
            lead={lead as Lead}
            profiles={(profiles ?? []) as Profile[]}
          />

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
              Activity-Log
            </h2>

            <NoteForm leadId={lead.id} />

            <ul className="relative space-y-3 pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-[color:var(--color-border)]">
              {(activities ?? []).map((a: Activity) => {
                const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META_DEFAULT;
                const actor = a.created_by ? profileById.get(a.created_by) : null;
                return (
                  <li key={a.id} className="relative">
                    <span
                      className="absolute -left-[1.05rem] top-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] border-2 border-[color:var(--color-bg)]"
                      style={{ background: meta.color, color: "#fff" }}
                      title={meta.label}
                    >
                      {meta.icon}
                    </span>
                    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-medium" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="text-[color:var(--color-muted)]">{timeAgo(a.created_at)}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{a.content || "—"}</div>
                      {actor && (
                        <div className="text-xs text-[color:var(--color-muted)] mt-2 flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px]"
                            style={{ background: actor.marker_color ?? "#666" }}
                          >
                            {actor.avatar_emoji ? (
                              <span className="leading-none">{actor.avatar_emoji}</span>
                            ) : null}
                          </span>
                          {actor.display_name || actor.email}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              {!activities?.length && (
                <li className="text-sm text-[color:var(--color-muted)]">
                  Noch keine Aktivität.
                </li>
              )}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
