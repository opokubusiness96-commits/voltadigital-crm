import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";

export const AGENCY_ORG_SLUG = "volta";

export type OrgInfo = { slug: string; name: string; displayName: string | null };

// Org (Slug + Anzeigename) + display_name des eingeloggten Users (null wenn nicht ermittelbar).
export async function getOrgInfo(): Promise<OrgInfo | null> {
  // Dev-Fake-Login = Agentur-Sicht (kein echtes Profil vorhanden)
  if (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return { slug: AGENCY_ORG_SLUG, name: "Volta Digital", displayName: null };
  }
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("org_id, display_name, organizations(slug, name)")
      .eq("id", user.id)
      .maybeSingle();
    const org = data?.organizations as
      | { slug?: string; name?: string }
      | { slug?: string; name?: string }[]
      | null
      | undefined;
    const one = Array.isArray(org) ? org[0] : org;
    if (!one?.slug) return null;
    return {
      slug: one.slug,
      name: one.name ?? one.slug,
      displayName: (data?.display_name as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// Vorname aus dem display_name ("Ahmad (Coach)" → "Ahmad", "Nikola Uljarevic" → "Nikola").
export function firstNameOf(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first || null;
}

// Org-Slug des eingeloggten Users (null wenn nicht ermittelbar).
export async function getOrgSlug(): Promise<string | null> {
  return (await getOrgInfo())?.slug ?? null;
}

// Nur die Agentur-Org (Volta) sieht das Cockpit: Übersicht, Aufgaben,
// Kalender, Rechnungen, Kunden-Dashboards. Kunden-Orgs (Jerome, Nikola, …)
// arbeiten ausschließlich auf ihren echten Daten (Pipeline/Liste/Statistik).
export async function isAgencyUser(): Promise<boolean> {
  return (await getOrgSlug()) === AGENCY_ORG_SLUG;
}
