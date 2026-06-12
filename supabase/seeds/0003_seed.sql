- Kinora realistic seed expansion layered on top of 0001_demo_seed.sql.
-- This seed also intentionally avoids writing into auth.users.

insert into public.countries (id, iso_code, name)
values
  ('11111111-1111-1111-1111-111111111112', 'SI', 'Slovenia'),
  ('11111111-1111-1111-1111-111111111113', 'AT', 'Austria')
on conflict (iso_code) do nothing;

insert into public.cities (id, country_id, name)
values
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Split'),
  ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Rijeka'),
  ('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111112', 'Ljubljana'),
  ('22222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111113', 'Graz')
on conflict (country_id, name) do nothing;

insert into public.cinemas (id, name, description, website, email, phone)
values
  (
    '33333333-3333-3333-3333-333333333333',
    'Kinora Adriatic Cinema',
    'Coastal cinema focused on weekend marathons and summer classics.',
    'https://kinora.example/adriatic',
    'adriatic@kinora.example',
    '+38510000003'
  ),
  (
    '33333333-3333-3333-3333-333333333334',
    'Kinora Riverside Cinema',
    'Boutique city-center space with curated auteur programs.',
    'https://kinora.example/riverside',
    'riverside@kinora.example',
    '+38510000004'
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
    '44444444-4444-4444-4444-444444444443',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222223',
    'Split Seafront Branch',
    'Obala Hrvatskog narodnog preporoda 12',
    '21000',
    'Europe/Zagreb'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333334',
    '22222222-2222-2222-2222-222222222224',
    'Rijeka Korzo Branch',
    'Korzo 24',
    '51000',
    'Europe/Zagreb'
  ),
  (
    '44444444-4444-4444-4444-444444444445',
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222225',
    'Ljubljana Partner Branch',
    'Trg republike 3',
    '1000',
    'Europe/Ljubljana'
  ),
  (
    '44444444-4444-4444-4444-444444444446',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222226',
    'Graz Seasonal Branch',
    'Herrengasse 18',
    '8010',
    'Europe/Vienna'
  )
on conflict (id) do nothing;

insert into public.cinema_halls (id, location_id, name, capacity)
values
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444442', 'Hall B', 120),
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444443', 'Seaside Hall', 160),
  ('55555555-5555-5555-5555-555555555556', '44444444-4444-4444-4444-444444444444', 'Main Room', 110),
  ('55555555-5555-5555-5555-555555555557', '44444444-4444-4444-4444-444444444445', 'Partner Hall', 150),
  ('55555555-5555-5555-5555-555555555558', '44444444-4444-4444-4444-444444444446', 'Open Air Hall', 200)
on conflict (id) do nothing;

