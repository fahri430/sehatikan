-- Repair the public expert directory and add persistent AI conversations.
-- Safe to run after migrations 001-004, even when migration 003 was missed.

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check
  check (user_type in ('hobbyist', 'farmer', 'beginner', 'expert'));

create table if not exists public.expert_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text not null,
  specialty text not null default 'Kesehatan Ikan',
  bio text not null default 'Ahli kesehatan ikan air tawar.',
  qualification text not null default '',
  experience_years integer check (experience_years is null or experience_years >= 0),
  consultation_fee integer check (consultation_fee is null or consultation_fee >= 0),
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  is_verified boolean not null default false,
  accepting_consultations boolean not null default true,
  availability jsonb not null default '{"slots":["09:00","10:00","11:00","13:00","14:00","15:00"],"days":[1,2,3,4,5,6]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_profiles add column if not exists qualification text not null default '';
alter table public.expert_profiles add column if not exists availability jsonb not null default '{"slots":["09:00","10:00","11:00","13:00","14:00","15:00"],"days":[1,2,3,4,5,6]}'::jsonb;
update public.expert_profiles set availability = '{"slots":["09:00","10:00","11:00","13:00","14:00","15:00"],"days":[1,2,3,4,5,6]}'::jsonb where availability = '[]'::jsonb;
alter table public.expert_profiles enable row level security;
drop policy if exists "Directory is readable" on public.expert_profiles;
create policy "Directory is readable" on public.expert_profiles for select to anon, authenticated using (true);
drop policy if exists "Experts update their own directory profile" on public.expert_profiles;
create policy "Experts update their own directory profile" on public.expert_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.expert_profiles to anon, authenticated;
revoke update on public.expert_profiles from authenticated;
grant update (full_name, specialty, bio, qualification, experience_years, consultation_fee, accepting_consultations, availability, updated_at)
  on public.expert_profiles to authenticated;

create or replace function public.ensure_expert_directory_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_type = 'expert' then
    insert into public.expert_profiles (user_id, full_name, specialty, bio, qualification, experience_years)
    values (
      new.id,
      coalesce(nullif(new.full_name, ''), 'Ahli SehatiKan'),
      coalesce(nullif((select u.raw_user_meta_data ->> 'specialty' from auth.users u where u.id = new.id), ''), 'Kesehatan Ikan'),
      coalesce(nullif((select u.raw_user_meta_data ->> 'bio' from auth.users u where u.id = new.id), ''), 'Ahli kesehatan ikan air tawar.'),
      coalesce((select u.raw_user_meta_data ->> 'qualification' from auth.users u where u.id = new.id), ''),
      case when (select u.raw_user_meta_data ->> 'experience_years' from auth.users u where u.id = new.id) ~ '^[0-9]{1,3}$'
        then ((select u.raw_user_meta_data ->> 'experience_years' from auth.users u where u.id = new.id))::integer else null end
    )
    on conflict (user_id) do update set full_name = excluded.full_name, updated_at = now();
  else
    update public.expert_profiles set accepting_consultations = false, updated_at = now() where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_expert_directory_profile on public.profiles;
create trigger sync_expert_directory_profile after insert or update of user_type, full_name on public.profiles
  for each row execute function public.ensure_expert_directory_profile();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  account_type text := coalesce(new.raw_user_meta_data ->> 'user_type', 'beginner');
  account_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, full_name, user_type)
  values (new.id, account_name, account_type)
  on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing accounts with expert role metadata are added without manual re-registration.
insert into public.profiles (id, full_name, user_type)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)), 'expert'
from auth.users u where u.raw_user_meta_data ->> 'user_type' = 'expert'
on conflict (id) do update set user_type = 'expert', full_name = coalesce(excluded.full_name, public.profiles.full_name);

insert into public.expert_profiles (user_id, full_name, specialty, bio, qualification, experience_years)
select p.id,
       coalesce(nullif(p.full_name, ''), 'Ahli SehatiKan'),
       coalesce(nullif(u.raw_user_meta_data ->> 'specialty', ''), 'Kesehatan Ikan'),
       coalesce(nullif(u.raw_user_meta_data ->> 'bio', ''), 'Ahli kesehatan ikan air tawar.'),
       coalesce(u.raw_user_meta_data ->> 'qualification', ''),
       case when u.raw_user_meta_data ->> 'experience_years' ~ '^[0-9]{1,3}$' then (u.raw_user_meta_data ->> 'experience_years')::integer else null end
from public.profiles p join auth.users u on u.id = p.id
where p.user_type = 'expert' or u.raw_user_meta_data ->> 'user_type' = 'expert'
on conflict (user_id) do update set full_name = excluded.full_name, updated_at = now();

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Konsultasi ikan baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_updated_idx on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 5000),
  image_path text,
  image_name text,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages(conversation_id, created_at);
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
drop policy if exists "Users manage own AI conversations" on public.ai_conversations;
create policy "Users manage own AI conversations" on public.ai_conversations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own AI messages" on public.ai_messages;
create policy "Users manage own AI messages" on public.ai_messages for all to authenticated
  using ((select auth.uid()) = user_id and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check ((select auth.uid()) = user_id and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, delete on public.ai_messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-chat-attachments', 'ai-chat-attachments', false, 6000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 6000000, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "Users access own AI chat images" on storage.objects;
create policy "Users access own AI chat images" on storage.objects for select to authenticated
  using (bucket_id = 'ai-chat-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users upload own AI chat images" on storage.objects;
create policy "Users upload own AI chat images" on storage.objects for insert to authenticated
  with check (bucket_id = 'ai-chat-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete own AI chat images" on storage.objects;
create policy "Users delete own AI chat images" on storage.objects for delete to authenticated
  using (bucket_id = 'ai-chat-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Make PostgREST pick up the tables and policies immediately after the migration.
notify pgrst, 'reload schema';
