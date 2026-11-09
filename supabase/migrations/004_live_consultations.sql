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
