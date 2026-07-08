-- ─────────────────────────────────────────────────────────────────────────────
-- 0013 — Sicherheits-Härtung profiles + security-definer-Helfer
--
-- (1) profiles_update_self (0001) hatte kein WITH CHECK. Bei UPDATE-Policies ohne
--     with-check gilt nur der using-Ausdruck (id = auth.uid()) — er schützt NICHT
--     die geschriebenen Spaltenwerte. Damit könnte ein User theoretisch seine
--     eigene org_id auf eine fremde Org (inkl. Agentur 'volta') umschreiben und so
--     die Mandantengrenze überspringen (nach 0012 sogar auf ALLE Mandanten).
--     Fix: org_id wird gegen den (committeten) Ist-Wert gepinnt. Legitime
--     Selbst-Edits (display_name, avatar_emoji, marker_color) lassen org_id
--     unverändert und passieren weiterhin.
--
-- (2) Hardening: festes search_path für die security-definer-Helfer, damit die
--     Org-Auflösung nicht per Objekt-Shadowing manipulierbar ist (Supabase-Linter
--     function_search_path_mutable).
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = public.current_org_id());

alter function public.current_org_id() set search_path = public, pg_temp;
alter function public.is_agency()      set search_path = public, pg_temp;

-- Kontrolle
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_self';
