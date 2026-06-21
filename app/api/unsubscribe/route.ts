import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead");
  if (!leadId) {
    return new NextResponse("Lead ID fehlt.", { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("leads")
    .update({ email_opt_out: true })
    .eq("id", leadId);

  if (error) {
    console.error("unsubscribe failed", error);
    return new NextResponse("Fehler beim Abmelden. Bitte später erneut versuchen.", { status: 500 });
  }

  // Audit
  const { data: lead } = await supabase
    .from("leads")
    .select("org_id")
    .eq("id", leadId)
    .maybeSingle();
  if (lead) {
    await supabase.from("activities").insert({
      org_id: lead.org_id,
      lead_id: leadId,
      type: "lead_updated",
      content: "Email-Opt-Out via Unsubscribe-Link",
    });
  }

  return new NextResponse(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Abgemeldet</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0a0c10;color:#e6e8ee;display:grid;place-items:center;min-height:100vh;margin:0;padding:2rem}main{max-width:32rem;text-align:center}h1{font-weight:600;margin-bottom:.5rem}p{color:#8b94a7;line-height:1.6}</style></head><body><main><h1>Du bist abgemeldet.</h1><p>Du erhältst keine weiteren Marketing-Emails mehr von uns. Eingebuchte Termine werden weiterhin per Email bestätigt — das ist gesetzlich erlaubt und im Sinne deiner Buchung.</p></main></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
