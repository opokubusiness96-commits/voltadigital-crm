-- ─────────────────────────────────────────────────────────────────────────────
-- 0014 — Agentur-Mitglieder in jeder Kunden-Pipeline sichtbar
--
-- Damit David (Agentur-Org 'volta') als Teammitglied-Marker auch dann in einer
-- Kunden-Pipeline erscheint, wenn ein KUNDE (z.B. Nikola/Carl) eingeloggt ist,
-- dürfen alle User zusätzlich die Profile der Agentur-Org sehen.
--
-- Isolation bleibt gewahrt: Kunden sehen NUR ihre eigene Org + die Agentur —
-- KEINE Profile anderer Kunden-Orgs. (leads/activities/… bleiben komplett
-- org-isoliert; das hier betrifft ausschließlich profiles = Personen-Marker.)
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.agency_org_id()
returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select id from public.organizations where slug = 'volta' limit 1;
$$;

drop policy if exists "profiles_select_own_org" on public.profiles;
create policy "profiles_select_own_org" on public.profiles
  for select using (
    org_id = public.current_org_id()
    or org_id = public.agency_org_id()
    or public.is_agency()
  );

-- Kontrolle
select policyname, qual from pg_policies
where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own_org';
