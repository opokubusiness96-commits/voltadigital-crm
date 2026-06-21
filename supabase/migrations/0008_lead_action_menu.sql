-- ─────────────────────────────────────────────────────────────────────────────
-- Lead Card Action Menu — notes, tasks, call_logs + leads-Erweiterungen
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Activity Type Enum erweitern
alter type public.activity_type add value if not exists 'note_added';
alter type public.activity_type add value if not exists 'tag_added';
alter type public.activity_type add value if not exists 'tag_removed';
alter type public.activity_type add value if not exists 'followup_scheduled';
alter type public.activity_type add value if not exists 'task_created';
alter type public.activity_type add value if not exists 'assignee_changed';
alter type public.activity_type add value if not exists 'marked_won';
alter type public.activity_type add value if not exists 'marked_lost';
alter type public.activity_type add value if not exists 'lead_duplicated';
alter type public.activity_type add value if not exists 'lead_archived';
alter type public.activity_type add value if not exists 'lead_deleted';
alter type public.activity_type add value if not exists 'call_logged';

-- 2. leads Erweiterungen
alter table public.leads add column if not exists archived           boolean not null default false;
alter table public.leads add column if not exists loss_reason_detail text;
alter table public.leads add column if not exists assignee_id        uuid references auth.users(id) on delete set null;

create index if not exists leads_archived_idx on public.leads(archived) where archived = false;
create index if not exists leads_assignee_idx on public.leads(assignee_id);

-- 3. notes (separate Tabelle, aber alte text-Spalte leads.notes bleibt für Backcompat)
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists notes_lead_idx on public.notes(lead_id, created_at desc);
create index if not exists notes_org_idx  on public.notes(org_id, created_at desc);

-- 4. tasks
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  title       text not null,
  due_date    timestamptz,
  assignee_id uuid references auth.users(id) on delete set null,
  status      text not null default 'open' check (status in ('open','done','canceled')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists tasks_lead_idx     on public.tasks(lead_id, created_at desc);
create index if not exists tasks_org_idx      on public.tasks(org_id, due_date asc);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id, status);

-- 5. call_logs
create table if not exists public.call_logs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,
  outcome         text not null check (outcome in (
    'reached',
    'voicemail_left',
    'voicemail_no_message',
    'no_answer',
    'wrong_number',
    'appointment_scheduled',
    'not_interested'
  )),
  duration_minutes integer check (duration_minutes >= 0 and duration_minutes <= 120),
  note            text,
  called_at       timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists call_logs_lead_idx on public.call_logs(lead_id, called_at desc);
create index if not exists call_logs_org_idx  on public.call_logs(org_id, called_at desc);

-- 6. RLS aktivieren — selbe Policy wie leads (org_id-scoped)
alter table public.notes     enable row level security;
alter table public.tasks     enable row level security;
alter table public.call_logs enable row level security;

-- Policies: Member der Org darf SELECT/INSERT/UPDATE/DELETE
create policy if not exists notes_org_all on public.notes
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy if not exists tasks_org_all on public.tasks
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy if not exists call_logs_org_all on public.call_logs
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
