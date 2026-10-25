-- ==============================================================================
-- TIEN MOBILE - SO THU CHI (cashflow_entries)
-- Chay trong Supabase: SQL Editor -> New query -> dan -> Run. Chay lai an toan.
-- Thu tu: ... -> installment.sql -> cashflow.sql
--
-- * Admin/nhan vien ghi khoan THU (kind = 'in') va CHI (kind = 'out'): so tien, nhom, ghi chu, ngay.
-- * Nut "Ghi vao so thu" o trang in hoa don tao khoan thu co ma phieu (ref_code); moi ma chi ghi 1 lan.
-- * Chi chu shop (owner) duoc xoa.
-- ==============================================================================

create table if not exists public.cashflow_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('in', 'out')),
  amount bigint not null check (amount > 0 and amount <= 100000000000),
  category text not null check (char_length(category) between 1 and 60),
  note text check (note is null or char_length(note) <= 300),
  ref_code text check (ref_code is null or char_length(ref_code) <= 30),
  entry_date date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_cashflow_in_ref on public.cashflow_entries (ref_code) where kind = 'in' and ref_code is not null;
create index if not exists idx_cashflow_date on public.cashflow_entries (entry_date desc, created_at desc);

alter table public.cashflow_entries enable row level security;

drop policy if exists "Admins read cashflow" on public.cashflow_entries;
create policy "Admins read cashflow" on public.cashflow_entries for select to authenticated using (public.is_admin());
drop policy if exists "Admins insert cashflow" on public.cashflow_entries;
create policy "Admins insert cashflow" on public.cashflow_entries for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update cashflow" on public.cashflow_entries;
create policy "Admins update cashflow" on public.cashflow_entries for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Owners delete cashflow" on public.cashflow_entries;
create policy "Owners delete cashflow" on public.cashflow_entries for delete to authenticated using (public.is_owner());

revoke all on table public.cashflow_entries from anon;
grant select, insert, update, delete on table public.cashflow_entries to authenticated;
