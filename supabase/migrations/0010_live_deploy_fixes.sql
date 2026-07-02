-- ─────────────────────────────────────────────────────────────────────────────
-- Live-Deploy-Fixes (2026-07-02) — bereits auf lysphikolwkrltjnuzlf angewandt.
-- Dokumentiert die Drift zwischen committeten Migrationen und dem, was Frontend
-- + 0003 tatsächlich erwarten. Idempotent.
--
-- HINWEIS Ausführung: Die "alter type ... add value"-Blöcke müssen in einer
-- SEPARATEN Transaktion laufen, bevor die neuen Werte benutzt werden
-- (Postgres-Regel: neue Enum-Werte nicht in derselben Transaktion verwendbar).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Spalten, die 0003 + Frontend erwarten, aber keine Migration anlegt
--    (im Original-Jerome-CRM offenbar manuell angelegt worden)
alter table public.leads
  add column if not exists business_years text,
  add column if not exists revenue_band   text,
  add column if not exists quiz_score     integer;

-- 2) avatar_emoji — vom Board abgefragt (app/board/page.tsx), fehlte im Schema
alter table public.profiles add column if not exists avatar_emoji text;

-- 3) UI-Stage-Namen (lib/types.ts STAGES) fehlten im lead_stage-Enum.
--    Enum behielt die alten calendly_*-Werte für Rückwärts-Kompatibilität.
alter type public.lead_stage add value if not exists 'setter_call_booked' before 'setter_call_done';
alter type public.lead_stage add value if not exists 'klarheitsgespraech_booked' before 'erstgespraech_booked';
alter type public.lead_stage add value if not exists 'klarheitsgespraech_no_show' before 'won';
alter type public.lead_stage add value if not exists 'klarheitsgespraech_lost' before 'lost';

-- ── AB HIER: separate Transaktion (nutzt die neuen Enum-Werte) ───────────────

-- 4) Default auf UI-Wert; Alt-Daten migrieren
-- alter table public.leads alter column stage set default 'setter_call_booked';
-- update public.leads set stage = 'setter_call_booked' where stage = 'calendly_booked_setter';

-- 5) Hinweis: In 0008 stand "create policy if not exists" — das ist KEIN gültiges
--    Postgres-Syntax. Beim Live-Deploy wurde plain "create policy" verwendet.
