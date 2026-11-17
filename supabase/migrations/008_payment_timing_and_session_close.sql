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
