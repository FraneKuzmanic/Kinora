create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('audience', 'cinema_admin', 'validator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('draft', 'voting', 'resolved', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.screening_status as enum ('scheduled', 'selling', 'confirmed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'requires_capture', 'paid', 'cancelled', 'refunded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'requires_payment_method',
    'requires_confirmation',
    'requires_capture',
    'processing',
    'succeeded',
    'cancelled',
    'refunded',
    'partially_refunded',
    'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.refund_status as enum ('requested', 'processing', 'succeeded', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admission_type as enum ('screening_ticket', 'campaign_earlybird');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admission_status as enum (
    'pending_outcome',
    'active',
    'lost_refund_pending',
    'lost_no_refund',
    'refunded',
    'void',
    'used'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loss_decision as enum ('pending', 'refund', 'no_refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.private_booking_status as enum (
    'submitted',
    'in_review',
    'offered',
    'rejected',
    'accepted',
    'paid',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recommendation_status as enum ('new', 'reviewed', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_status as enum ('queued', 'sent', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entity_type as enum ('movie', 'cinema', 'campaign', 'screening');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movie_credit_role as enum ('director', 'writer', 'actor');
exception when duplicate_object then null; end $$;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references public.countries(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'audience',
  display_name text,
  phone text,
  home_city_id uuid references public.cities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.cinemas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  website text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cinemas_name_lower_idx on public.cinemas ((lower(name)));

create table if not exists public.cinema_locations (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  city_id uuid references public.cities(id) on delete set null,
  location_name text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  lat numeric(9,6),
  lon numeric(9,6),
  timezone text not null default 'Europe/Zagreb',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cinema_locations_cinema_idx on public.cinema_locations(cinema_id);
create index if not exists cinema_locations_city_idx on public.cinema_locations(city_id);

create table if not exists public.cinema_halls (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.cinema_locations(id) on delete cascade,
  name text not null,
  capacity int not null check (capacity > 0),
  allow_private_booking boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists cinema_halls_location_idx on public.cinema_halls(location_id);

create table if not exists public.cinema_memberships (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  membership_role text not null default 'admin',
  created_at timestamptz not null default now(),
  unique (cinema_id, user_id)
);

create table if not exists public.cinema_validator_permissions (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  validator_user_id uuid not null references public.profiles(user_id) on delete cascade,
  granted_by_user_id uuid references public.profiles(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (cinema_id, validator_user_id)
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_title text,
  release_year int,
  runtime_minutes int,
  overview text,
  poster_url text,
  trailer_url text,
  language_code text,
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movies_title_lower_idx on public.movies ((lower(title)));

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.movie_genres (
  movie_id uuid not null references public.movies(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete restrict,
  primary key (movie_id, genre_id)
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists people_name_lower_idx on public.people ((lower(name)));

create table if not exists public.movie_credits (
  movie_id uuid not null references public.movies(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role public.movie_credit_role not null,
  billing_order int,
  character_name text,
  created_at timestamptz not null default now(),
  primary key (movie_id, person_id, role)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  hall_id uuid not null references public.cinema_halls(id) on delete restrict,
  title text not null,
  description text,
  status public.campaign_status not null default 'draft',
  voting_starts_at timestamptz not null,
  voting_ends_at timestamptz not null,
  slot_starts_at timestamptz not null,
  slot_ends_at timestamptz not null,
  min_tickets_to_confirm int not null check (min_tickets_to_confirm > 0),
  winning_movie_id uuid references public.movies(id) on delete set null,
  resolved_at timestamptz,
  created_by_user_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (voting_ends_at > voting_starts_at),
  check (slot_ends_at > slot_starts_at),
  check (voting_ends_at < slot_starts_at)
);

create index if not exists campaigns_status_idx on public.campaigns(status);
create index if not exists campaigns_hall_slot_idx on public.campaigns(hall_id, slot_starts_at);

create table if not exists public.campaign_movies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete restrict,
  sort_order int not null default 0,
  is_winner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, movie_id),
  unique (id, campaign_id)
);

create unique index if not exists campaign_movies_one_winner_idx
  on public.campaign_movies (campaign_id)
  where is_winner;

create table if not exists public.campaign_votes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_movie_id uuid not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id),
  foreign key (campaign_movie_id, campaign_id)
    references public.campaign_movies(id, campaign_id)
    on delete restrict
);

create index if not exists campaign_votes_campaign_idx on public.campaign_votes(campaign_id);
create index if not exists campaign_votes_movie_idx on public.campaign_votes(campaign_movie_id);

create table if not exists public.screenings (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  hall_id uuid not null references public.cinema_halls(id) on delete restrict,
  movie_id uuid not null references public.movies(id) on delete restrict,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status public.screening_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sales_starts_at timestamptz,
  sales_ends_at timestamptz,
  min_tickets_to_confirm int not null check (min_tickets_to_confirm > 0),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by_user_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (sales_ends_at is null or sales_starts_at is null or sales_ends_at > sales_starts_at)
);

create unique index if not exists screenings_unique_hall_start_idx
  on public.screenings(hall_id, starts_at)
  where cancelled_at is null;

create unique index if not exists screenings_unique_campaign_idx
  on public.screenings(campaign_id)
  where campaign_id is not null;

create index if not exists screenings_status_idx on public.screenings(status);
create index if not exists screenings_starts_at_idx on public.screenings(starts_at);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.profiles(user_id) on delete restrict,
  status public.order_status not null default 'pending',
  currency text not null default 'EUR',
  subtotal_cents int not null check (subtotal_cents >= 0),
  fees_cents int not null default 0 check (fees_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_buyer_idx on public.orders(buyer_user_id);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_intent_id text not null,
  provider_charge_id text,
  status public.payment_status not null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null,
  authorized_at timestamptz,
  captured_at timestamptz,
  failure_code text,
  failure_message text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_intent_id)
);

create index if not exists payments_order_idx on public.payments(order_id);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  provider_refund_id text,
  status public.refund_status not null default 'requested',
  amount_cents int not null check (amount_cents >= 0),
  reason text,
  requested_by_user_id uuid references public.profiles(user_id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  unique (provider_refund_id)
);

create index if not exists refunds_payment_idx on public.refunds(payment_id);

create table if not exists public.refund_lines (
  refund_id uuid not null references public.refunds(id) on delete cascade,
  admission_id uuid not null,
  amount_cents int not null check (amount_cents >= 0),
  primary key (refund_id, admission_id)
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  buyer_user_id uuid not null references public.profiles(user_id) on delete restrict,
  type public.admission_type not null,
  screening_id uuid references public.screenings(id) on delete set null,
  campaign_movie_id uuid references public.campaign_movies(id) on delete set null,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  total_price_cents int not null check (total_price_cents >= 0),
  status public.admission_status not null default 'active',
  loss_decision public.loss_decision not null default 'pending',
  loss_decided_at timestamptz,
  qr_token text not null unique,
  qr_generated_at timestamptz,
  pdf_path text,
  created_at timestamptz not null default now(),
  check (
    (type = 'screening_ticket'::public.admission_type and screening_id is not null and campaign_movie_id is null)
    or
    (type = 'campaign_earlybird'::public.admission_type and campaign_movie_id is not null)
  )
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'refund_lines_admission_id_fkey'
  ) then
    alter table public.refund_lines
      add constraint refund_lines_admission_id_fkey
      foreign key (admission_id) references public.admissions(id) on delete cascade;
  end if;
end $$;

create index if not exists admissions_screening_idx on public.admissions(screening_id);
create index if not exists admissions_campaign_movie_idx on public.admissions(campaign_movie_id);
create index if not exists admissions_buyer_idx on public.admissions(buyer_user_id);
create index if not exists admissions_status_idx on public.admissions(status);

create table if not exists public.admission_redemptions (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  validator_user_id uuid not null references public.profiles(user_id) on delete restrict,
  location_id uuid references public.cinema_locations(id) on delete set null,
  hall_id uuid references public.cinema_halls(id) on delete set null,
  device_info jsonb not null default '{}'::jsonb,
  unique (admission_id)
);

create index if not exists admission_redemptions_validator_idx on public.admission_redemptions(validator_user_id);

create table if not exists public.private_booking_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles(user_id) on delete cascade,
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  preferred_location_id uuid references public.cinema_locations(id) on delete set null,
  preferred_start_at timestamptz,
  preferred_end_at timestamptz,
  group_size int not null check (group_size > 0),
  notes text,
  status public.private_booking_status not null default 'submitted',
  offered_location_id uuid references public.cinema_locations(id) on delete set null,
  offered_hall_id uuid references public.cinema_halls(id) on delete set null,
  offered_start_at timestamptz,
  offered_end_at timestamptz,
  quoted_price_cents int check (quoted_price_cents is null or quoted_price_cents >= 0),
  currency text not null default 'EUR',
  cinema_response_message text,
  responded_by_user_id uuid references public.profiles(user_id) on delete set null,
  responded_at timestamptz,
  accepted_at timestamptz,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_end_at is null or preferred_start_at is null or preferred_end_at > preferred_start_at),
  check (offered_end_at is null or offered_start_at is null or offered_end_at > offered_start_at)
);

create index if not exists private_booking_cinema_idx on public.private_booking_requests(cinema_id);
create index if not exists private_booking_requester_idx on public.private_booking_requests(requester_user_id);
create index if not exists private_booking_status_idx on public.private_booking_requests(status);

create table if not exists public.movie_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  cinema_id uuid references public.cinemas(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  movie_id uuid references public.movies(id) on delete set null,
  title text,
  message text,
  status public.recommendation_status not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_status not null default 'queued',
  provider_message_id text,
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_outbox_status_idx on public.email_outbox(status);

create table if not exists public.event_page_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  session_id uuid,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  occurred_at timestamptz not null default now(),
  referrer text,
  user_agent text,
  properties jsonb not null default '{}'::jsonb
);

create index if not exists event_page_views_entity_idx on public.event_page_views(entity_type, entity_id);
create index if not exists event_page_views_time_idx on public.event_page_views(occurred_at);

create table if not exists public.event_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  channel text not null,
  occurred_at timestamptz not null default now(),
  properties jsonb not null default '{}'::jsonb
);

create index if not exists event_shares_entity_idx on public.event_shares(entity_type, entity_id);

create table if not exists public.event_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  results_count int,
  occurred_at timestamptz not null default now()
);

create index if not exists event_searches_time_idx on public.event_searches(occurred_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists cinemas_set_updated_at on public.cinemas;
create trigger cinemas_set_updated_at
before update on public.cinemas
for each row execute function public.set_updated_at();

drop trigger if exists cinema_locations_set_updated_at on public.cinema_locations;
create trigger cinema_locations_set_updated_at
before update on public.cinema_locations
for each row execute function public.set_updated_at();

drop trigger if exists cinema_halls_set_updated_at on public.cinema_halls;
create trigger cinema_halls_set_updated_at
before update on public.cinema_halls
for each row execute function public.set_updated_at();

drop trigger if exists movies_set_updated_at on public.movies;
create trigger movies_set_updated_at
before update on public.movies
for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists screenings_set_updated_at on public.screenings;
create trigger screenings_set_updated_at
before update on public.screenings
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists private_booking_requests_set_updated_at on public.private_booking_requests;
create trigger private_booking_requests_set_updated_at
before update on public.private_booking_requests
for each row execute function public.set_updated_at();

create or replace function public.validate_hall_cinema_consistency()
returns trigger
language plpgsql
as $$
declare
  hall_cinema_id uuid;
begin
  select cl.cinema_id into hall_cinema_id
  from public.cinema_halls h
  join public.cinema_locations cl on cl.id = h.location_id
  where h.id = new.hall_id;

  if hall_cinema_id is null then
    raise exception 'Hall % does not exist or has no location', new.hall_id;
  end if;

  if hall_cinema_id <> new.cinema_id then
    raise exception 'Hall % does not belong to cinema %', new.hall_id, new.cinema_id;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_validate_hall_cinema on public.campaigns;
create trigger campaigns_validate_hall_cinema
before insert or update of hall_id, cinema_id on public.campaigns
for each row execute function public.validate_hall_cinema_consistency();

drop trigger if exists screenings_validate_hall_cinema on public.screenings;
create trigger screenings_validate_hall_cinema
before insert or update of hall_id, cinema_id on public.screenings
for each row execute function public.validate_hall_cinema_consistency();

create or replace function public.validate_private_booking_links()
returns trigger
language plpgsql
as $$
declare
  preferred_location_cinema uuid;
  offered_location_cinema uuid;
  offered_hall_location uuid;
begin
  if new.preferred_location_id is not null then
    select cinema_id into preferred_location_cinema
    from public.cinema_locations
    where id = new.preferred_location_id;

    if preferred_location_cinema is null or preferred_location_cinema <> new.cinema_id then
      raise exception 'preferred_location_id must belong to cinema_id';
    end if;
  end if;

  if new.offered_location_id is not null then
    select cinema_id into offered_location_cinema
    from public.cinema_locations
    where id = new.offered_location_id;

    if offered_location_cinema is null or offered_location_cinema <> new.cinema_id then
      raise exception 'offered_location_id must belong to cinema_id';
    end if;
  end if;

  if new.offered_hall_id is not null then
    select location_id into offered_hall_location
    from public.cinema_halls
    where id = new.offered_hall_id;

    if offered_hall_location is null then
      raise exception 'offered_hall_id is invalid';
    end if;

    if new.offered_location_id is not null and offered_hall_location <> new.offered_location_id then
      raise exception 'offered_hall_id must belong to offered_location_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists private_booking_validate_links on public.private_booking_requests;
create trigger private_booking_validate_links
before insert or update of cinema_id, preferred_location_id, offered_location_id, offered_hall_id
on public.private_booking_requests
for each row execute function public.validate_private_booking_links();

create or replace view public.v_campaign_movie_tallies as
select
  cm.campaign_id,
  cm.id as campaign_movie_id,
  cm.movie_id,
  count(cv.id) as vote_count,
  coalesce(sum(a.quantity) filter (
    where a.type = 'campaign_earlybird'::public.admission_type
      and a.status <> 'refunded'::public.admission_status
      and a.status <> 'void'::public.admission_status
  ), 0) as earlybird_qty
from public.campaign_movies cm
left join public.campaign_votes cv
  on cv.campaign_movie_id = cm.id
left join public.admissions a
  on a.campaign_movie_id = cm.id
group by cm.campaign_id, cm.id, cm.movie_id;

create or replace view public.v_screening_sales as
select
  s.id as screening_id,
  s.min_tickets_to_confirm,
  coalesce(sum(a.quantity) filter (
    where a.status in ('active'::public.admission_status, 'used'::public.admission_status)
      and a.screening_id = s.id
      and a.type in ('screening_ticket'::public.admission_type, 'campaign_earlybird'::public.admission_type)
  ), 0) as tickets_sold
from public.screenings s
left join public.admissions a
  on a.screening_id = s.id
group by s.id, s.min_tickets_to_confirm;
