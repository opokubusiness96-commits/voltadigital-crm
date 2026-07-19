-- 0016 — Anruf-Versuche + "Nicht erreicht"-Mail auf der Lead-Karte
--
-- call_attempts: manueller Zähler (0..4), hochgezählt über den "+"-Button auf der
--   Board-Karte. Rein operatives Tracking, keine Automatik.
-- no_show_email_sent_at: Zeitpunkt der EINMALIGEN "Nicht erreicht"-Mail
--   (Template setter_no_show_recovery, ausgelöst ab dem 4. Versuch). Dient als
--   Button-Sperre (non-null = bereits gesendet) UND als Karten-Marker. Der Versand
--   läuft zusätzlich durch die email_log-Idempotenz von sendStageEmail — der Guard
--   hier ist die schnelle, direkt auf der Karte sichtbare Sperre.

alter table public.leads
  add column if not exists call_attempts        integer not null default 0,
  add column if not exists no_show_email_sent_at timestamptz;

-- Defensive Untergrenze; die Obergrenze (4) erzwingt die App-Logik, damit ein
-- späteres Anheben des Limits keine Migration braucht.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_call_attempts_nonneg'
  ) then
    alter table public.leads
      add constraint leads_call_attempts_nonneg check (call_attempts >= 0);
  end if;
end $$;
