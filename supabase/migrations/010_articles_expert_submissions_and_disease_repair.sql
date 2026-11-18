-- Repair disease-record schema and allow expert article drafts for admin review.
create table if not exists public.disease_records (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  species text not null default 'Semua spesies',
  cause text not null default '',
  symptoms text not null default '',
  treatment text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disease_records add column if not exists name text not null default '';
alter table public.disease_records add column if not exists id uuid default gen_random_uuid();
alter table public.disease_records add column if not exists species text not null default 'Semua spesies';
alter table public.disease_records add column if not exists cause text not null default '';
alter table public.disease_records add column if not exists symptoms text not null default '';
alter table public.disease_records add column if not exists treatment text not null default '';
alter table public.disease_records add column if not exists status text not null default 'draft';
alter table public.disease_records add column if not exists created_at timestamptz not null default now();
alter table public.disease_records add column if not exists updated_at timestamptz not null default now();
update public.disease_records set id = coalesce(id, gen_random_uuid()), name = coalesce(name, ''), species = coalesce(species, 'Semua spesies'),
  cause = coalesce(cause, ''), symptoms = coalesce(symptoms, ''), treatment = coalesce(treatment, ''),
  status = coalesce(status, 'draft'), created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now());
alter table public.disease_records alter column name set not null;
alter table public.disease_records alter column id set default gen_random_uuid();
alter table public.disease_records alter column id set not null;
alter table public.disease_records alter column species set not null;
alter table public.disease_records alter column cause set not null;
alter table public.disease_records alter column symptoms set not null;
alter table public.disease_records alter column treatment set not null;
alter table public.disease_records alter column status set not null;
alter table public.disease_records drop constraint if exists disease_records_status_check;
alter table public.disease_records add constraint disease_records_status_check
  check (status in ('draft', 'published', 'review'));
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.disease_records'::regclass and contype = 'p'
  ) then
    alter table public.disease_records add constraint disease_records_pkey primary key (id);
  end if;
end;
$$;
alter table public.disease_records enable row level security;
do $$
declare policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'disease_records'
  loop
    execute format('drop policy if exists %I on public.disease_records', policy_name);
  end loop;
end;
$$;
revoke all on public.disease_records from anon, authenticated;
create policy "Admins manage disease records" on public.disease_records for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
grant select, insert, update, delete on public.disease_records to authenticated;

drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users mark own notifications read" on public.notifications;
drop policy if exists "Role reads own notification types" on public.notifications;
create policy "Role reads own notification types" on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and (
      ((auth.jwt()->'app_metadata'->>'role') = 'admin' and kind = 'user_report')
      or (
        (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'expert')
        and kind in ('consultation_request','chat_reply','payment_status','expert_verification','expert_status','expert_review')
      )
      or (
        (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type <> 'expert')
        and kind in ('chat_reply','consultation_status','payment_status','payment_due')
      )
    )
  );
create policy "Role marks own notification types read" on public.notifications for update to authenticated
  using (
    user_id = (select auth.uid())
    and (
      ((auth.jwt()->'app_metadata'->>'role') = 'admin' and kind = 'user_report')
      or (
        (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'expert')
        and kind in ('consultation_request','chat_reply','payment_status','expert_verification','expert_status','expert_review')
      )
      or (
        (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type <> 'expert')
        and kind in ('chat_reply','consultation_status','payment_status','payment_due')
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      ((auth.jwt()->'app_metadata'->>'role') = 'admin' and kind = 'user_report')
      or (
        (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'expert')
        and kind in ('consultation_request','chat_reply','payment_status','expert_verification','expert_status','expert_review')
      )
      or (
        (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type <> 'expert')
        and kind in ('chat_reply','consultation_status','payment_status','payment_due')
      )
    )
  );

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'Kesehatan ikan',
  excerpt text not null default '',
  body text not null default '',
  image_url text,
  status text not null default 'draft',
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles add constraint articles_status_check
  check (status in ('draft', 'review', 'published'));
alter table public.articles enable row level security;
drop policy if exists "Experts read own article submissions" on public.articles;
create policy "Experts read own article submissions" on public.articles for select to authenticated
  using (author_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'expert'
  ));
drop policy if exists "Experts submit articles for review" on public.articles;
create policy "Experts submit articles for review" on public.articles for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'review'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'expert')
  );
grant select on public.articles to anon, authenticated;
grant insert on public.articles to authenticated;
notify pgrst, 'reload schema';
