import { NextResponse } from "next/server";
import { isEmailAuthorized } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: isEmailAuthorized(body.email) });
}
