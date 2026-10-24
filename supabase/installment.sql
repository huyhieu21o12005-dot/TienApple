-- ==============================================================================
-- TIEN MOBILE - HO SO TRA GOP (installments) do CUA HANG nhap trong trang quan tri
-- Chay trong Supabase: SQL Editor -> New query -> dan -> Run. Chay lai an toan.
-- Thu tu: schema.sql -> admin_users.sql -> orders.sql -> telegram.sql -> telegram_bot.sql
--         -> telegram_topics.sql -> installment.sql
--
-- * Admin/nhan vien nhap ho so: ten, SDT, may, gia goc, tra truoc, lai suat (%/thang, tu nhap),
--   ky han, hinh thuc tra, giay to di kem. Tien gop va THANH TIEN do co so du lieu tu tinh:
--     khoan vay = gia goc - tra truoc
--     tien gop/thang = lam tron len nghin cua (khoan vay / so thang + khoan vay * lai% / 100)
--     thanh tien = tra truoc + tien gop/thang * so thang
-- * Khach tra cuu ngoai website bang SDT + ma hoa don (ma ho so TGxxxx) qua lookup_installment().
--   Chi tra ve ten da che, may, tien, ky han, so ky da dong; khong tra giay to hay ghi chu.
-- * Khong con form khach tu dang ky: ham create_installment() va bang installment_requests cu
--   khong con dung. Bang cu giu nguyen du lieu; xoa neu khong can: drop table public.installment_requests;
-- ==============================================================================

-- 0. Go phan khach tu dang ky (cu)
do $$
begin
  if to_regclass('public.installment_requests') is not null then
    drop trigger if exists notify_new_installment on public.installment_requests;
    revoke all on table public.installment_requests from anon, authenticated;
  end if;
end $$;
drop function if exists public.create_installment(text, text, text, bigint, bigint, int, text, text, text, text);
drop function if exists public.tg_installment_text(public.installment_requests);

create sequence if not exists public.installment_code_seq start 1001;

