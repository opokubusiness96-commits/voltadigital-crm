import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "https://crm.jeromederes.com"),
    { status: 303 },
  );
  // DEV-ONLY: Fake-Session-Cookie entfernen → wieder ausgeloggt
  if (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    res.cookies.delete("dev_fake_auth");
  }
  return res;
}
