-- ─────────────────────────────────────────────────────────────────────────────
-- Existierende Duplikate (gleiche org_id + lower(email)) mergen.
-- Strategie: behalte die "vollständigste" Zeile (meiste non-null Felder),
-- übertrage non-null Werte aus den Duplikaten in den Survivor, log per activities.
-- Idempotent: zweiter Lauf macht nichts mehr.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  rec record;
  survivor_id uuid;
  duplicate_ids uuid[];
begin
  for rec in
    select org_id, lower(email) as email_lc, count(*) as cnt
    from public.leads
    where email is not null
    group by org_id, lower(email)
    having count(*) > 1
  loop
    -- Survivor: höchste Score über non-null Felder, dann älteste Zeile
    select id into survivor_id
    from public.leads
    where org_id = rec.org_id and lower(email) = rec.email_lc
    order by
      ((case when name is not null then 1 else 0 end) +
       (case when first_name is not null then 1 else 0 end) +
       (case when last_name is not null then 1 else 0 end) +
       (case when phone is not null then 1 else 0 end) +
       (case when business_years is not null then 1 else 0 end) +
       (case when revenue_band is not null then 1 else 0 end) +
       (case when calendly_setter_event_uri is not null then 1 else 0 end) +
       (case when notes is not null then 1 else 0 end) +
       (case when value_estimate is not null then 1 else 0 end)) desc,
      created_at asc
    limit 1;

    -- Werte aus Duplikaten in Survivor mergen (jeweils nur falls Survivor null hat)
    update public.leads s
    set
      name           = coalesce(s.name, dup.name),
      first_name     = coalesce(s.first_name, dup.first_name),
      last_name      = coalesce(s.last_name, dup.last_name),
      phone          = coalesce(s.phone, dup.phone),
      business_years = coalesce(s.business_years, dup.business_years),
      revenue_band   = coalesce(s.revenue_band, dup.revenue_band),
      quiz_score     = coalesce(s.quiz_score, dup.quiz_score),
      utm_source     = coalesce(s.utm_source, dup.utm_source),
      utm_medium     = coalesce(s.utm_medium, dup.utm_medium),
      utm_campaign   = coalesce(s.utm_campaign, dup.utm_campaign),
      utm_content    = coalesce(s.utm_content, dup.utm_content),
      calendly_setter_event_uri        = coalesce(s.calendly_setter_event_uri, dup.calendly_setter_event_uri),
      calendly_setter_scheduled_at     = coalesce(s.calendly_setter_scheduled_at, dup.calendly_setter_scheduled_at),
      calendly_erstgespraech_event_uri = coalesce(s.calendly_erstgespraech_event_uri, dup.calendly_erstgespraech_event_uri),
      calendly_erstgespraech_scheduled_at = coalesce(s.calendly_erstgespraech_scheduled_at, dup.calendly_erstgespraech_scheduled_at),
      notes          = coalesce(s.notes, dup.notes),
      source_manual  = coalesce(s.source_manual, dup.source_manual),
      value_estimate = coalesce(s.value_estimate, dup.value_estimate)
    from (
      select * from public.leads
      where org_id = rec.org_id and lower(email) = rec.email_lc and id != survivor_id
      order by created_at desc
      limit 1
    ) dup
    where s.id = survivor_id;

    -- Activities der Duplikate auf Survivor umhängen
    update public.activities
    set lead_id = survivor_id
    where lead_id in (
      select id from public.leads
      where org_id = rec.org_id and lower(email) = rec.email_lc and id != survivor_id
    );

    -- Log-Activity
    select array_agg(id) into duplicate_ids
    from public.leads
    where org_id = rec.org_id and lower(email) = rec.email_lc and id != survivor_id;

    insert into public.activities (org_id, lead_id, type, content, meta)
    values (
      rec.org_id,
      survivor_id,
      'lead_updated',
      'Duplikate gemerged (Migration 0003): ' || coalesce(rec.email_lc, ''),
      jsonb_build_object('merged_from', to_jsonb(duplicate_ids))
    );

    -- Duplikate löschen
    delete from public.leads
    where org_id = rec.org_id and lower(email) = rec.email_lc and id != survivor_id;
  end loop;
end $$;

-- Jetzt der Unique-Constraint — sicher, weil keine Duplikate mehr da
create unique index if not exists leads_org_email_unique
  on public.leads (org_id, lower(email))
  where email is not null;
