-- ─────────────────────────────────────────────────────────────────────────────
-- Nikola MDK System — Tenant-Seed
-- Landingpage: https://mdk-system.lovable.app/schmerzfrei
--
-- VORAUSSETZUNG: Das Basis-Schema (Migrationen 0001–0009) ist in Supabase
-- deployt und die Default-Org 'jerome' existiert. Ist das nicht der Fall,
-- zuerst `supabase db push` bzw. die Migrationen einspielen (siehe RUNBOOK.md).
--
-- Idempotent: mehrfach ausführbar (on conflict do nothing / add column if not exists).
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) Lücke schließen: avatar_emoji wird vom Frontend abgefragt (app/board/page.tsx),
--    ist aber in KEINER Migration angelegt. Hier abgesichert.
alter table public.profiles add column if not exists avatar_emoji text;

-- 1) Mandant "Nikola MDK System" anlegen
insert into public.organizations (slug, name)
values ('nikola-mdk-system', 'Nikola MDK System')
on conflict (slug) do nothing;

-- 2) Pipeline-Stages: NICHTS zu tun.
--    Die 7 Kanban-Stages sind globale Frontend-Konstanten (lib/types.ts → STAGES),
--    KEINE per-Tenant-Daten. Farben = globale CSS-Variablen (app/globals.css).
--    → Jeder neue Workspace rendert automatisch dieselben 7 Stages mit denselben
--      Namen/Reihenfolge/Farben wie "Jerome Coaching". Keine Duplizierung nötig.
--
--    Reihenfolge & Labels (zur Referenz, identisch für alle Mandanten):
--      1. setter_call_booked          "Setter Call gebucht"
--      2. setter_no_show              "Setter No-Show"
--      3. setter_lost                 "Setter Lost"
--      4. klarheitsgespraech_booked   "Klarheitsgespräch gebucht"
--      5. klarheitsgespraech_no_show  "Klarheitsgespräch No-Show"
--      6. won                         "Won"           (Gold-Akzent)
--      7. klarheitsgespraech_lost     "Lost"

-- 3) Default-Tags für Nikola spiegeln (gleiche 15 Tags wie jerome-Seed in 0006_tags.sql)
do $$
declare nikola_org uuid;
begin
  select id into nikola_org from public.organizations where slug = 'nikola-mdk-system';
  if nikola_org is null then
    raise notice 'Org nikola-mdk-system fehlt — Basis-Schema zuerst deployen.';
    return;
  end if;

  insert into public.tags (org_id, category_id, label, description) values
    -- action
    (nikola_org, 'action', 'Im Call', 'Lead ist gerade live im Gespräch.'),
    (nikola_org, 'action', 'Hot Lead', 'Heißkontakt — innerhalb 24h zurückrufen.'),
    (nikola_org, 'action', 'Dringend', 'Action erforderlich heute.'),
    -- waiting
    (nikola_org, 'waiting', 'Follow-Up faellig', 'Geplanter Follow-Up-Kontakt steht an.'),
    (nikola_org, 'waiting', 'Angebot raus', 'Angebot wurde versendet, warten auf Reaktion.'),
    (nikola_org, 'waiting', 'Bedenkzeit', 'Lead überlegt sich Entscheidung.'),
    -- positive
    (nikola_org, 'positive', 'VIP', 'Hochwertiger Lead, Sonderbehandlung.'),
    (nikola_org, 'positive', 'Empfehlung', 'Kommt durch persönliche Empfehlung.'),
    (nikola_org, 'positive', 'Kaufbereit', 'Signalisiert konkrete Kauf-Absicht.'),
    -- source
    (nikola_org, 'source', 'Instagram', 'Quelle: Instagram-Kampagne oder DM.'),
    (nikola_org, 'source', 'Webinar', 'Quelle: Webinar-Anmeldung.'),
    (nikola_org, 'source', 'Empfehlung Quelle', 'Quelle: Empfehlung von Bestandskunde.'),
    -- archive
    (nikola_org, 'archive', 'Reaktivierung', 'Alter Lead, Re-Engagement-Versuch.'),
    (nikola_org, 'archive', 'Nicht erreichbar', 'Mehrfache Kontaktversuche fehlgeschlagen.'),
    (nikola_org, 'archive', 'Pausiert', 'Lead pausiert die Konversation.')
  on conflict do nothing;
end $$;

-- 4) Kontrolle
select o.slug, o.name, count(t.id) as tags
from public.organizations o
left join public.tags t on t.org_id = o.id
where o.slug = 'nikola-mdk-system'
group by o.slug, o.name;
