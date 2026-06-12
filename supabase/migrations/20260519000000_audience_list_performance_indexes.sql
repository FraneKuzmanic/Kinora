-- Speed up audience discovery reads without moving business logic into the DB.

create index if not exists screenings_audience_active_starts_idx
  on public.screenings (starts_at)
  where status in ('selling', 'confirmed');

create index if not exists campaigns_active_voting_window_idx
  on public.campaigns (voting_ends_at)
  where status = 'voting'
    and voting_starts_at is not null
    and voting_ends_at is not null;
