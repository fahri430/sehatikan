-- ===== 001_initial_schema.sql =====
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

-- ===== 002_expert_role.sql =====
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

-- ===== 003_expert_directory.sql =====
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

-- ===== 004_live_consultations.sql =====
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expert_user_id uuid not null references public.expert_profiles(user_id) on delete restrict,
  fish_context jsonb not null default '{}'::jsonb,
  complaint text not null,
  scheduled_for text,
  started_at text,
  affected_count text,
  status text not null default 'active' check (status in ('scheduled','active','completed')),
  final_recommendation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultations_user_created_idx on public.consultations(user_id, created_at desc);
create index if not exists consultations_expert_created_idx on public.consultations(expert_user_id, created_at desc);

create table if not exists public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user','expert')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists consultation_messages_conversation_idx on public.consultation_messages(consultation_id, created_at);
alter table public.consultations enable row level security;
alter table public.consultation_messages enable row level security;

drop policy if exists "Participants can read consultations" on public.consultations;
create policy "Participants can read consultations" on public.consultations for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = expert_user_id);
drop policy if exists "Users can create consultations with available experts" on public.consultations;
create policy "Users can create consultations with available experts" on public.consultations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.expert_profiles e where e.user_id = expert_user_id and e.is_verified and e.accepting_consultations)
  );
drop policy if exists "Experts can update consultation recommendations" on public.consultations;
create policy "Experts can update consultation recommendations" on public.consultations for update to authenticated
  using ((select auth.uid()) = expert_user_id)
  with check ((select auth.uid()) = expert_user_id);

drop policy if exists "Participants can read consultation messages" on public.consultation_messages;
create policy "Participants can read consultation messages" on public.consultation_messages for select to authenticated
  using (exists (select 1 from public.consultations c where c.id = consultation_id and ((select auth.uid()) = c.user_id or (select auth.uid()) = c.expert_user_id)));
drop policy if exists "Participants can send consultation messages" on public.consultation_messages;
create policy "Participants can send consultation messages" on public.consultation_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.consultations c where c.id = consultation_id and c.status <> 'completed'
        and ((c.user_id = (select auth.uid()) and sender_role = 'user') or (c.expert_user_id = (select auth.uid()) and sender_role = 'expert'))
    )
  );

grant select, insert on public.consultations to authenticated;
grant update (status, final_recommendation, updated_at) on public.consultations to authenticated;
grant select, insert on public.consultation_messages to authenticated;

-- Experts may see only the display name of users who have a consultation with them.
drop policy if exists "Experts can read consultation participant names" on public.profiles;
create policy "Experts can read consultation participant names" on public.profiles for select to authenticated
  using (exists (select 1 from public.consultations c where c.user_id = profiles.id and c.expert_user_id = (select auth.uid())));
grant select on public.profiles to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'consultation_messages') then
    alter publication supabase_realtime add table public.consultation_messages;
  end if;
end $$;

-- ===== 005_expert_directory_and_ai_history.sql =====
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

-- ===== 006_admin_console.sql =====
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

