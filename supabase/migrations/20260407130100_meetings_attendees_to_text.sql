-- Change attendees column from array to text in meetings table
-- This fixes the "malformed array literal" error

-- Alter the column type directly with USING clause to convert data
alter table public.meetings
alter column attendees type text using array_to_string(attendees, ', ');

-- Add comment
comment on column public.meetings.attendees is 'Lista de asistentes separados por coma';
