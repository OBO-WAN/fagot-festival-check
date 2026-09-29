-- Ejecuta este archivo solo si ya creaste festival_intake con la versión anterior del esquema.
begin;

alter table public.festival_intake
  drop constraint if exists festival_intake_bassoon_system_check,
  drop constraint if exists festival_intake_ownership_check,
  drop constraint if exists festival_intake_playability_check;

update public.festival_intake
set bassoon_system = case bassoon_system
      when 'German' then 'Alemán (Heckel)'
      when 'French' then 'Francés (Buffet)'
      when 'Unsure' then 'No lo sé'
      else bassoon_system end,
    ownership = case ownership
      when 'Own' then 'Es mío'
      when 'Borrowed' then 'Me lo han prestado'
      when 'School' then 'Es de mi escuela o conservatorio'
      when 'Other' then 'Otro caso'
      else ownership end,
    playability = case playability
      when 'Yes' then 'Sí'
      when 'With difficulty' then 'Con dificultad'
      else playability end;

alter table public.festival_intake
  add constraint festival_intake_bassoon_system_check
    check (bassoon_system in ('Alemán (Heckel)', 'Francés (Buffet)', 'No lo sé')),
  add constraint festival_intake_ownership_check
    check (ownership in ('Es mío', 'Me lo han prestado', 'Es de mi escuela o conservatorio', 'Otro caso')),
  add constraint festival_intake_playability_check
    check (playability in ('Sí', 'Con dificultad', 'No'));

commit;
