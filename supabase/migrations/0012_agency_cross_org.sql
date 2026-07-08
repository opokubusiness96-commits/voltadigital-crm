-- ─────────────────────────────────────────────────────────────────────────────
-- 0012 — Agentur-Cross-Org-Zugriff
--
-- Die Agentur-Org (slug 'volta') darf ALLE Mandanten-Pipelines sehen und darin
-- mitarbeiten. Kunden-Orgs bleiben strikt isoliert: is_agency() ist für sie
-- immer false, ihre Policy-Bedingung (org_id = current_org_id()) ändert sich
-- inhaltlich nicht. Das App-Frontend filtert für die Agentur zusätzlich auf die
-- jeweils AKTIVE Org (Cookie), damit nicht alle Mandanten vermischt werden.
--
-- Idempotent: drop policy if exists + create.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: ist der eingeloggte User Mitglied der Agentur-Org 'volta'?
-- security definer → liest profiles/organizations ohne RLS-Rekursion (wie current_org_id).
create or replace function public.is_agency()
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.profiles p
    join public.organizations o on o.id = p.org_id
    where p.id = auth.uid() and o.slug = 'volta'
  );
$$;

-- ── org-gescopte "for all"-Tabellen: Kunden-Bedingung + OR is_agency() ──────────
-- leads
drop policy if exists "leads_all_own_org" on public.leads;
create policy "leads_all_own_org" on public.leads
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- activities
drop policy if exists "activities_all_own_org" on public.activities;
create policy "activities_all_own_org" on public.activities
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- tags
drop policy if exists "tags_all_own_org" on public.tags;
create policy "tags_all_own_org" on public.tags
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- lead_tags
drop policy if exists "lead_tags_all_own_org" on public.lead_tags;
create policy "lead_tags_all_own_org" on public.lead_tags
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- lead_assignments
drop policy if exists "lead_assignments_all_own_org" on public.lead_assignments;
create policy "lead_assignments_all_own_org" on public.lead_assignments
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- notes (0008, lead-gebunden)
drop policy if exists "notes_org_all" on public.notes;
create policy "notes_org_all" on public.notes
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- tasks (0008, lead-gebunden)
drop policy if exists "tasks_org_all" on public.tasks;
create policy "tasks_org_all" on public.tasks
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- call_logs (0008)
drop policy if exists "call_logs_org_all" on public.call_logs;
create policy "call_logs_org_all" on public.call_logs
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- team_tasks (0011)
drop policy if exists "team_tasks_all_own_org" on public.team_tasks;
create policy "team_tasks_all_own_org" on public.team_tasks
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- team_events (0011)
drop policy if exists "team_events_all_own_org" on public.team_events;
create policy "team_events_all_own_org" on public.team_events
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- team_notes (0011)
drop policy if exists "team_notes_all_own_org" on public.team_notes;
create policy "team_notes_all_own_org" on public.team_notes
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- ── Select-Policies: Agentur sieht alle Profile + Organisationen ───────────────
-- profiles: eigene Org ODER (Agentur sieht alle → für Personen-Marker in jeder Pipeline)
drop policy if exists "profiles_select_own_org" on public.profiles;
create policy "profiles_select_own_org" on public.profiles
  for select using (org_id = public.current_org_id() or public.is_agency());

-- organizations: eigene ODER (Agentur sieht alle → für den Org-Umschalter)
drop policy if exists "organizations_select_own" on public.organizations;
create policy "organizations_select_own" on public.organizations
  for select using (id = public.current_org_id() or public.is_agency());

-- Kontrolle
select tablename, policyname from pg_policies
where schemaname = 'public'
  and policyname in (
    'leads_all_own_org','activities_all_own_org','tags_all_own_org','lead_tags_all_own_org',
    'lead_assignments_all_own_org','notes_org_all','tasks_org_all','call_logs_org_all',
    'team_tasks_all_own_org','team_events_all_own_org','team_notes_all_own_org',
    'profiles_select_own_org','organizations_select_own'
  )
order by tablename;
