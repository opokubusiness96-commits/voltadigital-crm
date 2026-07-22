"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { STAGE_LABEL, type Stage } from "@/lib/types";

type RecentLead = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  stage: Stage;
  created_at: string;
};

const POLL_MS = 30_000;
const seenKey = (orgId: string) => `leadSeenAt:${orgId}`;

const SOURCE_LABEL: Record<string, string> = {
  calendly_setter: "Erstgespräch gebucht",
  calendly_erstgespraech: "Klarheitsgespräch gebucht",
  manual: "Manuell angelegt",
};

function leadName(l: RecentLead): string {
  return (
    l.name ||
    [l.first_name, l.last_name].filter(Boolean).join(" ") ||
    "Neuer Lead"
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d === 1 ? "" : "en"}`;
}

export function LeadNotifications({ orgId }: { orgId: string | null }) {
  const [leads, setLeads] = useState<RecentLead[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // "ab jetzt": beim ersten Laden ohne gespeicherten Wert = jetzt → keine
  // Bestandsleads werden als neu markiert. Pro Org getrennt (Agentur-Switch).
  useEffect(() => {
    if (!orgId) return;
    const stored = localStorage.getItem(seenKey(orgId));
    if (stored) {
      setSeenAt(stored);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(seenKey(orgId), now);
      setSeenAt(now);
    }
  }, [orgId]);

  const poll = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch("/api/leads/recent", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { leads: RecentLead[] };
      setLeads(data.leads ?? []);
    } catch {
      // Netzwerk-Hänger ignorieren — nächster Tick versucht es erneut.
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [orgId, poll]);

  // Klick außerhalb schließt das Dropdown.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const newLeads = seenAt
    ? leads.filter((l) => l.created_at > seenAt)
    : [];
  const count = newLeads.length;

  const markSeen = () => {
    if (!orgId) return;
    const now = new Date().toISOString();
    localStorage.setItem(seenKey(orgId), now);
    setSeenAt(now);
  };

  if (!orgId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Neue Leads"
        aria-label={count > 0 ? `${count} neue Leads` : "Neue Leads"}
        className="relative flex items-center text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
      >
        <Mail className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] px-[3px] flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border)]">
            <span className="font-semibold text-sm">
              {count > 0 ? `${count} neue${count === 1 ? "r" : ""} Lead${count === 1 ? "" : "s"}` : "Keine neuen Leads"}
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={markSeen}
                className="text-xs text-[color:var(--color-accent)] hover:underline"
              >
                Als gelesen markieren
              </button>
            )}
          </div>
          <ul className="divide-y divide-[color:var(--color-border)]">
            {leads.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-[color:var(--color-muted)]">
                Noch keine Leads.
              </li>
            )}
            {leads.slice(0, 15).map((l) => {
              const isNew = seenAt ? l.created_at > seenAt : false;
              return (
                <li key={l.id}>
                  <Link
                    href={`/leads/${l.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 px-4 py-3 hover:bg-[color:var(--color-bg)] transition-colors"
                  >
                    {isNew && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-red-600 shrink-0" aria-hidden />
                    )}
                    <span className={`flex-1 ${isNew ? "" : "pl-4"}`}>
                      <span className="block text-sm font-medium text-[color:var(--color-text)]">
                        {leadName(l)}
                      </span>
                      <span className="block text-xs text-[color:var(--color-muted)]">
                        {(l.source && SOURCE_LABEL[l.source]) || STAGE_LABEL[l.stage] || "Lead"} · {relTime(l.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[color:var(--color-border)]">
            <Link
              href="/board"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-sm text-[color:var(--color-accent)] hover:underline"
            >
              Zur Pipeline
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
