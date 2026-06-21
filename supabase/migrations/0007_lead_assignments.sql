-- N:M Lead-Assignments — mehrere User können einem Lead zugewiesen sein.
-- Bestehende leads.owner_id wird in lead_assignments übernommen, bleibt aber als
-- "primary owner" für Backward-Compat (z.B. erste-Filter-Default).

create table if not exists public.lead_assignments (
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (lead_id, user_id)
);

create index if not exists lead_assignments_lead_idx on public.lead_assignments(lead_id);
create index if not exists lead_assignments_user_idx on public.lead_assignments(user_id);

alter table public.lead_assignments enable row level security;
create policy "lead_assignments_all_own_org" on public.lead_assignments
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Migration: bestehende owner_id in lead_assignments übernehmen
insert into public.lead_assignments (lead_id, user_id, org_id, assigned_at)
select id, owner_id, org_id, updated_at
from public.leads
where owner_id is not null
on conflict (lead_id, user_id) do nothing;
