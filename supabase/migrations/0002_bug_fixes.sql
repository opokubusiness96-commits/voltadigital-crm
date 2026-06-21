-- ─────────────────────────────────────────────────────────────────────────────
-- Bug-Fix-Migration für Phase 1
-- Reihenfolge: erst diese, DANACH 0003_merge_duplicates.sql, DANN unique constraint
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Vor- und Nachname zusätzlich (additiv, nicht-breaking)
alter table public.leads
  add column if not exists first_name text,
  add column if not exists last_name text;

-- 2. Email-Opt-Out (für spätere Brevo-Phase)
alter table public.leads
  add column if not exists email_opt_out boolean not null default false;

-- 3. Request-Log für Idempotency-Keys (5 Min Window)
create table if not exists public.request_log (
  idempotency_key text primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  lead_id    uuid references public.leads(id) on delete set null,
  endpoint   text not null,
  created_at timestamptz not null default now()
);

create index if not exists request_log_created_idx on public.request_log(created_at);

-- Auto-Cleanup: Einträge älter als 1h löschen können (Cron oder manuell)
alter table public.request_log enable row level security;
create policy "request_log_all_org" on public.request_log
  for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());

-- 4. Backfill first_name/last_name aus existierendem name (best-effort split)
update public.leads
set
  first_name = coalesce(first_name, split_part(name, ' ', 1)),
  last_name  = coalesce(last_name, nullif(regexp_replace(name, '^\S+\s*', ''), ''))
where name is not null
  and (first_name is null or last_name is null);
