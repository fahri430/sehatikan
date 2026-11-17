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
