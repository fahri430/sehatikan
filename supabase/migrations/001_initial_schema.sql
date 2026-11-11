-- Profil dibuat otomatis ketika pengguna baru mendaftar melalui Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  user_type text check (user_type in ('hobbyist', 'farmer', 'beginner')) default 'beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
grant select, update on public.profiles to authenticated;

create table if not exists public.fish_tanks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  tank_type text,
  volume_liters numeric(12, 2) check (volume_liters is null or volume_liters > 0),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fish_tanks enable row level security;
drop policy if exists "Users can view their own tanks" on public.fish_tanks;
create policy "Users can view their own tanks" on public.fish_tanks
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can add their own tanks" on public.fish_tanks;
create policy "Users can add their own tanks" on public.fish_tanks
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own tanks" on public.fish_tanks;
create policy "Users can update their own tanks" on public.fish_tanks
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own tanks" on public.fish_tanks;
create policy "Users can delete their own tanks" on public.fish_tanks
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.fish_tanks to authenticated;
