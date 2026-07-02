-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL: Per-Workspace-Branding (Physioboii-Farbwelt für Nikola)
--
-- ⚠️ Aktuell NICHT wirksam ohne Frontend-Änderung. Die Farben im CRM kommen aus
--    globalen CSS-Variablen (app/globals.css, Gold-Monochrom). Diese Migration
--    legt die Daten an; damit sie sichtbar werden, muss app/layout.tsx die
--    org-Farben als CSS-Variablen (--color-accent, --color-bg …) injizieren.
--    Frontend-Schritt siehe RUNBOOK.md (Abschnitt "Branding").
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.organizations
  add column if not exists brand_primary    text,   -- Bordeaux Rot
  add column if not exists brand_secondary  text,   -- Pastell Azur Blau
  add column if not exists brand_accent     text,   -- Waldgrün
  add column if not exists brand_background text;    -- Bone White

update public.organizations set
  brand_primary    = '#5F021F',
  brand_secondary  = '#A8D5E5',
  brand_accent     = '#2F5D50',
  brand_background  = '#F3F0E8'
where slug = 'nikola-mdk-system';

select slug, brand_primary, brand_secondary, brand_accent, brand_background
from public.organizations where slug = 'nikola-mdk-system';
