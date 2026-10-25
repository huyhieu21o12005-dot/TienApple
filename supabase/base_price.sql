-- Giá gốc (base_price) để chức năng "Set giá" luôn tính từ giá gốc, không bị cộng dồn.
alter table public.products add column if not exists base_price numeric;
update public.products set base_price = price where base_price is null;
