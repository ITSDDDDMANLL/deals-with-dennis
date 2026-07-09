create table if not exists public.inventory_vehicles (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
  vehicle_type text not null check (vehicle_type in ('new', 'used')),
  year integer,
  make text,
  model text,
  trim text,
  stock_number text unique,
  vin text,
  class_name text,
  exterior_color text,
  price numeric,
  price_label text,
  mileage integer,
  mileage_label text,
  status text not null default 'available',
  claim_status text not null default 'unknown'
    check (claim_status in ('unknown', 'no-claim', 'minor-claim', 'claim-over-5k')),
  is_featured boolean not null default true,
  image_urls jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_vehicles_type_idx
  on public.inventory_vehicles (vehicle_type);

create index if not exists inventory_vehicles_stock_number_idx
  on public.inventory_vehicles (stock_number);

create index if not exists inventory_vehicles_featured_idx
  on public.inventory_vehicles (is_featured, status);

alter table public.inventory_vehicles
  add column if not exists claim_status text not null default 'unknown'
    check (claim_status in ('unknown', 'no-claim', 'minor-claim', 'claim-over-5k'));

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  vehicle_type text,
  message text,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

alter table public.inventory_vehicles enable row level security;
alter table public.contact_inquiries enable row level security;

drop policy if exists "Public can read available inventory" on public.inventory_vehicles;
create policy "Public can read available inventory"
  on public.inventory_vehicles
  for select
  using (status in ('available', 'incoming'));

drop policy if exists "Service role manages inventory" on public.inventory_vehicles;
create policy "Service role manages inventory"
  on public.inventory_vehicles
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages contact inquiries" on public.contact_inquiries;
create policy "Service role manages contact inquiries"
  on public.contact_inquiries
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read vehicle images" on storage.objects;
create policy "Public can read vehicle images"
  on storage.objects
  for select
  using (bucket_id = 'vehicle-images');

drop policy if exists "Service role manages vehicle images" on storage.objects;
create policy "Service role manages vehicle images"
  on storage.objects
  using (bucket_id = 'vehicle-images' and auth.role() = 'service_role')
  with check (bucket_id = 'vehicle-images' and auth.role() = 'service_role');
