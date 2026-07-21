"use client";

// Kurs-Player der Academy: aktives Video links (bzw. oben auf Mobile),
// Lektionsliste daneben. Gesehen-Status lebt nur im localStorage des Browsers.
import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACADEMY_COURSE, type AcademyLesson } from "@/lib/academy";

export type SignedLesson = AcademyLesson & {
  signedVideoUrl: string;
  signedPosterUrl: string; // "" wenn kein Poster signiert werden konnte
};

// localStorage-Key: Array der Slugs aller zu Ende geschauten Lektionen
const WATCHED_KEY = "volta_academy_watched";

function readWatched(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(WATCHED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return []; // defekter Eintrag → wie leer behandeln
  }
}

export function AcademyClient({ lessons }: { lessons: SignedLesson[] }) {
  const [activeSlug, setActiveSlug] = useState(lessons[0]?.slug ?? "");
  // Hydration-safe: SSR/Erst-Render ohne Häkchen, localStorage erst nach Mount lesen
  const [watched, setWatched] = useState<string[]>([]);
  useEffect(() => {
    setWatched(readWatched());
  }, []);

  const markWatched = (slug: string) => {
    setWatched((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      try {
        localStorage.setItem(WATCHED_KEY, JSON.stringify(next));
      } catch {
        // Storage voll/blockiert → Häkchen gilt dann nur für diese Sitzung
      }
      return next;
    });
  };

  const active = lessons.find((l) => l.slug === activeSlug) ?? lessons[0];
  if (!active) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{ACADEMY_COURSE.title}</h1>
        <p className="text-sm text-[color:var(--color-muted)]">{ACADEMY_COURSE.subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Player + Beschreibung des aktiven Videos */}
        <div className="w-full lg:flex-1 min-w-0 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
          <video
            key={active.slug}
            controls
            preload="metadata"
            poster={active.signedPosterUrl || undefined}
            src={active.signedVideoUrl}
            onEnded={() => markWatched(active.slug)}
            className="w-full aspect-video bg-black"
          />
          <div className="p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-[color:var(--color-accent)]">
                {String(active.num).padStart(2, "0")}
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{active.title}</h2>
              <span className="ml-auto text-xs text-[color:var(--color-muted)] shrink-0">
                {active.duration}
              </span>
            </div>
            <p className="text-sm text-[color:var(--color-muted)] mt-1.5">{active.description}</p>
          </div>
        </div>

        {/* Lektionsliste */}
        <div className="w-full lg:w-80 shrink-0 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[color:var(--color-border)] text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
            Lektionen
          </div>
          <ul>
            {lessons.map((l) => {
              const isActive = l.slug === active.slug;
              const isWatched = watched.includes(l.slug);
              return (
                <li key={l.slug} className="border-b border-[color:var(--color-border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setActiveSlug(l.slug)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition",
                      isActive
                        ? "bg-[color:var(--color-surface-2)]"
                        : "hover:bg-[color:var(--color-surface-2)]/60",
                    )}
                  >
                    <span
                      className={cn(
                        "w-7 h-7 shrink-0 grid place-items-center rounded-full border text-xs font-semibold",
                        isActive
                          ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                          : "border-[color:var(--color-border)] text-[color:var(--color-muted)]",
                      )}
                    >
                      {l.num}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium truncate",
                          isActive ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-text)]",
                        )}
                      >
                        {l.title}
                      </span>
                      <span className="block text-xs text-[color:var(--color-muted)]">{l.duration}</span>
                    </span>
                    {isWatched && (
                      <Check className="w-4 h-4 shrink-0 text-[color:var(--color-accent)]" aria-label="Gesehen" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Weitere Kurse (noch nicht verfügbar) */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight mb-3">Weitere Kurse</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Meta Ads",
              description: "Kampagnen, Zielgruppen und Auswertung — Schritt für Schritt.",
            },
            {
              title: "Funnel & Landingpages",
              description: "Vom Klick zum Kunden: Seiten, die aus Besuchern Leads machen.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 opacity-60"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[color:var(--color-muted)]" />
                <h3 className="text-base font-semibold">{c.title}</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wide rounded-full border border-[color:var(--color-border)] text-[color:var(--color-muted)] px-2 py-0.5 shrink-0">
                  Bald verfügbar
                </span>
              </div>
              <p className="text-sm text-[color:var(--color-muted)] mt-1.5">{c.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
