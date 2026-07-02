import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";

export const AGENCY_ORG_SLUG = "volta";

// Org-Slug des eingeloggten Users (null wenn nicht ermittelbar).
export async function getOrgSlug(): Promise<string | null> {
  // Dev-Fake-Login = Agentur-Sicht (kein echtes Profil vorhanden)
  if (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return AGENCY_ORG_SLUG;
  }
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("org_id, organizations(slug)")
      .eq("id", user.id)
      .maybeSingle();
    const org = data?.organizations as
      | { slug?: string }
      | { slug?: string }[]
      | null
      | undefined;
    const slug = Array.isArray(org) ? org[0]?.slug : org?.slug;
    return slug ?? null;
  } catch {
    return null;
  }
}

// Nur die Agentur-Org (Volta) sieht das Cockpit: Übersicht, Aufgaben,
// Kalender, Rechnungen, Kunden-Dashboards. Kunden-Orgs (Jerome, Nikola, …)
// arbeiten ausschließlich auf ihren echten Daten (Pipeline/Liste/Statistik).
export async function isAgencyUser(): Promise<boolean> {
  return (await getOrgSlug()) === AGENCY_ORG_SLUG;
}
