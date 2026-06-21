-- Tag-System für Leads (Lead-Info, NICHT Personen-Zuordnung).
-- 5 Kategorien mit fester Farbe. Tags erben Farbe von ihrer Kategorie.

create table if not exists public.tag_categories (
  id    text primary key check (id in ('action','waiting','positive','source','archive')),
  label text not null,
  color text not null
);

insert into public.tag_categories (id, label, color) values
  ('action',   'Action',   '#ef4444'),
  ('waiting',  'Waiting',  '#eab308'),
  ('positive', 'Positiv',  '#22c55e'),
  ('source',   'Quelle',   '#3b82f6'),
  ('archive',  'Archiv',   '#6b7280')
on conflict (id) do update
  set label = excluded.label,
      color = excluded.color;

create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  category_id text not null references public.tag_categories(id),
  label       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create unique index if not exists tags_org_label_unique on public.tags(org_id, lower(label));
create index if not exists tags_org_idx on public.tags(org_id);
create index if not exists tags_category_idx on public.tags(category_id);

create table if not exists public.lead_tags (
  lead_id    uuid not null references public.leads(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (lead_id, tag_id)
);

create index if not exists lead_tags_lead_idx on public.lead_tags(lead_id);
create index if not exists lead_tags_tag_idx on public.lead_tags(tag_id);

-- RLS
alter table public.tag_categories enable row level security;
alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;

-- Categories sind global lesbar
create policy "tag_categories_read_all_authed" on public.tag_categories
  for select using (auth.role() = 'authenticated');

-- Tags + Lead-Tags scoped per Org
create policy "tags_all_own_org" on public.tags
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "lead_tags_all_own_org" on public.lead_tags
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Seed Default-Tags für die jerome-Org
do $$
declare jerome_org uuid;
begin
  select id into jerome_org from public.organizations where slug = 'jerome';
  if jerome_org is null then return; end if;

  insert into public.tags (org_id, category_id, label, description) values
    -- action (rot)
    (jerome_org, 'action', 'Im Call', 'Lead ist gerade live im Gespräch.'),
    (jerome_org, 'action', 'Hot Lead', 'Heißkontakt — innerhalb 24h zurückrufen.'),
    (jerome_org, 'action', 'Dringend', 'Action erforderlich heute.'),
    -- waiting (gelb)
    (jerome_org, 'waiting', 'Follow-Up faellig', 'Geplanter Follow-Up-Kontakt steht an.'),
    (jerome_org, 'waiting', 'Angebot raus', 'Angebot wurde versendet, warten auf Reaktion.'),
    (jerome_org, 'waiting', 'Bedenkzeit', 'Lead überlegt sich Entscheidung.'),
    -- positive (grün)
    (jerome_org, 'positive', 'VIP', 'Hochwertiger Lead, Sonderbehandlung.'),
    (jerome_org, 'positive', 'Empfehlung', 'Kommt durch persönliche Empfehlung.'),
    (jerome_org, 'positive', 'Kaufbereit', 'Signalisiert konkrete Kauf-Absicht.'),
    -- source (blau)
    (jerome_org, 'source', 'Instagram', 'Quelle: Instagram-Kampagne oder DM.'),
    (jerome_org, 'source', 'Webinar', 'Quelle: Webinar-Anmeldung.'),
    (jerome_org, 'source', 'Empfehlung Quelle', 'Quelle: Empfehlung von Bestandskunde.'),
    -- archive (grau)
    (jerome_org, 'archive', 'Reaktivierung', 'Alter Lead, Re-Engagement-Versuch.'),
    (jerome_org, 'archive', 'Nicht erreichbar', 'Mehrfache Kontaktversuche fehlgeschlagen.'),
    (jerome_org, 'archive', 'Pausiert', 'Lead pausiert die Konversation.')
  on conflict do nothing;
end $$;
