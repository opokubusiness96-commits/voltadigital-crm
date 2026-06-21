import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ausgeloggt → Login, eingeloggt → Dashboard (von dort in die Pipeline).
  if (!user) redirect("/login");
  redirect("/dashboard");
}
