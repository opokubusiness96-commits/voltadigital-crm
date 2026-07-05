-- ─────────────────────────────────────────────────────────────────────────────
-- 0011 — Team-Workspace: Aufgaben, Termine, Notizen pro Mandant
--
-- Echte (nicht-Mock) Tabellen für die Kunden-Orgs (z. B. Nikola MDK System):
-- Sales-/Marketing-/Planungs-Arbeit im CRM. RLS identisch zum leads-Muster
-- (current_org_id aus 0001) — jede Org sieht/schreibt nur ihre eigenen Zeilen.
--
-- ACHTUNG Namenswahl: 0008_lead_action_menu.sql belegt bereits public.tasks
-- (lead-gebundene Follow-ups) und public.notes (Lead-Notizen) mit anderem
-- Schema. Die Team-Workspace-Tabellen heißen deshalb team_tasks/team_events/
-- team_notes — NICHT umbenennen zu tasks/notes.
-- Idempotent: mehrfach ausführbar.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Team-Aufgaben (org-weit, nicht lead-gebunden)
create table if not exists public.team_tasks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  due_date    date,
  priority    text not null default 'mittel'    check (priority in ('hoch','mittel','niedrig')),
  category    text not null default 'sonstiges' check (category in ('sales','marketing','planung','sonstiges')),
  done        boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists team_tasks_org_idx on public.team_tasks(org_id, done, due_date);

-- 2. Termine / Planungs-Events (Kalender)
create table if not exists public.team_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  date        date not null,
  time        text,  -- "HH:MM", optional (ganztägig wenn null)
  category    text not null default 'sonstiges' check (category in ('sales','marketing','planung','sonstiges')),
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists team_events_org_date_idx on public.team_events(org_id, date);

-- 3. Notizen (Team-Pinnwand)
create table if not exists public.team_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  body        text not null,
  pinned      boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists team_notes_org_idx on public.team_notes(org_id, pinned desc, created_at desc);

-- 4. updated_at-Trigger (Funktion set_updated_at aus 0001 wiederverwenden)
drop trigger if exists team_tasks_updated_at on public.team_tasks;
create trigger team_tasks_updated_at
before update on public.team_tasks
for each row execute procedure public.set_updated_at();

-- 5. RLS aktivieren + Policies (Muster wie leads_all_own_org)
alter table public.team_tasks  enable row level security;
alter table public.team_events enable row level security;
alter table public.team_notes  enable row level security;

drop policy if exists "team_tasks_all_own_org" on public.team_tasks;
create policy "team_tasks_all_own_org" on public.team_tasks
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists "team_events_all_own_org" on public.team_events;
create policy "team_events_all_own_org" on public.team_events
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists "team_notes_all_own_org" on public.team_notes;
create policy "team_notes_all_own_org" on public.team_notes
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- 6. Kontrolle
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'team_%' order by 1;
