import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type SupaServerClient = ReturnType<typeof createServerClient>;

export async function getSupabaseServer() {
  // DEV-ONLY: lokalen Login-Flow simulieren. Liefert einen Fake-Client statt einer
  // echten Supabase-Verbindung. "Eingeloggt" hängt am Cookie dev_fake_auth=1 → so
  // startet man ausgeloggt, loggt sich ein (Cookie wird gesetzt) und kann sich
  // wieder ausloggen. Doppelt abgesichert: nur DEV_FAKE_AUTH + nicht Production.
  if (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    const devCookies = await cookies();
    const loggedIn = devCookies.get("dev_fake_auth")?.value === "1";
    return makeFakeServerClient(loggedIn);
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll fails in pure Server Components — ignored, refresh handled by middleware
          }
        },
      },
    },
  );
}

// DEV-ONLY: Fake-Supabase-Server-Client für `DEV_FAKE_AUTH`. Tut so, als wäre ein
// autorisierter User eingeloggt, und gibt für jede Tabellen-Query ein leeres
// Ergebnis zurück. Kein Netzwerk, keine echten Daten — nur zum UI-Durchklicken.
function makeFakeServerClient(loggedIn: boolean): SupaServerClient {
  const fakeUser = {
    id: "00000000-0000-0000-0000-000000000001",
    email:
      (process.env.AUTHORIZED_EMAILS || "").split(",")[0]?.trim() ||
      "dev@local.test",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "1970-01-01T00:00:00.000Z",
  };

  // Chainable Query-Stub: jede Builder-Methode gibt sich selbst zurück, das Objekt
  // ist "thenable" → `await query` liefert { data: [], error: null }.
  const query: Record<string, unknown> = {};
  const passthrough = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "gte", "lt", "lte", "is", "in", "not",
    "or", "and", "filter", "match", "like", "ilike", "contains",
    "order", "limit", "range", "returns", "overrideTypes",
  ];
  for (const m of passthrough) query[m] = () => query;
  query.single = async () => ({ data: null, error: null });
  query.maybeSingle = async () => ({ data: null, error: null });
  query.csv = async () => ({ data: "", error: null });
  query.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });

  const client = {
    auth: {
      getUser: async () => ({ data: { user: loggedIn ? fakeUser : null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => query,
    rpc: () => query,
  };

  return client as unknown as SupaServerClient;
}

// Service-Role Client für Webhooks (Calendly): bypasst RLS, nur in Server-Routen verwenden
export function getSupabaseServiceRole() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
