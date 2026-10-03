-- OnMyWay · 0002 · orders, secrets, audit log, reports.
-- Rows are only ever written by the functions in 0003; clients get read access via RLS (0004).

-- 1. orders: the non-secret part of a delivery -------------------------------------------------
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.profiles (id),
  courier_id     uuid references public.profiles (id),
  pickup_point   text not null check (pickup_point in ('Main Gate', 'Amazon Pick Up Point')),
  tracking_id    text not null check (char_length(tracking_id) between 4 and 40),
  platform       text not null check (platform in ('Amazon', 'Flipkart', 'Myntra', 'Courier')),
  size           text not null check (size in ('S', 'M', 'L', 'XL')),
  drop_block     text not null check (char_length(drop_block) between 1 and 40),
  note           text not null default '' check (char_length(note) <= 200),
  fare           int  not null check (fare between 0 and 500),          -- set by the server, never the client
  status         text not null default 'available' check (status in (
                   'available', 'allocated', 'picked_up', 'on_the_way', 'reached',
                   'handed_over', 'delivered', 'cancelled', 'disputed')),
  pin_expiry     timestamptz,                                           -- public so both screens can count down
  rating         smallint check (rating between 1 and 5),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  accepted_at    timestamptz,
  picked_up_at   timestamptz,
  on_the_way_at  timestamptz,
  arrived_at     timestamptz,
  handed_over_at timestamptz,
  delivered_at   timestamptz,
  cancelled_at   timestamptz,
  constraint orders_not_self check (courier_id is null or courier_id <> customer_id),
  -- open orders have no courier; every in-flight or delivered order has one
  constraint orders_courier_matches_status check (
    status in ('cancelled', 'disputed') or (status = 'available') = (courier_id is null))
);

create index orders_open_idx     on public.orders (status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_courier_idx  on public.orders (courier_id, status);

create trigger omw_orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();

-- 2. secrets: never readable directly, only through get_order_private() -----------------------
create table public.order_secrets (
  order_id     uuid primary key references public.orders (id),
  pickup_otp   text check (pickup_otp ~ '^[0-9]{4,8}$'),
  driver_phone text check (driver_phone ~ '^[0-9]{6,15}$'),
  delivery_pin text check (delivery_pin ~ '^[0-9]{4}$'),
  pin_expiry   timestamptz,
  pin_attempts int not null default 0 check (pin_attempts >= 0)
);

-- 3. audit log: append-only, written by the functions ----------------------------------------
create table public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id),
  actor_id    uuid references public.profiles (id),                     -- null = the system (e.g. stale release)
  event       text not null,
  from_status text,
  to_status   text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);
create index order_events_actor_idx on public.order_events (actor_id);

create function private.events_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'order_events is append-only' using errcode = '42501';
end $$;

create trigger omw_events_append_only before update or delete on public.order_events
  for each row execute function private.events_append_only();

-- 4. reports ---------------------------------------------------------------------------------
create table public.reports (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id),
  reporter_id   uuid not null references public.profiles (id),
  reporter_role text not null check (reporter_role in ('customer', 'courier')),
  reason        text not null check (char_length(reason) between 1 and 80),
  note          text not null default '' check (char_length(note) <= 500),
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index reports_order_idx    on public.reports (order_id);
create index reports_reporter_idx on public.reports (reporter_id);