-- ===== 007_chat_payments_notifications_content.sql =====
-- Consultation media, notifications, provider payments, reviews, articles and comments.
alter table public.consultation_messages add column if not exists image_path text;
alter table public.consultation_messages add column if not exists image_name text;
alter table public.consultation_messages drop constraint if exists consultation_messages_body_check;
alter table public.consultation_messages drop constraint if exists consultation_messages_body_or_image_check;
alter table public.consultation_messages add constraint consultation_messages_body_or_image_check
  check (char_length(body) between 0 and 5000 and (char_length(body) > 0 or image_path is not null));
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.expert_profiles add column if not exists avatar_path text;
create or replace function public.prevent_self_role_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.user_type is distinct from old.user_type and (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then
   raise exception 'Jenis akun hanya dapat diubah oleh administrator.' using errcode='42501';
 end if;
 return new;
end; $$;
drop trigger if exists profiles_prevent_self_role_change on public.profiles;
create trigger profiles_prevent_self_role_change before update of user_type on public.profiles for each row execute function public.prevent_self_role_change();
alter table public.consultations add column if not exists payment_status text not null default 'paid';
alter table public.consultations drop constraint if exists consultations_payment_status_check;
alter table public.consultations add constraint consultations_payment_status_check check (payment_status in ('unpaid','pending','paid','refunded'));
update public.consultations set payment_status='paid' where payment_status is null;
alter table public.consultations alter column payment_status set default 'pending';
alter table public.consultations add column if not exists locked_fee integer not null default 0 check (locked_fee >= 0);
alter table public.consultations add column if not exists closed_at timestamptz;
alter table public.consultations add column if not exists rating smallint check (rating between 1 and 5);
alter table public.consultations add column if not exists review_comment text;
alter table public.consultations add column if not exists tip_amount integer not null default 0 check (tip_amount >= 0);
update public.consultations c set locked_fee=coalesce(e.consultation_fee,0) from public.expert_profiles e where e.user_id=c.expert_user_id and c.locked_fee=0;
create or replace function public.lock_consultation_fee() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 select coalesce(consultation_fee,0) into new.locked_fee from public.expert_profiles where user_id=new.expert_user_id;
 new.payment_status:='pending';
 return new;
end; $$;
drop trigger if exists consultation_fee_snapshot on public.consultations;
create trigger consultation_fee_snapshot before insert on public.consultations for each row execute function public.lock_consultation_fee();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete restrict,
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  expert_user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'midtrans',
  payment_kind text not null default 'consultation' check (payment_kind in ('consultation','tip')),
  provider_order_id text not null unique,
  provider_transaction_id text,
  amount integer not null check (amount > 0),
  tip_amount integer not null default 0 check (tip_amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refunded')),
  payment_method text,
  checkout_url text,
  snap_token text,
  invoice_number text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_payer_created_idx on public.payments(payer_user_id, created_at desc);
create index if not exists payments_expert_created_idx on public.payments(expert_user_id, created_at desc);
alter table public.payments enable row level security;
drop policy if exists "Consultation participants read payments" on public.payments;
create policy "Consultation participants read payments" on public.payments for select to authenticated
  using (payer_user_id = (select auth.uid()) or expert_user_id = (select auth.uid()) or (auth.jwt()->'app_metadata'->>'role') = 'admin');
grant select on public.payments to authenticated;

-- Client booking can never set payment_status or fee; only a verified server webhook can.
revoke insert on public.consultations from authenticated;
grant insert (user_id,expert_user_id,complaint,started_at,affected_count,scheduled_for,fish_context) on public.consultations to authenticated;
drop policy if exists "Only paid sessions can complete" on public.consultations;
create policy "Only paid sessions can complete" on public.consultations as restrictive for update to authenticated
  using (true) with check (status <> 'completed' or payment_status='paid');
drop policy if exists "Only paid sessions allow messages" on public.consultation_messages;
drop policy if exists "Only paid or postpay sessions allow messages" on public.consultation_messages;
create policy "Only paid sessions allow messages" on public.consultation_messages as restrictive for insert to authenticated
  with check (exists(select 1 from public.consultations c where c.id=consultation_id and c.payment_status='paid' and c.status <> 'completed'));

create table if not exists public.expert_reviews (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expert_user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  tip_amount integer not null default 0 check (tip_amount >= 0),
  created_at timestamptz not null default now()
);
alter table public.expert_reviews enable row level security;
drop policy if exists "Reviews visible to signed in users" on public.expert_reviews;
create policy "Reviews visible to signed in users" on public.expert_reviews for select to authenticated using (true);
drop policy if exists "Users review completed paid consultations" on public.expert_reviews;
create policy "Users review completed paid consultations" on public.expert_reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.consultations c where c.id=consultation_id and c.user_id=(select auth.uid()) and c.expert_user_id=expert_user_id and c.status='completed' and c.payment_status='paid'));
grant select, insert on public.expert_reviews to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read" on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select, update on public.notifications to authenticated;

