import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Öffentliche Pfade ohne Auth. Das Dashboard ist jetzt hinter dem Login (eigener
// getUser-Check), daher NICHT mehr hier. Passwort-Flow + Registrierung MÜSSEN
// öffentlich sein — sonst wird der ausgeloggte User (bzw. der Reset-Link aus der
// E-Mail) aufs Login zurückgeworfen und der Reset-Token geht verloren.
// /checkout ist die Verkaufsseite für Kunden (inkl. /checkout/danke) — die darf
// per Definition niemanden zum Login schicken.
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/checkout",
  "/angebote",
];

/**
 * Jede Verkaufsdomain zeigt GENAU ein Angebot — das war die Vorgabe, nachdem
 * die Übersicht kurzzeitig auf der 1000er-Domain lag: wer den 1000er-Link
 * bekommt, soll den 1000er sehen und nichts anderes.
 *
 * `home` ist die Seite unter "/". `allow` sind die Pfade, die auf diesem Host
 * überhaupt aufgehen; alles andere landet wieder auf "/", damit über eine
 * Verkaufsdomain nichts vom CRM erreichbar ist.
 *
 * /checkout/danke steht überall in `allow` — dorthin schickt Stripe nach der
 * Zahlung zurück, egal von welcher Domain der Kauf startete. Ohne diese
 * Ausnahme sähe der Käufer nach erfolgreicher Zahlung die Startseite statt
 * seiner Bestellnummer.
 */
const DANKE = "/checkout/danke";

const CUSTOMER_HOSTS: Record<string, { home: string; allow: string[] }> = {
  // Nur das 5er-Paket. Dieser Link ist im Umlauf.
  "checkout1000.jeromederes.com": { home: "/checkout", allow: ["/checkout"] },
  "checkout1000.voltadigital.agency": { home: "/checkout", allow: ["/checkout"] },
  // Angebotsübersicht: Einzelstunde, 5er-Paket, 12 Wochen. Die Domain zeigte
  // früher auf die 3.000er-Stufe, die mit der Preisumstellung entfallen ist.
  "checkout2.jeromederes.com": { home: "/angebote", allow: ["/angebote", DANKE] },
  "angebote.jeromederes.com": { home: "/angebote", allow: ["/angebote", DANKE] },
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const customer = CUSTOMER_HOSTS[host];
  if (customer) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = customer.home;
      return NextResponse.rewrite(url);
    }
    // /checkout/danke ist immer erlaubt — dorthin schickt Stripe nach der
    // Zahlung zurück, egal von welcher Verkaufsdomain der Kauf startete.
    if (
      customer.allow.some((p) => pathname.startsWith(p)) ||
      pathname.startsWith("/_next/")
    ) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // DEV-ONLY: lokalen Login-Flow simulieren ohne echtes Backend.
  // "Eingeloggt" = Cookie dev_fake_auth=1 (gesetzt von der Login-Seite).
  // Die geschützten Seiten prüfen den User selbst (über den Fake-Client) und
  // leiten ausgeloggt auf /login. Hier nur die Umkehrung: eingeloggt + auf /login
  // → weiter zum Dashboard. Doppelt abgesichert: nur DEV_FAKE_AUTH + NICHT Production.
  if (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    const loggedIn = request.cookies.get("dev_fake_auth")?.value === "1";
    if (loggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Webhooks, Auth-Endpoints, Cron-Jobs und statische Assets: kein Session-Check.
  // /api/cron MUSS hier durch, sonst fängt der Auth-Proxy die Vercel-Cron-Aufrufe
  // ab (Cron sendet keinen Session-Cookie → Redirect auf /login → Job läuft nie).
  // Die Cron-Routes prüfen selbst "Authorization: Bearer $CRON_SECRET".
  if (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // /assets (Download-PDFs) am Auth-Proxy vorbei direkt statisch ausliefern.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
