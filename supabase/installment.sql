-- ==============================================================================
-- TIEN MOBILE - DANG KY TRA GOP (installment_requests)
-- Chay trong Supabase: SQL Editor -> New query -> dan -> Run. Chay lai an toan.
-- Thu tu: schema.sql -> admin_users.sql -> orders.sql -> telegram.sql -> telegram_bot.sql
--         -> telegram_topics.sql -> installment.sql
--
-- * Khach dang ky tren website qua ham create_installment() (khong doc/ghi bang truc tiep).
-- * Chi luu thong tin lien he, may, gia, tra truoc, ky han, nghe nghiep va DANH SACH ho so
--   khach se mang theo. Khong thu so CCCD hay anh giay to qua web.
-- * Admin/nhan vien xem va doi trang thai; chi quan ly (manager) moi xoa.
-- * Moi ho so moi gui thong bao vao chu de "Tra gop" trong nhom Telegram.
-- ==============================================================================

create sequence if not exists public.installment_code_seq start 1001;

create table if not exists public.installment_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('TG' || nextval('public.installment_code_seq')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  phone text not null check (phone ~ '^0[35789][0-9]{8}$'),
  product text not null check (char_length(product) between 1 and 100),
  price bigint not null check (price > 0 and price <= 200000000),
  down_payment bigint not null default 0 check (down_payment >= 0),
  term_months int not null check (term_months in (3, 6, 9, 12, 18, 24)),
  monthly_estimate bigint not null default 0,
  method text not null check (char_length(method) between 1 and 60),
  occupation text not null check (char_length(occupation) between 1 and 60),
  documents text check (documents is null or char_length(documents) <= 300),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected', 'cancelled')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (down_payment < price)
);

create index if not exists idx_installments_status on public.installment_requests (status, created_at desc);
create index if not exists idx_installments_phone on public.installment_requests (phone);

drop trigger if exists set_installments_updated_at on public.installment_requests;
create trigger set_installments_updated_at
  before update on public.installment_requests
  for each row execute function public.update_updated_at_column();

alter table public.installment_requests enable row level security;

drop policy if exists "Admins can read installments" on public.installment_requests;
create policy "Admins can read installments" on public.installment_requests
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update installments" on public.installment_requests;
create policy "Admins can update installments" on public.installment_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Managers can delete installments" on public.installment_requests;
create policy "Managers can delete installments" on public.installment_requests
  for delete to authenticated using (public.is_manager());

-- Tien gop moi thang uoc tinh. Lai suat thang (0 = chi chia deu). Phai trung INSTALLMENT_MONTHLY_RATE trong js/installment.js.
create or replace function public.installment_monthly(p_loan bigint, p_term int)
returns bigint
language sql
immutable
as $$
  select (ceil((p_loan::numeric / p_term + p_loan::numeric * 0) / 1000) * 1000)::bigint;
$$;

create or replace function public.create_installment(
  p_name text,
  p_phone text,
  p_product text,
  p_price bigint,
  p_down_payment bigint,
  p_term int,
  p_method text,
  p_occupation text,
  p_documents text default null,
  p_note text default null
)
returns table (installment_code text, monthly_estimate bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  v_name text := left(trim(coalesce(p_name, '')), 100);
  v_product text := left(trim(coalesce(p_product, '')), 100);
  v_method text := left(trim(coalesce(p_method, '')), 60);
  v_occupation text := left(trim(coalesce(p_occupation, '')), 60);
  v_down bigint := coalesce(p_down_payment, 0);
  v_code text;
  v_monthly bigint;
begin
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) = 0 then raise exception 'INVALID_NAME'; end if;
  if char_length(v_product) = 0 or char_length(v_method) = 0 or char_length(v_occupation) = 0 then raise exception 'INVALID_ITEMS'; end if;
  if p_price is null or p_price <= 0 or p_price > 200000000 or v_down < 0 or v_down >= p_price then raise exception 'INVALID_PRICE'; end if;
  if p_term is null or p_term not in (3, 6, 9, 12, 18, 24) then raise exception 'INVALID_TERM'; end if;

  if (select count(*) from public.installment_requests
      where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  v_monthly := public.installment_monthly(p_price - v_down, p_term);

  insert into public.installment_requests
    (customer_name, phone, product, price, down_payment, term_months, monthly_estimate, method, occupation, documents, note)
  values
    (v_name, v_phone, v_product, p_price, v_down, p_term, v_monthly, v_method, v_occupation,
     nullif(left(trim(coalesce(p_documents, '')), 300), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning code into v_code;

  return query select v_code, v_monthly;
end;
$$;

revoke all on function public.create_installment(text, text, text, bigint, bigint, int, text, text, text, text) from public;
grant execute on function public.create_installment(text, text, text, bigint, bigint, int, text, text, text, text) to anon, authenticated;

-- Thong bao Telegram vao chu de "Tra gop"
create or replace function public.tg_installment_text(r public.installment_requests)
returns text
language sql
as $$
  select E'\U0001f4b3 <b>\u0110\u0102NG K\u00dd TR\u1ea2 G\u00d3P ' || public.tg_escape(r.code) || '</b>'
    || E'\nKh\u00e1ch: ' || public.tg_escape(r.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(r.phone)
    || E'\nM\u00e1y: ' || public.tg_escape(r.product)
    || E'\nGi\u00e1 m\u00e1y: ' || public.tg_money(r.price)
    || E'\nTr\u1ea3 tr\u01b0\u1edbc: ' || public.tg_money(r.down_payment)
    || E'\nK\u1ef3 h\u1ea1n: ' || r.term_months || E' th\u00e1ng (\u2248 ' || public.tg_money(r.monthly_estimate) || E'/th\u00e1ng)'
    || E'\nH\u00ecnh th\u1ee9c: ' || public.tg_escape(r.method)
    || E'\nNgh\u1ec1 nghi\u1ec7p: ' || public.tg_escape(r.occupation)
    || case when r.documents is not null then E'\nH\u1ed3 s\u01a1 s\u1eb5n c\u00f3: ' || public.tg_escape(r.documents) else '' end
    || case when r.note is not null then E'\nGhi ch\u00fa: ' || public.tg_escape(r.note) else '' end;
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

drop trigger if exists notify_new_installment on public.installment_requests;
create trigger notify_new_installment after insert on public.installment_requests
  for each row execute function public.trg_notify_installment();

revoke all on function public.trg_notify_installment() from public, anon, authenticated;
