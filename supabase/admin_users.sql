-- ==============================================================================
-- TIEN MOBILE - BẢNG QUẢN TRỊ VIÊN (admin_users) + PHÂN QUYỀN CHẶT
-- Chạy file này trong Supabase: SQL Editor -> New query -> dán -> Run.
-- Chạy SAU schema.sql. An toàn khi chạy lại nhiều lần (idempotent).
--
-- Mục tiêu: chỉ những tài khoản có tên trong bảng admin_users mới được
-- thêm/sửa/xóa sản phẩm và ảnh. Người có tài khoản Supabase nhưng không nằm
-- trong bảng này không làm được gì, kể cả khi lỡ bật đăng ký công khai.
-- ==============================================================================

-- 1. BẢNG ADMIN_USERS (liên kết 1-1 với auth.users)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.admin_users is 'Danh sách tài khoản được quyền quản trị website Tien Mobile';
comment on column public.admin_users.role is 'owner: chủ shop, quản lý cả danh sách tài khoản; admin: quản lý sản phẩm, được xóa; staff: nhân viên, chỉ xem/thêm/sửa, không được xóa';

create index if not exists idx_admin_users_active on public.admin_users (is_active);

-- 2. HÀM KIỂM TRA QUYỀN (security definer để đọc được bảng mà không bị RLS chặn)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true and role = 'owner'
  );
$$;

-- Quản lý = owner hoặc admin. Nhân viên (staff) KHÔNG phải quản lý nên không xóa được sản phẩm/ảnh.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true and role in ('owner', 'admin')
  );
$$;

-- Vai trò của người đang đăng nhập (trang admin dùng để ẩn nút xóa với nhân viên)
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_users
  where user_id = auth.uid() and is_active = true;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_owner() from public, anon;
revoke all on function public.is_manager() from public, anon;
revoke all on function public.current_admin_role() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.current_admin_role() to authenticated;

-- 3. RLS CHO BẢNG ADMIN_USERS
alter table public.admin_users enable row level security;

drop policy if exists "Admins can read own row, owners read all" on public.admin_users;
create policy "Admins can read own row, owners read all"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_owner());

drop policy if exists "Owners can add admins" on public.admin_users;
create policy "Owners can add admins"
  on public.admin_users
  for insert
  to authenticated
  with check (public.is_owner());

drop policy if exists "Owners can update admins" on public.admin_users;
create policy "Owners can update admins"
  on public.admin_users
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "Owners can remove admins" on public.admin_users;
create policy "Owners can remove admins"
  on public.admin_users
  for delete
  to authenticated
  using (public.is_owner());

-- Khách (anon) không có policy nào nên không đọc/ghi được bảng này.

-- 4. SIẾT QUYỀN BẢNG PRODUCTS: thay "mọi tài khoản đăng nhập" bằng "chỉ admin"
drop policy if exists "Authenticated users can select all products" on public.products;
drop policy if exists "Authenticated users can insert products" on public.products;
drop policy if exists "Authenticated users can update products" on public.products;
drop policy if exists "Authenticated users can delete products" on public.products;

drop policy if exists "Admins can select all products" on public.products;
create policy "Admins can select all products"
  on public.products for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Chỉ owner/admin được xóa. Nhân viên chỉ xem, thêm và sửa.
drop policy if exists "Admins can delete products" on public.products;
drop policy if exists "Managers can delete products" on public.products;
create policy "Managers can delete products"
  on public.products for delete to authenticated
  using (public.is_manager());

-- 5. SIẾT QUYỀN KHO ẢNH product-images: chỉ admin được tải lên/sửa/xóa
drop policy if exists "Authenticated users can upload product images" on storage.objects;
drop policy if exists "Authenticated users can update product images" on storage.objects;
drop policy if exists "Authenticated users can delete product images" on storage.objects;

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
drop policy if exists "Managers can delete product images" on storage.objects;
create policy "Managers can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_manager());

-- 6. TẠO CHỦ SHOP ĐẦU TIÊN
-- Đăng nhập bằng TÊN TÀI KHOẢN: tên "chushop" tương ứng email nội bộ chushop@tienmobile.vn.
-- Bước 1: Authentication -> Users -> Add user -> Create new user:
--         Email = <tên tài khoản>@tienmobile.vn (ví dụ chushop@tienmobile.vn), nhập mật khẩu, TICK "Auto Confirm User".
-- Bước 2: đổi email bên dưới cho đúng, bỏ dấu "--" ở đầu các dòng, rồi chạy.
-- (SQL Editor chạy với quyền cao nên không bị RLS chặn.)
--
-- insert into public.admin_users (user_id, email, display_name, role)
-- select id, email, 'Chủ shop', 'owner'
-- from auth.users
-- where email = 'chushop@tienmobile.vn'
-- on conflict (user_id) do update set role = 'owner', is_active = true;

-- THÊM NHÂN VIÊN SAU NÀY (chạy trong SQL Editor, hoặc chủ shop thêm qua API):
-- insert into public.admin_users (user_id, email, display_name, role)
-- select id, email, 'Nhân viên A', 'staff' from auth.users where email = 'nhanvien1@tienmobile.vn';
--
-- TẠM KHÓA MỘT NHÂN VIÊN (không xóa tài khoản):
-- update public.admin_users set is_active = false where email = 'nhanvien1@tienmobile.vn';
