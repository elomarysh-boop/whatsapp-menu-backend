create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null unique,
  currency text not null default 'ل.س',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique(store_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'ل.س',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  store_id uuid not null references public.stores(id) on delete restrict,
  customer_phone text not null,
  customer_name text,
  delivery_address text,
  fulfillment_type text not null check (fulfillment_type in ('delivery','pickup')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  currency text not null default 'ل.س',
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','ready','completed','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists categories_store_idx on public.categories(store_id, is_active, sort_order);
create index if not exists products_category_idx on public.products(category_id, is_active, sort_order);
create index if not exists orders_store_status_idx on public.orders(store_id, status, created_at desc);

alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- The backend uses the Supabase service role key server-side. Do not expose it to clients.
-- Add dashboard-specific authenticated policies separately if a merchant admin UI is introduced.

-- Convert existing default Saudi Riyal labels to Syrian Pound labels.
alter table public.stores alter column currency set default 'ل.س';
alter table public.products alter column currency set default 'ل.س';
alter table public.orders alter column currency set default 'ل.س';
update public.stores set currency = 'ل.س' where currency = 'ر.س';
update public.products set currency = 'ل.س' where currency = 'ر.س';
update public.orders set currency = 'ل.س' where currency = 'ر.س';
