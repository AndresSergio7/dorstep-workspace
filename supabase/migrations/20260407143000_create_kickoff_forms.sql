create table if not exists public.kickoff_forms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null default 'Kickoff de descubrimiento',
  status text not null default 'draft' check (status in ('draft', 'completed')),
  meeting_date date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_kickoff_forms_client_id on public.kickoff_forms(client_id);
create index if not exists idx_kickoff_forms_status on public.kickoff_forms(status);
create index if not exists idx_kickoff_forms_updated_at on public.kickoff_forms(updated_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists kickoff_forms_set_updated_at on public.kickoff_forms;
create trigger kickoff_forms_set_updated_at
before update on public.kickoff_forms
for each row execute function public.set_updated_at();
