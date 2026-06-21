-- ─────────────────────────────────────────────────────────────────────────────
-- crm.jeromederes.com — Initial Schema
-- Multi-tenant ready (organizations + org_id + RLS), single-org for Phase 1
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Organizations
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  created_at   timestamptz not null default now()
);

-- Default Organisation für Jerome
insert into public.organizations (slug, name) values ('jerome', 'Jerome Deres Coaching');

-- 2. Profile (verbindet auth.users mit Organization + Rolle)
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  email        text not null unique,
  display_name text,
  role         text not null default 'closer'
                check (role in ('admin','closer','setter','viewer')),
  created_at   timestamptz not null default now()
);

create index profiles_org_idx on public.profiles(org_id);

-- 3. Stage Enum
create type public.lead_stage as enum (
  'calendly_booked_setter',
  'setter_call_done',
  'setter_won',
  'setter_lost',
  'erstgespraech_booked',
  'erstgespraech_done',
  'won',
  'lost'
);

-- 4. Source Enum
create type public.lead_source as enum (
  'calendly_setter',
  'calendly_erstgespraech',
  'manual'
);

-- 5. Activity Type Enum
create type public.activity_type as enum (
  'booking',
  'booking_canceled',
  'stage_change',
  'note',
  'call_done',
  'lead_created',
  'lead_updated'
);

-- 6. Leads
create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  source       public.lead_source not null default 'manual',
  source_manual text,

  name         text,
  email        text,
  phone        text,

  stage        public.lead_stage not null default 'calendly_booked_setter',
  owner_id     uuid references auth.users(id) on delete set null,

  value_estimate numeric(12,2),
  lost_reason  text,
  notes        text,

  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,

  calendly_setter_event_uri        text unique,
  calendly_setter_scheduled_at     timestamptz,
  calendly_erstgespraech_event_uri text unique,
  calendly_erstgespraech_scheduled_at timestamptz
);

create index leads_org_idx       on public.leads(org_id);
create index leads_stage_idx     on public.leads(stage);
create index leads_owner_idx     on public.leads(owner_id);
create index leads_created_idx   on public.leads(created_at desc);
create index leads_email_idx     on public.leads(email);

-- 7. Activities
create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  type        public.activity_type not null,
  content     text,
  meta        jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index activities_lead_idx     on public.activities(lead_id, created_at desc);
create index activities_org_idx      on public.activities(org_id, created_at desc);

-- 8. updated_at Trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();

-- 9. Stage-Change Activity Trigger (logged automatisch in activities)
create or replace function public.log_stage_change()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.activities (org_id, lead_id, type, content, meta, created_by)
    values (
      new.org_id,
      new.id,
      'stage_change',
      old.stage::text || ' → ' || new.stage::text,
      jsonb_build_object('from', old.stage, 'to', new.stage),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger leads_log_stage_change
after update of stage on public.leads
for each row execute procedure public.log_stage_change();

-- 10. RLS aktivieren
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.leads         enable row level security;
alter table public.activities    enable row level security;

-- 11. Helper-Funktion: org_id des eingeloggten Users
create or replace function public.current_org_id()
returns uuid language sql stable security definer as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- 12. Policies
-- profiles: User sieht alle Profile seiner Org (für Owner-Dropdown), nur eigenes editierbar
create policy "profiles_select_own_org" on public.profiles
  for select using (org_id = public.current_org_id());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- organizations: nur eigene
create policy "organizations_select_own" on public.organizations
  for select using (id = public.current_org_id());

-- leads: nur eigene Org, alle authentifizierten Org-User dürfen alles
create policy "leads_all_own_org" on public.leads
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- activities: nur eigene Org
create policy "activities_all_own_org" on public.activities
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- 13. Auto-Profile-Anlage beim Sign-Up (via Trigger auf auth.users)
-- Hängt neue User automatisch an die Default-Organisation 'jerome'.
-- Für Multi-Tenant später: Trigger-Logik auf Email-Domain oder Invite-Token erweitern.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  default_org uuid;
begin
  select id into default_org from public.organizations where slug = 'jerome';
  insert into public.profiles (id, org_id, email, role)
  values (new.id, default_org, new.email, 'closer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
