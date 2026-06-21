-- Email-Log + Scheduled-Emails für Brevo Stage-Transition-Mails

create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  template    text not null,
  to_email    text not null,
  brevo_message_id text,
  status      text not null default 'sent' check (status in ('sent','failed','skipped_optout','skipped_dup')),
  error       text,
  meta        jsonb,
  sent_at     timestamptz not null default now()
);

create index if not exists email_log_lead_template_idx on public.email_log(lead_id, template);
create index if not exists email_log_org_idx on public.email_log(org_id, sent_at desc);

create table if not exists public.scheduled_emails (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  template    text not null,
  run_at      timestamptz not null,
  status      text not null default 'pending' check (status in ('pending','sent','failed','canceled')),
  payload     jsonb,
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists scheduled_emails_runat_idx on public.scheduled_emails(run_at) where status = 'pending';
create index if not exists scheduled_emails_lead_idx on public.scheduled_emails(lead_id, status);

alter table public.email_log enable row level security;
alter table public.scheduled_emails enable row level security;

create policy "email_log_all_org" on public.email_log
  for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy "scheduled_emails_all_org" on public.scheduled_emails
  for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
