"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE, isAgencyUser } from "@/lib/org";

// Agentur wechselt die aktive Kunden-Org. Nur Agentur-User dürfen das;
// die Org muss existieren (RLS lässt die Agentur alle Orgs sehen).
export async function setActiveOrg(orgId: string, redirectTo: string = "/board") {
  if (!(await isAgencyUser())) return;

  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (!data) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(redirectTo);
}
