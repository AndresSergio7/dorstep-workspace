-- Add priority and due_date columns to action_items
alter table public.action_items
add column if not exists priority text check (priority in ('baja', 'media', 'alta')),
add column if not exists due_date date;

-- Add index for filtering by due date
create index if not exists idx_action_items_due_date on public.action_items(due_date);

-- Add index for filtering by priority
create index if not exists idx_action_items_priority on public.action_items(priority);

-- Add comments
comment on column public.action_items.priority is 'Nivel de prioridad: baja, media, alta';
comment on column public.action_items.due_date is 'Fecha de entrega del pendiente';
