-- Kinora demo seed for local/dev environments.
-- This seed intentionally avoids writing into auth.users.

insert into public.countries (id, iso_code, name)
values
  ('11111111-1111-1111-1111-111111111111', 'HR', 'Croatia')
on conflict (iso_code) do nothing;

insert into public.cities (id, country_id, name)
values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Zagreb')
on conflict (country_id, name) do nothing;

insert into public.cinemas (id, name, description, website, email, phone)
values
  (
    '33333333-3333-3333-3333-333333333331',
    'Kinora Downtown Cinema',
    'Central city location focused on indie and audience-voted screenings.',
    'https://kinora.example/downtown',
    'downtown@kinora.example',
    '+38510000001'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    'Kinora Arena Cinema',
    'Larger format hall with event-driven programming and private rentals.',
    'https://kinora.example/arena',
    'arena@kinora.example',
    '+38510000002'
  )
on conflict (id) do nothing;

insert into public.cinema_locations (
  id,
  cinema_id,
  city_id,
  location_name,
  address_line1,
  postal_code,
  timezone
)
values
  (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222222',
    'Downtown Branch',
    'Ilica 10',
    '10000',
    'Europe/Zagreb'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222',
    'Arena Branch',
    'Ul. Vice Vukova 6',
    '10000',
    'Europe/Zagreb'
  )
on conflict (id) do nothing;

insert into public.cinema_halls (id, location_id, name, capacity)
values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444441', 'Hall 1', 140),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444441', 'Hall 2', 90),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444442', 'Hall A', 220)
on conflict (id) do nothing;

insert into public.movies (id, title, release_year, runtime_minutes, language_code, country_code)
values
  ('66666666-6666-6666-6666-666666666661', 'Parasite', 2019, 132, 'ko', 'KR'),
  ('66666666-6666-6666-6666-666666666662', 'In the Mood for Love', 2000, 98, 'zh', 'HK'),
  ('66666666-6666-6666-6666-666666666663', 'The Grand Budapest Hotel', 2014, 100, 'en', 'US'),
  ('66666666-6666-6666-6666-666666666664', 'The Dark Knight', 2008, 152, 'en', 'US')
on conflict (id) do nothing;

insert into public.campaigns (
  id,
  cinema_id,
  hall_id,
  title,
  description,
  status,
  voting_starts_at,
  voting_ends_at,
  slot_starts_at,
  slot_ends_at,
  min_tickets_to_confirm,
  ticket_price_cents
)
values
  (
    '77777777-7777-7777-7777-777777777771',
    '33333333-3333-3333-3333-333333333331',
    '55555555-5555-5555-5555-555555555551',
    'Audience Choice: May Friday Prime Slot',
    'Vote for the Friday evening screening in Hall 1.',
    'voting',
    now() - interval '1 day',
    now() + interval '3 days',
    now() + interval '6 days',
    now() + interval '6 days 2 hours',
    80,
    850
  )
on conflict (id) do nothing;

insert into public.campaign_movies (id, campaign_id, movie_id, sort_order)
values
  ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666661', 1),
  ('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666662', 2),
  ('88888888-8888-8888-8888-888888888883', '77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666663', 3)
on conflict (id) do nothing;

insert into public.screenings (
  id,
  cinema_id,
  hall_id,
  movie_id,
  status,
  starts_at,
  ends_at,
  decision_days_before_start,
  min_tickets_to_confirm,
  ticket_price_cents
)
values
  (
    '99999999-9999-9999-9999-999999999991',
    '33333333-3333-3333-3333-333333333332',
    '55555555-5555-5555-5555-555555555553',
    '66666666-6666-6666-6666-666666666664',
    'selling',
    now() + interval '2 days',
    now() + interval '2 days 2 hours 30 minutes',
    7,
    120,
    900
  )
on conflict (id) do nothing;

