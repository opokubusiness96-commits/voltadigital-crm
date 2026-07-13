-- ─────────────────────────────────────────────────────────────────────────────
-- 0015 — email_log-Lesezugriff für die Agentur-Org 'volta' (analog 0012)
--
-- 0012 hat email_log ausgelassen. Die Kunden-Policy (org_id = current_org_id())
-- reicht für Simon (Jerome-Org) völlig — er sieht den "Nummer angefragt am …"-
-- Marker auf den Karten. Damit ABER auch David (Agentur) den Marker in Jeromes
-- Pipeline sieht, wird is_agency() ergänzt. Kunden-Orgs bleiben strikt isoliert.
--
-- HINWEIS: Optional. Ohne diese Migration funktioniert Versand + Logging + Marker
-- für die Jerome-Org unverändert; nur der Agentur-Blick auf den Marker fehlt.
-- Der Auslöser (auto/manual) wird in email_log.meta jsonb geschrieben — dafür ist
-- KEINE Schema-Änderung nötig.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "email_log_all_org" on public.email_log;
create policy "email_log_all_org" on public.email_log
  for all
  using (org_id = public.current_org_id() or public.is_agency())
  with check (org_id = public.current_org_id() or public.is_agency());
