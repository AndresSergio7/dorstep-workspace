-- Columna de estado tipo Kanban (To Do / In progress / Done).
-- Ejecuta este SQL en Supabase → SQL Editor si no usas migraciones por CLI.

alter table action_items
  add column if not exists status text not null default 'todo'
  check (status in ('todo', 'in_progress', 'done'));

update action_items
set status = case when done then 'done' else 'todo' end
where true;

comment on column action_items.status is 'Kanban: todo | in_progress | done (sincronizar con done)';