-- 1. BANG HO SO TRA GOP
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('TG' || nextval('public.installment_code_seq')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  phone text not null check (phone ~ '^0[35789][0-9]{8}$'),
  product text not null check (char_length(product) between 1 and 100),
  original_price bigint not null check (original_price > 0 and original_price <= 500000000),
  down_payment bigint not null default 0 check (down_payment >= 0),
  interest_rate numeric(5, 2) not null default 0 check (interest_rate >= 0 and interest_rate <= 100),
  term_months int not null check (term_months between 1 and 60),
  pay_method text not null check (pay_method in (E'Ti\u1ec1n m\u1eb7t', E'Chuy\u1ec3n kho\u1ea3n', E'Qu\u1eb9t th\u1ebb', E'C\u00f4ng ty t\u00e0i ch\u00ednh')),
  documents text check (documents is null or char_length(documents) <= 300),
  note text check (note is null or char_length(note) <= 500),
  start_date date not null default current_date,
  paid_months int not null default 0 check (paid_months >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  loan_amount bigint not null default 0,
  monthly_payment bigint not null default 0,
  interest_amount bigint not null default 0,
  total_amount bigint not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (down_payment < original_price),
  check (paid_months <= term_months)
);

create index if not exists idx_installments_phone on public.installments (phone);
create index if not exists idx_installments_status on public.installments (status, created_at desc);

-- 2. TU TINH TIEN GOP VA THANH TIEN (khong tin so tinh tu trinh duyet)
create or replace function public.installments_compute()
returns trigger
language plpgsql
as $$
begin
  new.loan_amount := new.original_price - new.down_payment;
  new.monthly_payment := (ceil((new.loan_amount::numeric / new.term_months + new.loan_amount::numeric * new.interest_rate / 100) / 1000) * 1000)::bigint;
  new.total_amount := new.down_payment + new.monthly_payment * new.term_months;
  new.interest_amount := new.monthly_payment * new.term_months - new.loan_amount;
  if new.status = 'active' and new.paid_months >= new.term_months then
    new.status := 'completed';
  end if;
  return new;
end;
$$;

drop trigger if exists compute_installments on public.installments;
create trigger compute_installments
  before insert or update on public.installments
  for each row execute function public.installments_compute();

drop trigger if exists set_installments_updated_at on public.installments;
create trigger set_installments_updated_at
  before update on public.installments
  for each row execute function public.update_updated_at_column();

-- 3. RLS: admin xem/them/sua; chi manager xoa; khach khong truy cap truc tiep
alter table public.installments enable row level security;

drop policy if exists "Admins can read installments" on public.installments;
create policy "Admins can read installments" on public.installments
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins can insert installments" on public.installments;
create policy "Admins can insert installments" on public.installments
  for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update installments" on public.installments;
create policy "Admins can update installments" on public.installments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Managers can delete installments" on public.installments;
create policy "Managers can delete installments" on public.installments
  for delete to authenticated using (public.is_manager());

-- 4. TRA CUU CHO KHACH: can SDT + ma hoa don; moi SDT toi da 10 lan/gio
create table if not exists public.installment_lookups (
  id bigint generated always as identity primary key,
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_installment_lookups_phone_time on public.installment_lookups (phone, created_at desc);
alter table public.installment_lookups enable row level security;

create or replace function public.lookup_installment(p_phone text, p_code text)
returns table (
  code text,
  customer_name_masked text,
  product text,
  original_price bigint,
  down_payment bigint,
  interest_rate numeric,
  term_months int,
  monthly_payment bigint,
  total_amount bigint,
  pay_method text,
  paid_months int,
  remaining_months int,
  remaining_amount bigint,
  status text,
  start_date date,
  next_due_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;
  if v_code !~ '^TG[0-9]{3,10}$' then raise exception 'INVALID_CODE'; end if;

  if (select count(*) from public.installment_lookups
      where phone = v_phone and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.installment_lookups (phone) values (v_phone);
  delete from public.installment_lookups where created_at < now() - interval '2 days';

  return query
    select i.code,
           public.mask_name(i.customer_name),
           i.product,
           i.original_price,
           i.down_payment,
           i.interest_rate,
           i.term_months,
           i.monthly_payment,
           i.total_amount,
           i.pay_method,
           i.paid_months,
           greatest(0, i.term_months - i.paid_months),
           greatest(0, i.term_months - i.paid_months)::bigint * i.monthly_payment,
           i.status,
           i.start_date,
           case when i.status = 'active' and i.paid_months < i.term_months
                then (i.start_date + make_interval(months => i.paid_months + 1))::date end
    from public.installments i
    where i.phone = v_phone and i.code = v_code
    limit 1;
end;
$$;
revoke all on function public.lookup_installment(text, text) from public;
grant execute on function public.lookup_installment(text, text) to anon, authenticated;

-- 5. DON DEP BANG TAM MOI NGAY (ghi de ham trong cleanup.sql, them bang tra cuu tra gop)
create or replace function public.purge_temp_data()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.warranty_lookups where created_at < now() - interval '2 days';
  delete from public.installment_lookups where created_at < now() - interval '2 days';
  begin
    delete from net._http_response where created < now() - interval '1 day';
  exception when others then
    null;
  end;
end;
$$;
revoke all on function public.purge_temp_data() from public, anon, authenticated;

-- 6. THONG BAO TELEGRAM vao chu de "Tra gop" khi cua hang tao ho so
create or replace function public.tg_installment_text(r public.installments)
returns text
language sql
as $$
  select E'\U0001f4b3 <b>H\u1ed2 S\u01a0 TR\u1ea2 G\u00d3P ' || public.tg_escape(r.code) || '</b>'
    || E'\nKh\u00e1ch: ' || public.tg_escape(r.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(r.phone)
    || E'\nM\u00e1y: ' || public.tg_escape(r.product)
    || E'\nGi\u00e1 g\u1ed1c: ' || public.tg_money(r.original_price)
    || E'\nTr\u1ea3 tr\u01b0\u1edbc: ' || public.tg_money(r.down_payment)
    || E'\nL\u00e3i su\u1ea5t: ' || trim(trailing '.' from trim(trailing '0' from r.interest_rate::text)) || E'%/th\u00e1ng, ' || r.term_months || E' th\u00e1ng'
    || E'\nG\u00f3p m\u1ed7i th\u00e1ng: ' || public.tg_money(r.monthly_payment)
    || E'\n<b>Th\u00e0nh ti\u1ec1n: ' || public.tg_money(r.total_amount) || '</b>'
    || E'\nH\u00ecnh th\u1ee9c tr\u1ea3: ' || public.tg_escape(r.pay_method)
    || case when r.documents is not null then E'\nGi\u1ea5y t\u1edd: ' || public.tg_escape(r.documents) else '' end;
$$;

create or replace function public.trg_notify_installment()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.notify_telegram(public.tg_installment_text(new), 'installment');
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists notify_new_installment on public.installments;
create trigger notify_new_installment after insert on public.installments
  for each row execute function public.trg_notify_installment();

revoke all on function public.trg_notify_installment() from public, anon, authenticated;
