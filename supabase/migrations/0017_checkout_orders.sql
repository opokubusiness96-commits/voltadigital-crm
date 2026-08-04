-- ─────────────────────────────────────────────────────────────────────────────
-- 0017 — Checkout-Bestellungen (öffentliche Seite /checkout)
--
-- Speichert die Bestellungen der öffentlichen Checkout-Seite. Das ANGEBOT selbst
-- (Name, Preis, Raten) liegt als Code-Konfiguration in lib/checkout.ts — hier
-- landet nur, was tatsächlich bestellt wurde, inkl. eingefrorenem Betrag zum
-- Bestellzeitpunkt (amount_gross/vat_rate), damit spätere Preisänderungen alte
-- Bestellungen nicht rückwirkend verfälschen.
--
-- Schreibzugriff: NUR über die Server Action mit Service-Role-Key (RLS-Bypass).
-- Es gibt bewusst KEINE insert-Policy — anonyme Besucher schreiben nie direkt.
-- Lesen/Ändern: die eigene Org (+ Agentur 'volta' über is_agency(), Muster 0012).
--
-- Idempotent: mehrfach ausführbar.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.checkout_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Bestellnummer für Kunde + Verwendungszweck der Überweisung ("JD-2608-K3F9")
  reference     text not null unique,

  -- Angebots-Snapshot (aus lib/checkout.ts zum Bestellzeitpunkt)
  offer_slug    text not null,
  offer_name    text not null,
  plan_id       text not null,
  installments  integer not null default 1 check (installments >= 1),
  amount_gross  numeric(12,2) not null check (amount_gross >= 0),
  vat_rate      numeric(4,3) not null default 0.190,
  currency      text not null default 'EUR',

  -- Besteller / Rechnungsadresse
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  company       text,
  vat_id        text,
  street        text not null,
  postal_code   text not null,
  city          text not null,
  country       text not null default 'Deutschland',
  notes         text,

  -- Zahlungsstatus wird im CRM gepflegt (kein Payment-Provider angebunden)
  status        text not null default 'offen'
                  check (status in ('offen','bezahlt','storniert')),
  paid_at       timestamptz,

  -- Verknüpfung in die Pipeline
  lead_id       uuid references public.leads(id) on delete set null,

  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text
);

create index if not exists checkout_orders_org_idx     on public.checkout_orders(org_id, created_at desc);
create index if not exists checkout_orders_status_idx  on public.checkout_orders(org_id, status);
create index if not exists checkout_orders_email_idx   on public.checkout_orders(email);
create index if not exists checkout_orders_lead_idx    on public.checkout_orders(lead_id);

-- updated_at-Trigger (Funktion set_updated_at aus 0001 wiederverwenden)
drop trigger if exists checkout_orders_updated_at on public.checkout_orders;
create trigger checkout_orders_updated_at
before update on public.checkout_orders
for each row execute procedure public.set_updated_at();

-- RLS: Muster wie leads_all_own_org (0001 + Agentur-Erweiterung 0012)
alter table public.checkout_orders enable row level security;

drop policy if exists "checkout_orders_all_own_org" on public.checkout_orders;
create policy "checkout_orders_all_own_org" on public.checkout_orders
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());

-- Kontrolle
select tablename, policyname from pg_policies
where schemaname = 'public' and tablename = 'checkout_orders';
