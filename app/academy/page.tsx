import { redirect } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/cockpit/ui";
import { ACADEMY_COURSE, ACADEMY_LESSONS } from "@/lib/academy";
import { AcademyClient, type SignedLesson } from "./academy-client";

export const dynamic = "force-dynamic";

export default async function AcademyPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  // Signierte URLs für alle Videos + Poster in EINEM Batch-Call (4 h gültig).
  // Der Bucket ist privat → ohne Signatur sind die Dateien nicht abrufbar.
  const paths = ACADEMY_LESSONS.flatMap((l) => [l.videoPath, l.posterPath]);
  let signed: Map<string, string> | null = null;
  try {
    const { data, error } = await getSupabaseServiceRole()
      .storage.from("academy")
      .createSignedUrls(paths, 14400);
    if (!error && data) {
      const map = new Map<string, string>();
      for (const d of data) {
        if (!d.error && d.path && d.signedUrl) map.set(d.path, d.signedUrl);
      }
      signed = map;
    }
  } catch {
    signed = null;
  }

  // Fehlerfall (Batch fehlgeschlagen oder ein Video fehlt): Hinweis statt Crash.
  const lessons: SignedLesson[] | null =
    signed && ACADEMY_LESSONS.every((l) => signed.has(l.videoPath))
      ? ACADEMY_LESSONS.map((l) => ({
          ...l,
          signedVideoUrl: signed.get(l.videoPath) as string,
          signedPosterUrl: signed.get(l.posterPath) ?? "",
        }))
      : null;

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        {lessons ? (
          <AcademyClient lessons={lessons} />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">{ACADEMY_COURSE.title}</h1>
              <p className="text-sm text-[color:var(--color-muted)]">{ACADEMY_COURSE.subtitle}</p>
            </div>
            <Card className="p-5 text-sm text-[color:var(--color-muted)]">
              Die Videos konnten gerade nicht geladen werden. Bitte lade die Seite neu oder
              versuche es in ein paar Minuten erneut.
            </Card>
          </>
        )}
      </main>
    </>
  );
}
