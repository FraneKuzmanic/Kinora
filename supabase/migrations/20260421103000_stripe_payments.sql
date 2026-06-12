alter table public.screenings
  add column if not exists ticket_price_cents int not null default 900
  check (ticket_price_cents > 0);

alter table public.campaigns
  add column if not exists ticket_price_cents int not null default 900
  check (ticket_price_cents > 0);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events(event_type);
