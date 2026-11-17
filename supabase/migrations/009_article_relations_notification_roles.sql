-- Repair article comment relationships and restrict notification recipients.
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
