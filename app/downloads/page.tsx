import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/cockpit/ui";
import { DOWNLOADS } from "@/lib/downloads";

export const dynamic = "force-dynamic";

export default async function DownloadsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Downloads</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Ressourcen & Vorlagen von Volta Digital — jederzeit herunterladbar.
          </p>
        </div>

        <div className="space-y-3">
          {DOWNLOADS.map((d) => (
            <Card key={d.file} className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 shrink-0 rounded-lg bg-[color:var(--color-surface-2)] grid place-items-center">
                <FileText className="w-5 h-5 text-[color:var(--color-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold truncate">{d.title}</h2>
                  <span className="text-[10px] uppercase tracking-wide rounded-full border border-[color:var(--color-accent)]/35 text-[color:var(--color-accent)] px-2 py-0.5 shrink-0">
                    {d.kind}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--color-muted)] mt-0.5">{d.description}</p>
              </div>
              <a
                href={d.file}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-4 py-2 text-sm hover:opacity-90 transition"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            </Card>
          ))}
          {DOWNLOADS.length === 0 && (
            <Card className="p-5 text-sm text-[color:var(--color-muted)]">
              Aktuell keine Downloads verfügbar.
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
