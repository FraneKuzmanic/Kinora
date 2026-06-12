create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  cinema_id uuid references public.cinemas(id) on delete set null,
  points int not null,
  reason text not null,
  source_type text not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists points_ledger_user_idx on public.points_ledger(user_id);
create index if not exists points_ledger_cinema_idx on public.points_ledger(cinema_id);

create table if not exists public.reward_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  cinema_id uuid references public.cinemas(id) on delete set null,
  status text not null default 'available'
    check (status in ('available', 'redeemed', 'expired')),
  discount_percent int not null check (discount_percent in (10, 20)),
  max_discount_cents int not null check (max_discount_cents > 0),
  points_cost int not null check (points_cost > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_order_id uuid references public.orders(id) on delete set null
);

create index if not exists reward_coupons_user_idx on public.reward_coupons(user_id);
create index if not exists reward_coupons_status_idx on public.reward_coupons(status);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  cinema_id uuid references public.cinemas(id) on delete cascade,
  badge_key text not null,
  title text not null,
  description text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, cinema_id, badge_key)
);

create unique index if not exists user_badges_global_unique_idx
  on public.user_badges(user_id, badge_key)
  where cinema_id is null;

create index if not exists user_badges_user_idx on public.user_badges(user_id);
