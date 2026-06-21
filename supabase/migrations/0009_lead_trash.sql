-- Soft-Delete via Papierkorb. Leads mit trashed_at != null werden im Board/List
-- ausgeblendet und auf /papierkorb gelistet (mit „Wiederherstellen" + „Endgültig löschen").
alter table public.leads add column if not exists trashed_at timestamptz;

create index if not exists leads_trashed_idx on public.leads(trashed_at)
  where trashed_at is not null;
