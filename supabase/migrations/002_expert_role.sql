-- Allow users to register as an expert role.
alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check
  check (user_type in ('hobbyist', 'farmer', 'beginner', 'expert'));

-- Backfill accounts created in Supabase Auth before the public profile table existed.
insert into public.profiles (id, full_name, user_type)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
       case when u.raw_user_meta_data ->> 'user_type' in ('hobbyist','farmer','beginner','expert')
         then u.raw_user_meta_data ->> 'user_type' else 'beginner' end
from auth.users u
on conflict (id) do update set
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  user_type = excluded.user_type;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, user_type)
  values (new.id, new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'user_type', 'beginner'));
  return new;
end;
$$;