insert into public.movies (
  id,
  title,
  original_title,
  release_year,
  runtime_minutes,
  overview,
  poster_url,
  trailer_url,
  language_code,
  country_code
)
values
  (
    '66666666-6666-6666-6666-666666666665',
    'Whiplash',
    'Whiplash',
    2014,
    106,
    'An ambitious drummer endures intense training from a ruthless instructor.',
    'https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg',
    'https://www.youtube.com/watch?v=7d_jQycdQGo',
    'en',
    'US'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Pan''s Labyrinth',
    'El laberinto del fauno',
    2006,
    118,
    'A young girl escapes into a mythical labyrinth in post-war Spain.',
    'https://image.tmdb.org/t/p/w500/s8B8f5f3N9fJw6x6JfIep6J4f98.jpg',
    'https://www.youtube.com/watch?v=EqYiSlkvRuw',
    'es',
    'ES'
  ),
  (
    '66666666-6666-6666-6666-666666666667',
    'Spirited Away',
    'Sen to Chihiro no Kamikakushi',
    2001,
    125,
    'A girl enters a spirit world and must find a way to free her parents.',
    'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    'https://www.youtube.com/watch?v=ByXuk9QqQkk',
    'ja',
    'JP'
  ),
  (
    '66666666-6666-6666-6666-666666666668',
    'Cinema Paradiso',
    'Nuovo Cinema Paradiso',
    1988,
    155,
    'A filmmaker remembers his childhood and friendship with a projectionist.',
    'https://image.tmdb.org/t/p/w500/8SRUfRUi6x4O68n0VCbDNRa6iGL.jpg',
    'https://www.youtube.com/watch?v=C2-GX0Tltgw',
    'it',
    'IT'
  ),
  (
    '66666666-6666-6666-6666-666666666669',
    'Arrival',
    'Arrival',
    2016,
    116,
    'A linguist is recruited to communicate with extraterrestrial visitors.',
    'https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg',
    'https://www.youtube.com/watch?v=tFMo3UJ4B4g',
    'en',
    'US'
  ),
  (
    '66666666-6666-6666-6666-66666666666a',
    'Portrait of a Lady on Fire',
    'Portrait de la jeune fille en feu',
    2019,
    122,
    'An artist and her subject form a deep connection on an isolated island.',
    'https://image.tmdb.org/t/p/w500/3NtUQxKtn4mY6A4b9Q6v6l6r8Rl.jpg',
    'https://www.youtube.com/watch?v=R-fQPTwma9o',
    'fr',
    'FR'
  ),
  (
    '66666666-6666-6666-6666-66666666666b',
    'The Lives of Others',
    'Das Leben der Anderen',
    2006,
    137,
    'An East German officer surveils artists and gradually questions the regime.',
    'https://image.tmdb.org/t/p/w500/cG6eKD3fX3w2jVvF4NfQfQAtF5D.jpg',
    'https://www.youtube.com/watch?v=n3_iLOp6IhM',
    'de',
    'DE'
  ),
  (
    '66666666-6666-6666-6666-66666666666c',
    'The Handmaiden',
    'Agassi',
    2016,
    145,
    'A conman and a pickpocket plot to defraud a wealthy heiress.',
    'https://image.tmdb.org/t/p/w500/2i1h0sWJmJbJ1iKsFcEYJIhG2kq.jpg',
    'https://www.youtube.com/watch?v=whldChqCsYk',
    'ko',
    'KR'
  )
on conflict (id) do nothing;

insert into public.genres (id, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Drama'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Thriller'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Comedy'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Crime'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'Fantasy'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'Animation'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'Romance')
on conflict (name) do nothing;

