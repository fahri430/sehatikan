-- Admin authorization comes only from trusted Supabase app_metadata, never user-editable metadata.
create table if not exists public.disease_records (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default 'Semua spesies',
  cause text not null default '',
  symptoms text not null default '',
  treatment text not null default '',
  status text not null default 'draft' check (status in ('draft','published','review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.disease_records enable row level security;
drop policy if exists "Admins manage disease records" on public.disease_records;
create policy "Admins manage disease records" on public.disease_records for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
grant select, insert, update, delete on public.disease_records to authenticated;

drop policy if exists "Admins manage expert verification" on public.expert_profiles;
create policy "Admins manage expert verification" on public.expert_profiles for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
grant select, update on public.expert_profiles to authenticated;
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
drop policy if exists "Admins read consultations" on public.consultations;
create policy "Admins read consultations" on public.consultations for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
grant select on public.profiles, public.consultations to authenticated;
notify pgrst, 'reload schema';
