-- Run once in the Supabase SQL Editor for a fresh project.
create table public.festival_intake (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  bassoon_system text not null check (bassoon_system in ('German', 'French', 'Unsure')),
  instrument_model text not null default '' check (char_length(instrument_model) <= 160),
  ownership text not null check (ownership in ('Own', 'Borrowed', 'School', 'Other')),
  accessories jsonb not null default '[]'::jsonb check (jsonb_typeof(accessories) = 'array' and jsonb_array_length(accessories) <= 12),
  accessory_details text not null default '' check (char_length(accessory_details) <= 500),
  issues text[] not null default '{}',
  issue_description text not null default '' check (char_length(issue_description) <= 2000),
  playability text not null check (playability in ('Yes', 'With difficulty', 'No'))
);

create index festival_intake_created_at_idx on public.festival_intake (created_at desc);
alter table public.festival_intake enable row level security;

-- A visitor can submit the listed fields, but cannot read or edit submissions.
revoke all on public.festival_intake from anon, authenticated;
grant usage on schema public to anon;
grant insert (name, email, bassoon_system, instrument_model, ownership, accessories, accessory_details, issues, issue_description, playability)
  on public.festival_intake to anon;
create policy "Visitors may submit intake" on public.festival_intake
  for insert to anon with check (true);
