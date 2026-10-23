-- ==============================================================================
-- TIEN MOBILE - DATABASE SCHEMA & STORAGE CONFIGURATION
-- Supabase PostgreSQL with Row Level Security (RLS) & Storage
-- ==============================================================================

-- 1. EXTENSIONS & FUNCTIONS
create extension if not exists "uuid-ossp";

-- Trigger function to automatically update `updated_at` column
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2. PRODUCTS TABLE
create table if not exists public.products (
  id text primary key, -- Slug identifier (e.g. 'ip16-pro'), never edited after creation
  name text not null,
  kind text not null check (kind in ('phone', 'accessory')),
  category text, -- e.g. 'charger', 'audio', 'case'
  brand text, -- e.g. 'apple', 'samsung', 'xiaomi', 'oppo'
  brand_name text, -- e.g. 'Apple iPhone', 'Samsung Galaxy'
  condition text check (condition in ('new', 'like_new', 'used')),
  condition_label text, -- e.g. 'Mới 100%', 'Like New 99%'
  badge text, -- e.g. '0% LS', 'Hot deal'
  price bigint not null check (price >= 0),
  old_price bigint check (old_price is null or old_price >= 0),
  colors jsonb default '[]'::jsonb, -- Array of objects: [{"name": "Titan Tự Nhiên", "hex": "#8E8D8A"}]
  default_color text,
  storages jsonb default '[]'::jsonb, -- Array of strings: ["128GB", "256GB", "512GB"]
  chip text,
  camera text,
  battery text,
  screen text,
  description text,
  rating numeric default 5.0,
  review_count int default 0,
  image_url text,
  stock int default 0 check (stock >= 0),
  is_visible boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexing for fast search, filter & sort
create index if not exists idx_products_visible on public.products (is_visible);
create index if not exists idx_products_kind on public.products (kind);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_brand on public.products (brand);
create index if not exists idx_products_sort_order on public.products (sort_order asc, created_at desc);

-- Trigger for auto-updating `updated_at`
drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row
  execute function public.update_updated_at_column();

-- 3. ROW LEVEL SECURITY (RLS) FOR PRODUCTS
alter table public.products enable row level security;

-- Policy 1: Public (anon) can SELECT only rows where is_visible = true
drop policy if exists "Public can view visible products" on public.products;
create policy "Public can view visible products"
  on public.products
  for select
  to anon, authenticated
  using (is_visible = true);

-- Policy 2: Authenticated users (Admin) can SELECT all rows (including hidden)
drop policy if exists "Authenticated users can select all products" on public.products;
create policy "Authenticated users can select all products"
  on public.products
  for select
  to authenticated
  using (true);

-- Policy 3: Authenticated users can INSERT new products
drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Authenticated users can insert products"
  on public.products
  for insert
  to authenticated
  with check (true);

-- Policy 4: Authenticated users can UPDATE products
drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
  on public.products
  for update
  to authenticated
  using (true)
  with check (true);

-- Policy 5: Authenticated users can DELETE products
drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
  on public.products
  for delete
  to authenticated
  using (true);

-- 4. STORAGE CONFIGURATION
-- Ensure the 'product-images' bucket exists with public read access
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage RLS Policies for product-images bucket
-- Note: storage.objects already has RLS enabled by default in Supabase

-- Storage Policy 1: Anyone (public) can view images in product-images
drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Storage Policy 2: Authenticated users can upload images
drop policy if exists "Authenticated users can upload product images" on storage.objects;
create policy "Authenticated users can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Storage Policy 3: Authenticated users can update images
drop policy if exists "Authenticated users can update product images" on storage.objects;
create policy "Authenticated users can update product images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images');

-- Storage Policy 4: Authenticated users can delete images
drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Authenticated users can delete product images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');
