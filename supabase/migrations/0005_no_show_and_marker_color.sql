-- 1. Zwei neue Stages: setter_no_show und erstgespraech_no_show
-- Werden vor den jeweiligen "won"/"done" Stages eingehängt damit der Funnel-Flow logisch bleibt
alter type public.lead_stage add value if not exists 'setter_no_show' before 'setter_won';
alter type public.lead_stage add value if not exists 'erstgespraech_no_show' before 'won';

-- 2. Marker-Farbe pro User für visuelle Lead-Zuordnung im Kanban
alter table public.profiles
  add column if not exists marker_color text;

-- 3. Defaults für bekannte User: Jerome rot, David blau
update public.profiles set marker_color = '#ef4444' where email = 'info@jeromederes.com' and marker_color is null;
update public.profiles set marker_color = '#3b82f6' where email = 'hallo@voltadigital.agency' and marker_color is null;
