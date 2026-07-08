import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Öffentliche Pfade ohne Auth. Das Dashboard ist jetzt hinter dem Login (eigener
// getUser-Check), daher NICHT mehr hier. Passwort-Flow + Registrierung MÜSSEN
// öffentlich sein — sonst wird der ausgeloggte User (bzw. der Reset-Link aus der
// E-Mail) aufs Login zurückgeworfen und der Reset-Token geht verloren.
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/register",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Webhooks, Auth-Endpoints und statische Assets: kein Auth-Check
  if (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/auth/") ||
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
