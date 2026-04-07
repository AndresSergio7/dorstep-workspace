-- Change attendees column from array to text in meetings table
-- This fixes the "malformed array literal" error

-- First, convert existing array data to comma-separated text
update public.meetings
set attendees = array_to_string(attendees, ', ')
where attendees is not null and cardinality(attendees) > 0;

-- Then alter the column type
alter table public.meetings
alter column attendees type text using array_to_string(attendees, ', ');

-- Add comment
comment on column public.meetings.attendees is 'Lista de asistentes separados por coma';