create table if not exists public.user_reports(
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  reason text not null check(char_length(reason) between 5 and 2000),
  status text not null default 'pending' check(status in ('pending','resolved','dismissed')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.user_reports enable row level security;
drop policy if exists "Users create report as consultation participant" on public.user_reports;
create policy "Users create report as consultation participant" on public.user_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and exists(select 1 from public.consultations c where c.id=consultation_id and (c.user_id=(select auth.uid()) or c.expert_user_id=(select auth.uid())) and subject_id in (c.user_id,c.expert_user_id)));
drop policy if exists "Admins manage reports" on public.user_reports;
create policy "Admins manage reports" on public.user_reports for all to authenticated using((auth.jwt()->'app_metadata'->>'role')='admin') with check((auth.jwt()->'app_metadata'->>'role')='admin');
grant insert on public.user_reports to authenticated;
grant select,update on public.user_reports to authenticated;

create or replace function public.notify_consultation_message() returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.consultations%rowtype; recipient uuid;
begin
 select * into c from public.consultations where id=new.consultation_id;
 recipient := case when new.sender_id=c.user_id then c.expert_user_id else c.user_id end;
 insert into public.notifications(user_id,kind,title,body,href) values(recipient,'chat_reply','Pesan konsultasi baru',left(new.body,160),case when recipient=c.user_id then '/konsultasi/chat/'||c.id::text else '/ahli/percakapan/'||c.id::text end);
 return new;
end; $$;
drop trigger if exists consultation_message_notification on public.consultation_messages;
create trigger consultation_message_notification after insert on public.consultation_messages for each row execute function public.notify_consultation_message();

create or replace function public.notify_consultation_created() returns trigger language plpgsql security definer set search_path = '' as $$
declare n text;
begin
 select full_name into n from public.profiles where id=new.user_id;
 insert into public.notifications(user_id,kind,title,body,href) values(new.expert_user_id,'consultation_request','Permintaan konsultasi baru',coalesce(n,'Pengguna')||' mengirim konsultasi baru.','/ahli/tiket/'||new.id::text);
 return new;
end; $$;
drop trigger if exists consultation_created_notification on public.consultations;
create trigger consultation_created_notification after insert on public.consultations for each row execute function public.notify_consultation_created();

create or replace function public.notify_consultation_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status is distinct from old.status then
   insert into public.notifications(user_id,kind,title,body,href) values(new.user_id,'consultation_status','Status konsultasi diperbarui','Status konsultasi Anda: '||new.status||'.','/konsultasi/chat/'||new.id::text);
 end if;
 return new;
end; $$;
drop trigger if exists consultation_status_notification on public.consultations;
create trigger consultation_status_notification after update of status on public.consultations for each row execute function public.notify_consultation_status();

create or replace function public.notify_expert_profile_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.is_verified is distinct from old.is_verified then
   insert into public.notifications(user_id,kind,title,body,href) values(new.user_id,'expert_verification',case when new.is_verified then 'Profil ahli telah diverifikasi' else 'Status verifikasi ahli berubah' end,case when new.is_verified then 'Profil Anda sudah dapat menerima pemesanan jika jadwal aktif.' else 'Silakan cek kembali kelengkapan data profil.' end,'/ahli/profil');
 elsif new.accepting_consultations is distinct from old.accepting_consultations then
   insert into public.notifications(user_id,kind,title,body,href) values(new.user_id,'expert_status',case when new.accepting_consultations then 'Konsultasi diaktifkan' else 'Konsultasi dinonaktifkan' end,case when new.accepting_consultations then 'Profil Anda dapat menerima konsultasi baru.' else 'Profil Anda sementara tidak menerima konsultasi baru.' end,'/ahli/profil');
 end if;
 return new;
end; $$;
drop trigger if exists expert_profile_notification on public.expert_profiles;
create trigger expert_profile_notification after update of is_verified,accepting_consultations on public.expert_profiles for each row execute function public.notify_expert_profile_change();

create or replace function public.notify_payment_settled() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status in ('paid','refunded') and old.status is distinct from new.status then
   if new.payment_kind='consultation' then update public.consultations set payment_status=new.status,locked_fee=new.amount,updated_at=now() where id=new.consultation_id; end if;
   if new.payment_kind='tip' and new.status='paid' then update public.expert_reviews set tip_amount=tip_amount+new.amount where consultation_id=new.consultation_id; end if;
   insert into public.notifications(user_id,kind,title,body,href) values(new.payer_user_id,'payment_status',case when new.payment_kind='tip' then 'Terima kasih atas tip Anda' when new.status='paid' then 'Pembayaran berhasil' else 'Pembayaran dikembalikan' end,'Status transaksi: '||new.status||'.','/pembayaran/'||new.consultation_id::text);
   insert into public.notifications(user_id,kind,title,body,href) values(new.expert_user_id,'payment_status',case when new.payment_kind='tip' then 'Anda menerima tip' when new.status='paid' then 'Pembayaran konsultasi diterima' else 'Pembayaran konsultasi dikembalikan' end,'Status transaksi: '||new.status||'.','/ahli/percakapan/'||new.consultation_id::text);
 end if;
 return new;
end; $$;
drop trigger if exists payment_settled_notification on public.payments;
create trigger payment_settled_notification after update of status on public.payments for each row execute function public.notify_payment_settled();

create or replace function public.refresh_expert_review_score() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.expert_profiles set rating=(select round(avg(rating)::numeric,1) from public.expert_reviews where expert_user_id=new.expert_user_id),review_count=(select count(*) from public.expert_reviews where expert_user_id=new.expert_user_id),updated_at=now() where user_id=new.expert_user_id;
 update public.expert_reviews set tip_amount=(select coalesce(sum(amount),0) from public.payments where consultation_id=new.consultation_id and payment_kind='tip' and status='paid') where id=new.id;
 insert into public.notifications(user_id,kind,title,body,href) values(new.expert_user_id,'expert_review','Ulasan baru diterima',new.rating::text||' bintang · '||left(new.comment,120),'/ahli/profil');
 return new;
end; $$;
drop trigger if exists expert_review_score_refresh on public.expert_reviews;
create trigger expert_review_score_refresh after insert on public.expert_reviews for each row execute function public.refresh_expert_review_score();

create or replace function public.notify_admin_report() returns trigger language plpgsql security definer set search_path = '' as $$
declare admin_id uuid;
begin
 for admin_id in select id from auth.users where raw_app_meta_data->>'role'='admin' loop
   insert into public.notifications(user_id,kind,title,body,href) values(admin_id,'user_report','Laporan pengguna baru',left(new.reason,140),'/admin/pengguna');
 end loop;
 return new;
end; $$;
drop trigger if exists user_report_admin_notification on public.user_reports;
create trigger user_report_admin_notification after insert on public.user_reports for each row execute function public.notify_admin_report();

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'Kesehatan ikan',
  excerpt text not null default '',
  body text not null default '',
  image_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles enable row level security;
drop policy if exists "Published articles readable" on public.articles;
create policy "Published articles readable" on public.articles for select to anon,authenticated using (status='published' or (auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins manage articles" on public.articles;
create policy "Admins manage articles" on public.articles for all to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin') with check ((auth.jwt()->'app_metadata'->>'role')='admin');
grant select on public.articles to anon,authenticated;
grant insert,update,delete on public.articles to authenticated;

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
alter table public.article_comments enable row level security;
drop policy if exists "Published article comments readable" on public.article_comments;
create policy "Published article comments readable" on public.article_comments for select to anon,authenticated using (exists(select 1 from public.articles a where a.id=article_id and a.status='published'));
drop policy if exists "Only non expert users comment articles" on public.article_comments;
create policy "Only non expert users comment articles" on public.article_comments for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.user_type <> 'expert') and exists(select 1 from public.articles a where a.id=article_id and a.status='published'));
drop policy if exists "Users delete own comments or admin" on public.article_comments;
create policy "Users delete own comments or admin" on public.article_comments for delete to authenticated using (user_id=(select auth.uid()) or (auth.jwt()->'app_metadata'->>'role')='admin');
grant select,insert,delete on public.article_comments to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('consultation-images','consultation-images',false,6000000,array['image/jpeg','image/png','image/webp']),('profile-avatars','profile-avatars',false,4000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false;
drop policy if exists "Participants read consultation images" on storage.objects;
create policy "Participants read consultation images" on storage.objects for select to authenticated using(bucket_id='consultation-images' and exists(select 1 from public.consultations c where c.id=((storage.foldername(name))[1])::uuid and (c.user_id=(select auth.uid()) or c.expert_user_id=(select auth.uid()) or (auth.jwt()->'app_metadata'->>'role')='admin')));
drop policy if exists "Participants upload consultation images" on storage.objects;
create policy "Participants upload consultation images" on storage.objects for insert to authenticated with check(bucket_id='consultation-images' and exists(select 1 from public.consultations c where c.id=((storage.foldername(name))[1])::uuid and c.status <> 'completed' and (c.user_id=(select auth.uid()) or c.expert_user_id=(select auth.uid()))));
drop policy if exists "Users access own avatar" on storage.objects;
create policy "Users access own avatar" on storage.objects for all to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Chat participants read avatars" on storage.objects;
create policy "Chat participants read avatars" on storage.objects for select to authenticated using(bucket_id='profile-avatars' and exists(select 1 from public.consultations c where ((storage.foldername(name))[1]=c.user_id::text and c.expert_user_id=(select auth.uid())) or ((storage.foldername(name))[1]=c.expert_user_id::text and c.user_id=(select auth.uid()))));

-- Preserve existing sessions; admin can inspect transactions and conversations for support.
drop policy if exists "Admins read payments" on public.payments;
create policy "Admins read payments" on public.payments for select to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins read consultation messages" on public.consultation_messages;
create policy "Admins read consultation messages" on public.consultation_messages for select to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');
grant select on public.consultation_messages to authenticated;
notify pgrst, 'reload schema';

-- ===== 008_payment_timing_and_session_close.sql =====
-- Let the customer choose whether to pay before or after the consultation.
alter table public.consultations
  add column if not exists payment_timing text not null default 'before',
  add column if not exists completion_requested boolean not null default false;
alter table public.consultations drop constraint if exists consultations_payment_timing_check;
alter table public.consultations add constraint consultations_payment_timing_check
  check (payment_timing in ('before','after'));

create or replace function public.lock_consultation_fee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(consultation_fee,0) into new.locked_fee
  from public.expert_profiles where user_id=new.expert_user_id;
  if new.payment_timing='after' then new.payment_status:='unpaid';
  else new.payment_status:='pending'; end if;
  new.completion_requested:=false;
  return new;
end; $$;
drop trigger if exists consultation_fee_snapshot on public.consultations;
create trigger consultation_fee_snapshot before insert on public.consultations
for each row execute function public.lock_consultation_fee();

revoke insert on public.consultations from authenticated;
grant insert (user_id,expert_user_id,complaint,started_at,affected_count,scheduled_for,fish_context,payment_timing)
  on public.consultations to authenticated;
grant update (status,final_recommendation,updated_at,completion_requested)
  on public.consultations to authenticated;

drop policy if exists "Only paid sessions allow messages" on public.consultation_messages;
drop policy if exists "Only paid or postpay sessions allow messages" on public.consultation_messages;
create policy "Only paid or postpay sessions allow messages" on public.consultation_messages
  as restrictive for insert to authenticated with check (
    exists(select 1 from public.consultations c where c.id=consultation_id
      and (c.payment_status='paid' or c.payment_timing='after') and c.status <> 'completed')
  );

create or replace function public.notify_payment_first_close_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.completion_requested is true and old.completion_requested is distinct from true then
    insert into public.notifications(user_id,kind,title,body,href)
      values(new.user_id,'payment_due','Konsultasi selesai, pembayaran diperlukan',
        'Ahli menandai konsultasi siap ditutup. Selesaikan pembayaran agar sesi dapat ditutup.','/pembayaran/'||new.id::text);
  end if;
  return new;
end; $$;
drop trigger if exists consultation_completion_payment_notice on public.consultations;
create trigger consultation_completion_payment_notice after update of completion_requested
on public.consultations for each row execute function public.notify_payment_first_close_request();

notify pgrst, 'reload schema';

-- ===== 009_article_relations_notification_roles.sql =====
insert into public.profiles (id, full_name, user_type)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
       case when u.raw_user_meta_data ->> 'user_type' in ('hobbyist','farmer','beginner','expert')
         then u.raw_user_meta_data ->> 'user_type' else 'beginner' end
from auth.users u
join public.article_comments c on c.user_id = u.id
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.article_comments'::regclass
      and conname = 'article_comments_profile_id_fkey'
  ) then
    alter table public.article_comments
      add constraint article_comments_profile_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade not valid;
  end if;
end;
$$;
alter table public.article_comments validate constraint article_comments_profile_id_fkey;

drop policy if exists "Admins read all article comments" on public.article_comments;
create policy "Admins read all article comments" on public.article_comments
  for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
revoke insert, delete on public.article_comments from anon;
grant select on public.article_comments to anon, authenticated;
grant insert, delete on public.article_comments to authenticated;

revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.validate_notification_recipient()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_id uuid;
  valid_recipient boolean := false;
begin
  if new.href ~ '^/(ahli/tiket|konsultasi/chat|ahli/percakapan|pembayaran)/[0-9a-fA-F-]{36}$' then
    source_id := substring(new.href from '([0-9a-fA-F-]{36})$')::uuid;
  end if;

  if new.kind = 'user_report' then
    select exists (
      select 1 from auth.users u
      where u.id = new.user_id and u.raw_app_meta_data ->> 'role' = 'admin'
    ) into valid_recipient;
  elsif new.kind in ('consultation_request','expert_verification','expert_status','expert_review') then
    select exists (
      select 1 from public.profiles p
      join public.expert_profiles e on e.user_id = p.id
      where p.id = new.user_id and p.user_type = 'expert'
    ) into valid_recipient;
    if valid_recipient and new.kind = 'consultation_request' then
      select exists (
        select 1 from public.consultations c
        where c.id = source_id and c.expert_user_id = new.user_id
      ) into valid_recipient;
    end if;
  elsif new.kind in ('consultation_status','payment_due') then
    select exists (
      select 1 from public.consultations c
      where c.id = source_id and c.user_id = new.user_id
    ) into valid_recipient;
  elsif new.kind = 'chat_reply' then
    select exists (
      select 1 from public.consultations c
      where c.id = source_id
        and (
          (new.href like '/konsultasi/chat/%' and c.user_id = new.user_id)
          or (new.href like '/ahli/percakapan/%' and c.expert_user_id = new.user_id)
        )
    ) into valid_recipient;
  elsif new.kind = 'payment_status' then
    select exists (
      select 1 from public.payments p
      where p.consultation_id = source_id
        and new.user_id in (p.payer_user_id, p.expert_user_id)
    ) into valid_recipient;
  else
    valid_recipient := false;
  end if;

  if not valid_recipient then
    raise exception 'Penerima tidak sesuai dengan jenis notifikasi.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_validate_recipient on public.notifications;
create trigger notifications_validate_recipient
  before insert on public.notifications
  for each row execute function public.validate_notification_recipient();

notify pgrst, 'reload schema';



-- Let the customer choose whether to pay before or after the consultation.
alter table public.consultations
  add column if not exists payment_timing text not null default 'before',
  add column if not exists completion_requested boolean not null default false;
alter table public.consultations drop constraint if exists consultations_payment_timing_check;
alter table public.consultations add constraint consultations_payment_timing_check
  check (payment_timing in ('before','after'));

create or replace function public.lock_consultation_fee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(consultation_fee,0) into new.locked_fee
  from public.expert_profiles where user_id=new.expert_user_id;
  if new.payment_timing='after' then new.payment_status:='unpaid';
  else new.payment_status:='pending'; end if;
  new.completion_requested:=false;
  return new;
end; $$;
drop trigger if exists consultation_fee_snapshot on public.consultations;
create trigger consultation_fee_snapshot before insert on public.consultations
for each row execute function public.lock_consultation_fee();

revoke insert on public.consultations from authenticated;
grant insert (user_id,expert_user_id,complaint,started_at,affected_count,scheduled_for,fish_context,payment_timing)
  on public.consultations to authenticated;
grant update (status,final_recommendation,updated_at,completion_requested)
  on public.consultations to authenticated;

drop policy if exists "Only paid sessions allow messages" on public.consultation_messages;
drop policy if exists "Only paid or postpay sessions allow messages" on public.consultation_messages;
create policy "Only paid or postpay sessions allow messages" on public.consultation_messages
  as restrictive for insert to authenticated with check (
    exists(select 1 from public.consultations c where c.id=consultation_id
      and (c.payment_status='paid' or c.payment_timing='after') and c.status <> 'completed')
  );

create or replace function public.notify_payment_first_close_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.completion_requested is true and old.completion_requested is distinct from true then
    insert into public.notifications(user_id,kind,title,body,href)
      values(new.user_id,'payment_due','Konsultasi selesai, pembayaran diperlukan',
        'Ahli menandai konsultasi siap ditutup. Selesaikan pembayaran agar sesi dapat ditutup.','/pembayaran/'||new.id::text);
  end if;
  return new;
end; $$;
drop trigger if exists consultation_completion_payment_notice on public.consultations;
create trigger consultation_completion_payment_notice after update of completion_requested
on public.consultations for each row execute function public.notify_payment_first_close_request();

notify pgrst, 'reload schema';
