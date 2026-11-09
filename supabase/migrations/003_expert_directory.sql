-- Public expert directory linked to real SehatiKan accounts.
create table if not exists public.expert_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  specialty text not null default 'Kesehatan Ikan',
  bio text not null default 'Ahli kesehatan ikan air tawar.',
  experience_years integer check (experience_years is null or experience_years >= 0),
  consultation_fee integer check (consultation_fee is null or consultation_fee >= 0),
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  is_verified boolean not null default false,
  accepting_consultations boolean not null default true,
  availability jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_profiles enable row level security;
drop policy if exists "Directory is readable" on public.expert_profiles;
create policy "Directory is readable" on public.expert_profiles
  for select to anon, authenticated using (true);
drop policy if exists "Experts update their own directory profile" on public.expert_profiles;
create policy "Experts update their own directory profile" on public.expert_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select on public.expert_profiles to anon, authenticated;
grant update on public.expert_profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  account_type text := coalesce(new.raw_user_meta_data ->> 'user_type', 'beginner');
  account_name text := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, full_name, user_type)
  values (new.id, account_name, account_type)
  on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;

  if account_type = 'expert' then
    insert into public.expert_profiles (user_id, full_name, specialty)
    values (new.id, account_name, coalesce(new.raw_user_meta_data ->> 'specialty', 'Kesehatan Ikan'))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Backfill users who registered as experts before this directory existed.
update public.profiles p
set user_type = 'expert'
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data ->> 'user_type' = 'expert';

insert into public.expert_profiles (user_id, full_name, specialty)
select p.id,
       coalesce(p.full_name, split_part(u.email, '@', 1)),
       coalesce(u.raw_user_meta_data ->> 'specialty', 'Kesehatan Ikan')
from public.profiles p
join auth.users u on u.id = p.id
where u.raw_user_meta_data ->> 'user_type' = 'expert'
on conflict (user_id) do nothing;
