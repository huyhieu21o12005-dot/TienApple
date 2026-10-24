-- ==============================================================================
-- TIEN MOBILE - ĐƠN HÀNG (orders) VÀ LỊCH SỬA CHỮA (repair_bookings)
-- Chạy trong Supabase: SQL Editor -> New query -> dán -> Run.
-- Thứ tự chạy: schema.sql -> admin_users.sql -> orders.sql. Chạy lại an toàn.
--
-- Cách hoạt động:
--  * Khách (chưa đăng nhập) KHÔNG đọc/ghi trực tiếp vào bảng. Họ chỉ gọi hai hàm
--    create_order() và create_booking(); hàm tự kiểm tra dữ liệu, tính lại giá từ
--    bảng products (không tin giá gửi từ trình duyệt) rồi mới lưu.
--  * Chỉ admin (bảng admin_users) xem và đổi trạng thái; chỉ owner được xóa.
-- ==============================================================================

create sequence if not exists public.order_code_seq start 1001;
create sequence if not exists public.booking_code_seq start 1001;

-- 1. BẢNG ĐƠN HÀNG
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('DH' || nextval('public.order_code_seq')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  phone text not null check (phone ~ '^0[35789][0-9]{8}$'),
  address text not null check (char_length(address) between 5 and 300),
  note text check (note is null or char_length(note) <= 500),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  voucher text,
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  total bigint not null check (total >= 0),
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipping', 'done', 'cancelled')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_status_created on public.orders (status, created_at desc);
create index if not exists idx_orders_phone on public.orders (phone);

-- 2. BẢNG LỊCH SỬA CHỮA
create table if not exists public.repair_bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('SC' || nextval('public.booking_code_seq')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  phone text not null check (phone ~ '^0[35789][0-9]{8}$'),
  device text not null check (char_length(device) between 1 and 100),
  service text not null check (char_length(service) between 1 and 100),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'confirmed', 'in_progress', 'done', 'cancelled')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_status_created on public.repair_bookings (status, created_at desc);
create index if not exists idx_bookings_phone on public.repair_bookings (phone);

-- 3. TỰ CẬP NHẬT updated_at (dùng lại hàm trong schema.sql)
drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_bookings_updated_at on public.repair_bookings;
create trigger set_bookings_updated_at
  before update on public.repair_bookings
  for each row execute function public.update_updated_at_column();

-- 4. RLS: khách không có policy nào; chỉ admin đọc và cập nhật, chỉ owner xóa
alter table public.orders enable row level security;
alter table public.repair_bookings enable row level security;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders" on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Owners can delete orders" on public.orders;
create policy "Owners can delete orders" on public.orders
  for delete to authenticated using (public.is_owner());

drop policy if exists "Admins can read bookings" on public.repair_bookings;
create policy "Admins can read bookings" on public.repair_bookings
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update bookings" on public.repair_bookings;
create policy "Admins can update bookings" on public.repair_bookings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Owners can delete bookings" on public.repair_bookings;
create policy "Owners can delete bookings" on public.repair_bookings
  for delete to authenticated using (public.is_owner());

-- 5. HÀM KHÁCH GỌI ĐỂ ĐẶT HÀNG (tính lại giá phía máy chủ)
-- Mã lỗi trả về trong message: INVALID_PHONE, INVALID_NAME, INVALID_ADDRESS, INVALID_ITEMS,
-- INVALID_QUANTITY, PRODUCT_UNAVAILABLE, OUT_OF_STOCK, INVALID_VOUCHER, TOO_MANY_REQUESTS
create or replace function public.create_order(
  p_name text,
  p_phone text,
  p_address text,
  p_note text,
  p_items jsonb,
  p_voucher text default null
)
returns table (order_code text, order_total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  v_name text := left(trim(coalesce(p_name, '')), 100);
  v_address text := left(trim(coalesce(p_address, '')), 300);
  v_voucher text := upper(trim(coalesce(p_voucher, '')));
  v_item jsonb;
  v_prod public.products%rowtype;
  v_qty int;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint := 0;
  v_total bigint;
  v_lines jsonb := '[]'::jsonb;
  v_code text;
begin
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) = 0 then raise exception 'INVALID_NAME'; end if;
  if char_length(v_address) < 5 then raise exception 'INVALID_ADDRESS'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Chống spam: tối đa 5 đơn / số điện thoại / giờ
  if (select count(*) from public.orders
      where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := case when (v_item ->> 'quantity') ~ '^[0-9]{1,2}$' then (v_item ->> 'quantity')::int else 0 end;
    if v_qty < 1 then raise exception 'INVALID_QUANTITY'; end if;

    select * into v_prod from public.products
      where id = (v_item ->> 'id') and is_visible = true;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_prod.stock < v_qty then raise exception 'OUT_OF_STOCK'; end if;

    v_subtotal := v_subtotal + v_prod.price * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'id', v_prod.id,
      'name', v_prod.name,
      'price', v_prod.price,
      'quantity', v_qty,
      'color', left(coalesce(v_item ->> 'color', ''), 60),
      'storage', left(coalesce(v_item ->> 'storage', ''), 60)
    ));
  end loop;

  if v_voucher in ('MEMBER', 'TIENMOBILE300') then
    v_discount := 300000;
  elsif v_voucher = 'VIP10' then
    v_discount := round(v_subtotal * 0.1);
  elsif v_voucher <> '' then
    raise exception 'INVALID_VOUCHER';
  end if;
  v_discount := least(v_discount, v_subtotal);
  v_shipping := case when v_subtotal >= 500000 then 0 else 35000 end;
  v_total := v_subtotal - v_discount + v_shipping;

  insert into public.orders (customer_name, phone, address, note, items, voucher,
                             subtotal, discount, shipping_fee, total)
  values (v_name, v_phone, v_address, nullif(left(trim(coalesce(p_note, '')), 500), ''),
          v_lines, nullif(v_voucher, ''), v_subtotal, v_discount, v_shipping, v_total)
  returning code into v_code;

  return query select v_code, v_total;
end;
$$;

-- 6. HÀM KHÁCH GỌI ĐỂ ĐẶT LỊCH SỬA CHỮA
create or replace function public.create_booking(
  p_name text,
  p_phone text,
  p_device text,
  p_service text,
  p_note text default null
)
returns table (booking_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  v_name text := left(trim(coalesce(p_name, '')), 100);
  v_device text := left(trim(coalesce(p_device, '')), 100);
  v_service text := left(trim(coalesce(p_service, '')), 100);
  v_code text;
begin
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) = 0 then raise exception 'INVALID_NAME'; end if;
  if char_length(v_device) = 0 or char_length(v_service) = 0 then raise exception 'INVALID_ITEMS'; end if;

  if (select count(*) from public.repair_bookings
      where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  insert into public.repair_bookings (customer_name, phone, device, service, note)
  values (v_name, v_phone, v_device, v_service, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning code into v_code;

  return query select v_code;
end;
$$;

revoke all on function public.create_order(text, text, text, text, jsonb, text) from public;
revoke all on function public.create_booking(text, text, text, text, text) from public;
grant execute on function public.create_order(text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.create_booking(text, text, text, text, text) to anon, authenticated;
