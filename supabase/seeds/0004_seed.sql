-- Additional lifecycle timing seed rows for duration-based voting and pending screening flow.
-- Apply after 20260421000000_lifecycle_timing_refactor.sql.

insert into public.campaigns (
  id,
  cinema_id,
  hall_id,
  title,
  description,
  status,
  voting_starts_at,
  voting_ends_at,
  voting_duration_days,
  slot_starts_at,
  slot_ends_at,
  decision_days_before_screening,
  min_tickets_to_confirm,
  max_tickets
)
values
  (
    '77777777-7777-7777-7777-777777777774',
    '33333333-3333-3333-3333-333333333331',
    '55555555-5555-5555-5555-555555555551',
    'Published Duration-Based Voting Demo',
    'Campaign seeded with publish-driven voting window fields.',
    'voting',
    now() - interval '1 day',
    now() + interval '6 days',
    7,
    now() + interval '14 days',
    now() + interval '14 days 2 hours',
    7,
    60,
    null
  )
on conflict (id) do nothing;

insert into public.screenings (
  id,
  cinema_id,
  hall_id,
  movie_id,
  campaign_id,
  status,
  starts_at,
  ends_at,
  decision_days_before_start,
  min_tickets_to_confirm,
  max_tickets,
  pending_at,
  pending_expires_at
)
values
  (
    '99999999-9999-9999-9999-999999999995',
    '33333333-3333-3333-3333-333333333331',
    '55555555-5555-5555-5555-555555555551',
    '66666666-6666-6666-6666-666666666661',
    null,
    'pending',
    now() + interval '20 days',
    now() + interval '20 days 2 hours',
    7,
    80,
    120,
    now() - interval '2 days',
    now() + interval '10 days'
  )
on conflict (id) do nothing;

