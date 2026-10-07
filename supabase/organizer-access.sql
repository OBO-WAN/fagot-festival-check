-- Run once in Supabase SQL Editor, then bind your Auth user in organizer-setup.md.
-- Safe to rerun: the single account binding is preserved.
begin;

-- Unexpected policies must be reviewed instead of silently widening access.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'festival_intake'
      and cmd in ('SELECT', 'ALL', 'UPDATE', 'DELETE')
      and policyname <> 'Organizer may read intake'
  ) then
    raise exception 'Unexpected festival_intake policies found. Review them before enabling organizer access.';
  end if;
end;
$$;

create schema if not exists festival_private;
revoke all on schema festival_private from public, anon, authenticated;
grant usage on schema festival_private to authenticated;

create table if not exists festival_private.organizer_account (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table festival_private.organizer_account enable row level security;
revoke all on festival_private.organizer_account from public, anon, authenticated;

-- Only this private function uses elevated privileges; it returns a boolean,
-- not account details or response data. Keep festival_private unexposed.
create or replace function festival_private.is_organizer()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from festival_private.organizer_account
    where user_id = (select auth.uid())
  );
$$;
revoke all on function festival_private.is_organizer() from public, anon, authenticated;
grant execute on function festival_private.is_organizer() to authenticated;

-- The public RPC runs with the caller's permissions and exposes no user IDs.
create or replace function public.festival_organizer_access()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select festival_private.is_organizer(); $$;
revoke all on function public.festival_organizer_access() from public, anon, authenticated;
grant execute on function public.festival_organizer_access() to authenticated;

alter table public.festival_intake enable row level security;
revoke all on public.festival_intake from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant insert (name, email, bassoon_system, instrument_model, ownership, accessories, accessory_details, issues, issue_description, playability)
  on public.festival_intake to anon;
grant select on public.festival_intake to authenticated;

drop policy if exists "Organizer may read intake" on public.festival_intake;
create policy "Organizer may read intake" on public.festival_intake
  for select to authenticated using ((select festival_private.is_organizer()));

commit;
