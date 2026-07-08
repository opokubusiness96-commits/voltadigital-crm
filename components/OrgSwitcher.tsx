"use client";

import { useTransition } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { setActiveOrg } from "@/app/actions/workspace";
import type { OrgInfo } from "@/lib/org";

// Agentur-Umschalter: wählt die Kunden-Org, in der gearbeitet wird.
// Kunden sehen diesen Umschalter nie (nur eine Org).
export function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: OrgInfo[];
  activeOrgId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="relative flex items-center gap-1.5 text-sm">
      <Building2 className="w-4 h-4 text-[color:var(--color-accent)] shrink-0" aria-hidden />
      <div className="relative">
        <select
          aria-label="Aktive Kunden-Pipeline"
          value={activeOrgId}
          disabled={pending}
          onChange={(e) => startTransition(() => setActiveOrg(e.target.value))}
          className="appearance-none bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-md pl-2.5 pr-7 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] transition cursor-pointer disabled:opacity-50 max-w-[200px] truncate"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-[color:var(--color-muted)] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}