insert into public.movie_genres (movie_id, genre_id)
values
  ('66666666-6666-6666-6666-666666666661', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('66666666-6666-6666-6666-666666666661', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  ('66666666-6666-6666-6666-666666666662', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('66666666-6666-6666-6666-666666666662', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7'),
  ('66666666-6666-6666-6666-666666666663', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'),
  ('66666666-6666-6666-6666-666666666664', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
  ('66666666-6666-6666-6666-666666666665', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5'),
  ('66666666-6666-6666-6666-666666666667', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6'),
  ('66666666-6666-6666-6666-666666666668', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('66666666-6666-6666-6666-666666666669', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('66666666-6666-6666-6666-666666666669', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  ('66666666-6666-6666-6666-66666666666a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7'),
  ('66666666-6666-6666-6666-66666666666b', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('66666666-6666-6666-6666-66666666666c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2')
on conflict do nothing;

insert into public.people (id, name)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Bong Joon-ho'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Song Kang-ho'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Wong Kar-wai'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Tony Leung Chiu-wai'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'Wes Anderson'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'Christopher Nolan'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 'Damien Chazelle'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 'Hayao Miyazaki'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9', 'Denis Villeneuve'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba', 'Park Chan-wook')
on conflict (id) do nothing;

insert into public.movie_credits (movie_id, person_id, role, billing_order, character_name)
values
  ('66666666-6666-6666-6666-666666666661', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'director', 1, null),
  ('66666666-6666-6666-6666-666666666661', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'actor', 1, 'Kim Ki-taek'),
  ('66666666-6666-6666-6666-666666666662', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'director', 1, null),
  ('66666666-6666-6666-6666-666666666662', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'actor', 1, 'Chow Mo-wan'),
  ('66666666-6666-6666-6666-666666666663', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'director', 1, null),
  ('66666666-6666-6666-6666-666666666664', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'director', 1, null),
  ('66666666-6666-6666-6666-666666666665', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 'director', 1, null),
  ('66666666-6666-6666-6666-666666666667', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 'director', 1, null),
  ('66666666-6666-6666-6666-666666666669', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9', 'director', 1, null),
  ('66666666-6666-6666-6666-66666666666c', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba', 'director', 1, null)
on conflict do nothing;

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
    '77777777-7777-7777-7777-777777777772',
    '33333333-3333-3333-3333-333333333333',
    '55555555-5555-5555-5555-555555555555',
    'Summer Classics Winner Slot',
    'Resolved campaign for an early-evening weekend slot.',
    'resolved',
    now() - interval '20 days',
    now() - interval '15 days',
    now() + interval '1 day',
    now() + interval '1 day 2 hours 30 minutes',
    95,
    950
  ),
  (
    '77777777-7777-7777-7777-777777777773',
    '33333333-3333-3333-3333-333333333334',
    '55555555-5555-5555-5555-555555555556',
    'Rijeka Autumn Auteur Slot',
    'Draft campaign prepared for next month''s curated voting cycle.',
    'draft',
    now() + interval '12 days',
    now() + interval '16 days',
    now() + interval '20 days',
    now() + interval '20 days 2 hours',
    70,
    800
  )
on conflict (id) do nothing;

insert into public.campaign_movies (id, campaign_id, movie_id, sort_order)
values
  ('88888888-8888-8888-8888-888888888884', '77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666668', 1),
  ('88888888-8888-8888-8888-888888888885', '77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666667', 2),
  ('88888888-8888-8888-8888-888888888886', '77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-66666666666a', 3),
  ('88888888-8888-8888-8888-888888888887', '77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-666666666665', 1),
  ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-666666666669', 2),
  ('88888888-8888-8888-8888-888888888889', '77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-66666666666b', 3)
on conflict (id) do nothing;

update public.campaign_movies
set is_winner = true
where id = '88888888-8888-8888-8888-888888888884';

update public.campaigns
set
  winning_movie_id = '66666666-6666-6666-6666-666666666668',
  resolved_at = now() - interval '14 days'
where id = '77777777-7777-7777-7777-777777777772';

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
  ticket_price_cents
)
values
  (
    '99999999-9999-9999-9999-999999999992',
    '33333333-3333-3333-3333-333333333333',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666668',
    '77777777-7777-7777-7777-777777777772',
    'scheduled',
    now() + interval '1 day',
    now() + interval '1 day 2 hours 30 minutes',
    7,
    95,
    950
  ),
  (
    '99999999-9999-9999-9999-999999999993',
    '33333333-3333-3333-3333-333333333331',
    '55555555-5555-5555-5555-555555555552',
    '66666666-6666-6666-6666-666666666665',
    null,
    'selling',
    now() + interval '4 days',
    now() + interval '4 days 1 hour 46 minutes',
    7,
    60,
    750
  ),
  (
    '99999999-9999-9999-9999-999999999994',
    '33333333-3333-3333-3333-333333333334',
    '55555555-5555-5555-5555-555555555556',
    '66666666-6666-6666-6666-66666666666b',
    null,
    'scheduled',
    now() + interval '9 days',
    now() + interval '9 days 2 hours 17 minutes',
    7,
    70,
    850
  )
on conflict (id) do nothing;

insert into public.movie_recommendations (
  id,
  user_id,
  cinema_id,
  city_id,
  movie_id,
  title,
  message,
  status
)
values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    null,
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222222',
    '66666666-6666-6666-6666-666666666669',
    'More intelligent sci-fi nights',
    'Strong engagement around thought-provoking science fiction.',
    'new'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    null,
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222223',
    '66666666-6666-6666-6666-666666666668',
    'Classics keep overperforming',
    'Classic restoration screenings are selling steadily across weekends.',
    'reviewed'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc3',
    null,
    '33333333-3333-3333-3333-333333333334',
    '22222222-2222-2222-2222-222222222224',
    null,
    'Add curated German drama cycle',
    'Audience search and page-view patterns suggest interest in German drama titles.',
    'accepted'
  )
on conflict (id) do nothing;

insert into public.email_outbox (
  id,
  to_email,
  template_key,
  payload,
  status,
  provider_message_id
)
values
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'demo.audience@kinora.example',
    'campaign_voting_opened',
    '{"campaignId":"77777777-7777-7777-7777-777777777771","cinemaId":"33333333-3333-3333-3333-333333333331"}'::jsonb,
    'queued',
    null
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd2',
    'partner.manager@kinora.example',
    'campaign_resolved',
    '{"campaignId":"77777777-7777-7777-7777-777777777772","winningMovieId":"66666666-6666-6666-6666-666666666668"}'::jsonb,
    'sent',
    'msg_kinora_demo_001'
  )
on conflict (id) do nothing;

insert into public.event_page_views (
  id,
  user_id,
  session_id,
  entity_type,
  entity_id,
  occurred_at,
  referrer,
  user_agent,
  properties
)
values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
    null,
    'aaaaaaaa-1111-1111-1111-111111111111',
    'campaign',
    '77777777-7777-7777-7777-777777777771',
    now() - interval '2 hours',
    'https://kinora.example/home',
    'Mozilla/5.0',
    '{"source":"homepage_banner"}'::jsonb
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
    null,
    'aaaaaaaa-1111-1111-1111-111111111111',
    'movie',
    '66666666-6666-6666-6666-666666666661',
    now() - interval '110 minutes',
    'https://kinora.example/campaigns/77777777-7777-7777-7777-777777777771',
    'Mozilla/5.0',
    '{"source":"campaign_detail"}'::jsonb
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3',
    null,
    'aaaaaaaa-2222-2222-2222-222222222222',
    'screening',
    '99999999-9999-9999-9999-999999999991',
    now() - interval '80 minutes',
    'https://kinora.example/movies/66666666-6666-6666-6666-666666666664',
    'Mozilla/5.0',
    '{"source":"movie_detail"}'::jsonb
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4',
    null,
    'aaaaaaaa-3333-3333-3333-333333333333',
    'cinema',
    '33333333-3333-3333-3333-333333333333',
    now() - interval '45 minutes',
    'https://kinora.example/cinemas',
    'Mozilla/5.0',
    '{"source":"city_filter"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.event_shares (
  id,
  user_id,
  entity_type,
  entity_id,
  channel,
  occurred_at,
  properties
)
values
  (
    'ffffffff-ffff-ffff-ffff-fffffffffff1',
    null,
    'campaign',
    '77777777-7777-7777-7777-777777777771',
    'instagram',
    now() - interval '70 minutes',
    '{"utmCampaign":"may_prime_slot"}'::jsonb
  ),
  (
    'ffffffff-ffff-ffff-ffff-fffffffffff2',
    null,
    'screening',
    '99999999-9999-9999-9999-999999999993',
    'whatsapp',
    now() - interval '30 minutes',
    '{"groupSizeHint":4}'::jsonb
  )
on conflict (id) do nothing;

insert into public.event_searches (
  id,
  user_id,
  query,
  filters,
  results_count,
  occurred_at
)
values
  (
    '12121212-1212-1212-1212-121212121211',
    null,
    'thriller korea',
    '{"city":"Zagreb","dateRange":"next_7_days"}'::jsonb,
    5,
    now() - interval '40 minutes'
  ),
  (
    '12121212-1212-1212-1212-121212121212',
    null,
    'weekend classics split',
    '{"city":"Split","availability":"all"}'::jsonb,
    7,
    now() - interval '10 minutes'
  )
on conflict (id) do nothing;
