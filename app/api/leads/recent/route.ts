import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { isEmailAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liefert die neuesten Leads der aktiven Org für die Benachrichtigungs-Glocke im
// Header. RLS-scoped über den User-Client; die Glocke pollt das im Client und
// vergleicht created_at mit dem lokal gespeicherten "zuletzt gesehen"-Zeitpunkt.
export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isEmailAuthorized(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ leads: [], serverTime: new Date().toISOString() });

  const { data, error } = await supabase
    .from("leads")
    .select("id, name, first_name, last_name, source, stage, created_at")
    .eq("org_id", orgId)
    .is("trashed_at", null)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    leads: data ?? [],
    serverTime: new Date().toISOString(),
  });
}
