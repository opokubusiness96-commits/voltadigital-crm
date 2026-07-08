import Link from "next/link";
import { Trash2 } from "lucide-react";
import { getWorkspace } from "@/lib/org";
import { OrgSwitcher } from "@/components/OrgSwitcher";

export async function AppHeader({ email }: { email: string }) {
  // Rechnungen bleibt Agentur-only; Dashboard/Aufgaben/Kalender gibt es für
  // alle Orgs (Agentur = Mock-Cockpit, Kunden-Orgs = echte Team-Daten).
  const ws = await getWorkspace();
  const agency = ws?.isAgency ?? false;
  return (
    <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="mx-auto max-w-[1800px] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            VoltaDigital<span className="text-[color:var(--color-accent)]">CRM</span>
          </Link>
          {agency && ws && ws.allOrgs.length > 1 && (
            <OrgSwitcher orgs={ws.allOrgs} activeOrgId={ws.activeOrgId} />
          )}
          <nav className="hidden lg:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              {agency ? "Übersicht" : "Dashboard"}
            </Link>
            <Link href="/board" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              Pipeline
            </Link>
            <Link href="/aufgaben" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              Aufgaben
            </Link>
            <Link href="/kalender" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              Kalender
            </Link>
            {agency && (
              <Link href="/rechnungen" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
                Rechnungen
              </Link>
            )}
            <Link href="/list" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              Liste
            </Link>
            <Link href="/statistik" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              Statistik
            </Link>
            <Link href="/downloads" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
              Downloads
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/papierkorb"
            title="Papierkorb"
            aria-label="Papierkorb"
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
          >
            <Trash2 className="w-4 h-4" />
          </Link>
          <Link href="/leads/new" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
            + Neuer Lead
          </Link>
          <span className="text-[color:var(--color-muted)] hidden sm:inline">{email}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
