import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { StageBadge } from "@/components/StageBadge";
import { STAGES, STAGE_LABEL, SOURCES, SOURCE_LABEL, type Stage, type Source, type Lead } from "@/lib/types";
import { formatDate, formatEUR, timeAgo } from "@/lib/utils";

type SearchParams = {
  stage?: string;
  source?: string;
  q?: string;
  sort?: string;
  dir?: string;
};

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Nicht autorisiert</h1>
          <p className="text-sm text-[color:var(--color-muted)] mb-4">
            Diese Email ist nicht in der Zugriffsliste.
          </p>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm underline">Abmelden</button>
          </form>
        </div>
      </main>
    );
  }

  // Profile-Liste für Owner-Filter
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name");

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name || p.email]),
  );

  // Query bauen
  const sortKey = params.sort || "created_at";
  const sortDir = params.dir === "asc" ? "asc" : "desc";

  let query = supabase
    .from("leads")
    .select("*")
    .is("trashed_at", null)
    .order(sortKey, { ascending: sortDir === "asc" });

  if (params.stage && STAGES.includes(params.stage as Stage)) {
    query = query.eq("stage", params.stage);
  }
  if (params.source && SOURCES.includes(params.source as Source)) {
    query = query.eq("source", params.source);
  }
  if (params.q) {
    const term = params.q.replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data: leads, error } = await query;

  return (
    <>
      <AppHeader email={user.email ?? ""} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Leads</h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              {leads?.length ?? 0} Einträge
            </p>
          </div>
        </div>

        <form
          method="get"
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] mb-4"
        >
          <input
            name="q"
            placeholder="Suche nach Name oder Email"
            defaultValue={params.q ?? ""}
            className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
          <select
            name="stage"
            defaultValue={params.stage ?? ""}
            className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2 text-sm"
          >
            <option value="">Alle Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={params.source ?? ""}
            className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2 text-sm"
          >
            <option value="">Alle Quellen</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-medium rounded-md px-4 text-sm">
            Filtern
          </button>
        </form>

        {error && (
          <p className="text-sm text-[color:var(--color-red)] mb-4">
            DB-Fehler: {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] bg-[color:var(--color-surface-2)]">
              <tr>
                <SortHeader label="Name" k="name" current={sortKey} dir={sortDir} params={params} />
                <SortHeader label="Email" k="email" current={sortKey} dir={sortDir} params={params} />
                <SortHeader label="Stage" k="stage" current={sortKey} dir={sortDir} params={params} />
                <SortHeader label="Owner" k="owner_id" current={sortKey} dir={sortDir} params={params} />
                <SortHeader label="Value" k="value_estimate" current={sortKey} dir={sortDir} params={params} />
                <SortHeader label="Erstellt" k="created_at" current={sortKey} dir={sortDir} params={params} />
                <SortHeader label="Aktivität" k="updated_at" current={sortKey} dir={sortDir} params={params} />
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((l: Lead) => (
                <tr
                  key={l.id}
                  className="border-t border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-2)]"
                >
                  <td className="px-4 py-2.5">
                    <Link href={`/leads/${l.id}`} className="hover:underline">
                      {l.name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[color:var(--color-muted)]">{l.email || "—"}</td>
                  <td className="px-4 py-2.5"><StageBadge stage={l.stage} /></td>
                  <td className="px-4 py-2.5 text-[color:var(--color-muted)]">
                    {l.owner_id ? profileById.get(l.owner_id) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-2.5">{formatEUR(l.value_estimate)}</td>
                  <td className="px-4 py-2.5 text-[color:var(--color-muted)]">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-2.5 text-[color:var(--color-muted)]">{timeAgo(l.updated_at)}</td>
                </tr>
              ))}
              {!leads?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[color:var(--color-muted)]">
                    Noch keine Leads. Calendly-Webhook prüfen oder{" "}
                    <Link href="/leads/new" className="underline">manuell anlegen</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function SortHeader({
  label,
  k,
  current,
  dir,
  params,
}: {
  label: string;
  k: string;
  current: string;
  dir: "asc" | "desc";
  params: SearchParams;
}) {
  const next = current === k && dir === "desc" ? "asc" : "desc";
  const usp = new URLSearchParams();
  if (params.stage) usp.set("stage", params.stage);
  if (params.source) usp.set("source", params.source);
  if (params.q) usp.set("q", params.q);
  usp.set("sort", k);
  usp.set("dir", next);
  const isActive = current === k;
  return (
    <th className="text-left px-4 py-2.5 font-medium">
      <Link
        href={`/?${usp.toString()}`}
        className={isActive ? "text-[color:var(--color-text)]" : ""}
      >
        {label}
        {isActive && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
}
