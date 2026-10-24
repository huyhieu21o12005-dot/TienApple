-- ==============================================================================
-- TIEN MOBILE - BẢO HÀNH THEO SỐ ĐIỆN THOẠI (warranties)
-- Chạy trong Supabase: SQL Editor -> New query -> dán -> Run.
-- Thứ tự: schema.sql -> admin_users.sql -> orders.sql -> warranty.sql. Chạy lại an toàn.
--
-- * Nhân viên/quản trị tạo phiếu bảo hành trong /admin/warranty.html.
-- * Khách tra cứu trên website bằng số điện thoại qua hàm lookup_warranty():
--   chỉ trả về tên đã che bớt, máy, nội dung sửa, ngày và hạn bảo hành.
--   Không trả địa chỉ, ghi chú nội bộ hay số điện thoại.
-- * Chống dò số: mỗi số điện thoại tra tối đa 10 lần mỗi giờ.
-- ==============================================================================

create sequence if not exists public.warranty_code_seq start 1001;

-- 1. BẢNG PHIẾU BẢO HÀNH
create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('BH' || nextval('public.warranty_code_seq')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  phone text not null check (phone ~ '^0[35789][0-9]{8}$'),
  device text not null check (char_length(device) between 1 and 100),
  service text not null check (char_length(service) between 1 and 300),
  warranty_months int not null default 3 check (warranty_months between 1 and 60),
  start_date date not null default current_date,
  note text check (note is null or char_length(note) <= 1000),
  order_id uuid references public.orders (id) on delete set null,
  booking_id uuid references public.repair_bookings (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_warranties_phone on public.warranties (phone);
create index if not exists idx_warranties_start on public.warranties (start_date desc);

drop trigger if exists set_warranties_updated_at on public.warranties;
create trigger set_warranties_updated_at
  before update on public.warranties
  for each row execute function public.update_updated_at_column();

-- 2. NHẬT KÝ TRA CỨU (chỉ để giới hạn số lần, khách không đọc được)
create table if not exists public.warranty_lookups (
  id bigint generated always as identity primary key,
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_warranty_lookups_phone_time on public.warranty_lookups (phone, created_at desc);
alter table public.warranty_lookups enable row level security;
-- Không có policy nào: chỉ hàm security definer ghi được.

-- 3. RLS CHO WARRANTIES: admin xem/thêm/sửa, chỉ owner/admin xóa; khách không truy cập trực tiếp
alter table public.warranties enable row level security;

drop policy if exists "Admins can read warranties" on public.warranties;
create policy "Admins can read warranties" on public.warranties
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins can insert warranties" on public.warranties;
create policy "Admins can insert warranties" on public.warranties
  for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update warranties" on public.warranties;
create policy "Admins can update warranties" on public.warranties
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Managers can delete warranties" on public.warranties;
create policy "Managers can delete warranties" on public.warranties
  for delete to authenticated using (public.is_manager());

-- 4. HÀM TRA CỨU CHO KHÁCH
create or replace function public.mask_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name is null or length(trim(p_name)) = 0 then ''
    else (
      select string_agg(
        case when length(w) <= 1 then w else left(w, 1) || repeat('*', least(length(w) - 1, 4)) end,
        ' ' order by ord
      )
      from regexp_split_to_table(trim(p_name), '\s+') with ordinality as t(w, ord)
    )
  end;
$$;

create or replace function public.lookup_warranty(p_phone text)
returns table (
  code text,
  customer_name_masked text,
  device text,
  service text,
  start_date date,
  end_date date,
  warranty_months int,
  is_active boolean,
  days_left int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
begin
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;

  if (select count(*) from public.warranty_lookups
      where phone = v_phone and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.warranty_lookups (phone) values (v_phone);
  delete from public.warranty_lookups where created_at < now() - interval '2 days';

  return query
    select w.code,
           public.mask_name(w.customer_name),
           w.device,
           w.service,
           w.start_date,
           (w.start_date + make_interval(months => w.warranty_months))::date,
           w.warranty_months,
           (w.start_date + make_interval(months => w.warranty_months))::date >= current_date,
           greatest(0, ((w.start_date + make_interval(months => w.warranty_months))::date - current_date))::int
    from public.warranties w
    where w.phone = v_phone
    order by w.start_date desc, w.created_at desc
    limit 20;
end;
$$;

revoke all on function public.lookup_warranty(text) from public;
revoke all on function public.mask_name(text) from public;
grant execute on function public.lookup_warranty(text) to anon, authenticated;
