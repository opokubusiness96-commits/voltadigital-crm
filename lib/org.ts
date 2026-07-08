import "server-only";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";

export const AGENCY_ORG_SLUG = "volta";
// Cookie, in dem die Agentur ihre aktuell gewählte Kunden-Org merkt.
export const ACTIVE_ORG_COOKIE = "active_org";

export type OrgInfo = { id: string; slug: string; name: string };

export type HomeOrg = {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
};

function isDevFake(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

// Home-Org (feste Zugehörigkeit) des eingeloggten Users + sein display_name.
export async function getOrgInfo(): Promise<HomeOrg | null> {
  if (isDevFake()) {
    return { id: "dev-volta", slug: AGENCY_ORG_SLUG, name: "Volta Digital", displayName: null };
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
    if (!data?.org_id) return null;
    const org = data.organizations as
      | { slug?: string; name?: string }
      | { slug?: string; name?: string }[]
      | null
      | undefined;
    const one = Array.isArray(org) ? org[0] : org;
    if (!one?.slug) return null;
    return {
      id: data.org_id as string,
      slug: one.slug,
      name: one.name ?? one.slug,
      displayName: (data.display_name as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getOrgSlug(): Promise<string | null> {
  return (await getOrgInfo())?.slug ?? null;
}

// Nur die Agentur-Org (Volta) hat Cockpit + Cross-Org-Zugriff.
export async function isAgencyUser(): Promise<boolean> {
  return (await getOrgInfo())?.slug === AGENCY_ORG_SLUG;
}

// Alle für den User sichtbaren Orgs (RLS: Agentur = alle, Kunde = nur die eigene).
export async function getAllOrgs(): Promise<OrgInfo[]> {
  if (isDevFake()) return [{ id: "dev-volta", slug: AGENCY_ORG_SLUG, name: "Volta Digital" }];
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("organizations")
      .select("id, slug, name")
      .order("name");
    return (data ?? []) as OrgInfo[];
  } catch {
    return [];
  }
}

// Vorname aus dem display_name ("Ahmad (Coach)" → "Ahmad").
export function firstNameOf(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first || null;
}

export type Workspace = {
  isAgency: boolean;
  displayName: string | null;
  homeOrgId: string;
  // Org, in der aktuell gearbeitet wird (Kunde = eigene; Agentur = gewählte).
  activeOrgId: string;
  activeOrgSlug: string;
  activeOrgName: string;
  allOrgs: OrgInfo[]; // für den Agentur-Umschalter (Kunde: nur die eigene)
};

// Zentrale Arbeits-Sicht: für Board/Liste/Statistik + Schreib-Actions.
// Kunde: immer die eigene Org. Agentur: die per Cookie gewählte Org
// (Default = erste Kunden-Org, damit David direkt eine echte Pipeline sieht).
export async function getWorkspace(): Promise<Workspace | null> {
  const home = await getOrgInfo();
  if (!home) return null;
  const isAgency = home.slug === AGENCY_ORG_SLUG;

  if (!isAgency) {
    return {
      isAgency: false,
      displayName: home.displayName,
      homeOrgId: home.id,
      activeOrgId: home.id,
      activeOrgSlug: home.slug,
      activeOrgName: home.name,
      allOrgs: [{ id: home.id, slug: home.slug, name: home.name }],
    };
  }

  const all = await getAllOrgs();
  let active: OrgInfo | undefined;
  try {
    const sel = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
    if (sel) active = all.find((o) => o.id === sel);
  } catch {
    /* cookies() kann in manchen Kontexten fehlen */
  }
  // Default: erste Kunden-Org (nicht die Agentur selbst).
  if (!active) active = all.find((o) => o.slug !== AGENCY_ORG_SLUG) ?? all[0];

  return {
    isAgency: true,
    displayName: home.displayName,
    homeOrgId: home.id,
    activeOrgId: active?.id ?? home.id,
    activeOrgSlug: active?.slug ?? home.slug,
    activeOrgName: active?.name ?? home.name,
    allOrgs: all,
  };
}

// Org-ID für Schreib-Operationen (Lead/Aufgabe/Termin anlegen).
export async function getActiveOrgId(): Promise<string | null> {
  return (await getWorkspace())?.activeOrgId ?? null;
}
