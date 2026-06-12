-- =============================================================================
-- KINORA SEED FILE
-- Generated: 2026-04-16
-- Covers: countries, cities, genres, movies, movie_genres, cinemas,
--         cinema_locations
-- =============================================================================


-- -----------------------------------------------------------------------------
-- COUNTRIES
-- -----------------------------------------------------------------------------

INSERT INTO countries (id, iso_code, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'HR', 'Croatia')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- CITIES
-- -----------------------------------------------------------------------------

INSERT INTO cities (id, country_id, name) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Zagreb')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- GENRES
-- -----------------------------------------------------------------------------

INSERT INTO genres (id, name) VALUES
  ('aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', 'Drama'),
  ('aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', 'Thriller'),
  ('aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', 'Comedy'),
  ('aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa', 'Action'),
  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa', 'Sci-Fi'),
  ('aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa', 'Horror'),
  ('aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa', 'Romance'),
  ('aaaaaaaa-0008-0008-0008-aaaaaaaaaaaa', 'Animation')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- MOVIES (original 4 — already in DB from earlier seed)
-- -----------------------------------------------------------------------------

INSERT INTO movies (id, title, original_title, release_year, runtime_minutes, language_code, country_code) VALUES
  ('66666666-6666-6666-6666-666666666661', 'Parasite',              NULL,        2019, 132, 'ko', 'KR'),
  ('66666666-6666-6666-6666-666666666662', 'In the Mood for Love',  NULL,        2000,  98, 'zh', 'HK'),
  ('66666666-6666-6666-6666-666666666663', 'The Grand Budapest Hotel', NULL,     2014, 100, 'en', 'US'),
  ('66666666-6666-6666-6666-666666666664', 'The Dark Knight',       NULL,        2008, 152, 'en', 'US')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- MOVIES (8 new movies added for genre coverage)
-- -----------------------------------------------------------------------------

INSERT INTO movies (id, title, original_title, release_year, runtime_minutes, overview, language_code, country_code) VALUES
  (
    'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb',
    'Mad Max: Fury Road', 'Mad Max: Fury Road', 2015, 120,
    'In a post-apocalyptic wasteland, Max teams up with Furiosa to flee a cult leader and his army across the desert.',
    'en', 'AU'
  ),
  (
    'bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb',
    'Interstellar', 'Interstellar', 2014, 169,
    'A team of explorers travels through a wormhole in space in an attempt to ensure humanity''s survival.',
    'en', 'US'
  ),
  (
    'bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb',
    'Hereditary', 'Hereditary', 2018, 127,
    'After the family matriarch passes away, a grieving family is haunted by increasing disturbing and demonic presences.',
    'en', 'US'
  ),
  (
    'bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb',
    'The Lobster', 'The Lobster', 2015, 119,
    'In a dystopian future, single people must find a romantic partner within 45 days or be transformed into animals.',
    'en', 'IE'
  ),
  (
    'bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb',
    'Spider-Man: Into the Spider-Verse', 'Spider-Man: Into the Spider-Verse', 2018, 117,
    'Teen Miles Morales becomes Spider-Man of his reality and teams up with counterparts from other dimensions.',
    'en', 'US'
  ),
  (
    'bbbbbbbb-0006-0006-0006-bbbbbbbbbbbb',
    'Arrival', 'Arrival', 2016, 116,
    'A linguist is recruited to communicate with alien lifeforms after mysterious spacecrafts appear around the world.',
    'en', 'US'
  ),
  (
    'bbbbbbbb-0007-0007-0007-bbbbbbbbbbbb',
    'Portrait of a Lady on Fire', 'Portrait de la jeune fille en feu', 2019, 122,
    'In 18th century France, a painter falls in love with the woman whose portrait she is commissioned to paint.',
    'fr', 'FR'
  ),
  (
    'bbbbbbbb-0008-0008-0008-bbbbbbbbbbbb',
    'Gone Girl', 'Gone Girl', 2014, 149,
    'With his wife''s disappearance having become the focus of an intense media circus, a man sees the spotlight shift on him.',
    'en', 'US'
  )
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- MOVIE_GENRES
-- Original 4 movies
-- -----------------------------------------------------------------------------

INSERT INTO movie_genres (movie_id, genre_id) VALUES
  -- Parasite → Drama, Thriller
  ('66666666-6666-6666-6666-666666666661', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  ('66666666-6666-6666-6666-666666666661', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa'),
  -- In the Mood for Love → Drama, Romance
  ('66666666-6666-6666-6666-666666666662', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  ('66666666-6666-6666-6666-666666666662', 'aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa'),
  -- The Grand Budapest Hotel → Comedy, Drama
  ('66666666-6666-6666-6666-666666666663', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa'),
  ('66666666-6666-6666-6666-666666666663', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  -- The Dark Knight → Action, Thriller
  ('66666666-6666-6666-6666-666666666664', 'aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa'),
  ('66666666-6666-6666-6666-666666666664', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa')
ON CONFLICT DO NOTHING;

-- New 8 movies
INSERT INTO movie_genres (movie_id, genre_id) VALUES
  -- Mad Max: Fury Road → Action
  ('bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb', 'aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa'),
  -- Interstellar → Sci-Fi, Drama
  ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', 'aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa'),
  ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  -- Hereditary → Horror, Drama
  ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', 'aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa'),
  ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  -- The Lobster → Comedy, Sci-Fi
  ('bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa'),
  ('bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb', 'aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa'),
  -- Spider-Man: Into the Spider-Verse → Animation, Action
  ('bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb', 'aaaaaaaa-0008-0008-0008-aaaaaaaaaaaa'),
  ('bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb', 'aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa'),
  -- Arrival → Sci-Fi, Drama
  ('bbbbbbbb-0006-0006-0006-bbbbbbbbbbbb', 'aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa'),
  ('bbbbbbbb-0006-0006-0006-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  -- Portrait of a Lady on Fire → Romance, Drama
  ('bbbbbbbb-0007-0007-0007-bbbbbbbbbbbb', 'aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa'),
  ('bbbbbbbb-0007-0007-0007-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'),
  -- Gone Girl → Thriller, Drama
  ('bbbbbbbb-0008-0008-0008-bbbbbbbbbbbb', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa'),
  ('bbbbbbbb-0008-0008-0008-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa')
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- CINEMAS (4 real Zagreb cinemas)
-- -----------------------------------------------------------------------------

INSERT INTO cinemas (id, name, description, website, email, phone, is_active) VALUES
  (
    'cccccccc-0001-0001-0001-cccccccccccc',
    'Kino Europa',
    'One of Zagreb''s oldest and most beloved arthouse cinemas, located in the city centre, known for curated indie and European films.',
    'https://www.kino-europa.hr', 'info@kino-europa.hr', '+385 1 4922 554',
    true
  ),
  (
    'cccccccc-0002-0002-0002-cccccccccccc',
    'Cinestar Zagreb (Branimir Centar)',
    'A major multiplex inside the Branimir shopping centre, offering the latest Hollywood blockbusters on multiple screens.',
    'https://www.blitz-cinestar.hr', 'info@blitz-cinestar.hr', '+385 1 6600 600',
    true
  ),
  (
    'cccccccc-0003-0003-0003-cccccccccccc',
    'Cineplexx Avenue Mall',
    'Modern multiplex cinema in Avenue Mall with premium screens and a wide selection of mainstream and international titles.',
    'https://www.cineplexx.hr', 'zagreb@cineplexx.hr', '+385 1 2300 600',
    true
  ),
  (
    'cccccccc-0004-0004-0004-cccccccccccc',
    'HNK Kino (Kino Tuškanac)',
    'A charming outdoor and indoor cinema nestled in Tuškanac forest park, popular for summer screenings and film festivals.',
    'https://www.kinotuskanac.hr', 'info@kinotuskanac.hr', '+385 1 4814 722',
    true
  )
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- CINEMA_LOCATIONS
-- -----------------------------------------------------------------------------

INSERT INTO cinema_locations (id, cinema_id, city_id, location_name, address_line1, postal_code, lat, lon, timezone, is_active) VALUES
  (
    'dddddddd-0001-0001-0001-dddddddddddd',
    'cccccccc-0001-0001-0001-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'Kino Europa - Varšavska', 'Varšavska ulica 3', '10000',
    45.8125, 15.9726, 'Europe/Zagreb', true
  ),
  (
    'dddddddd-0002-0002-0002-dddddddddddd',
    'cccccccc-0002-0002-0002-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'CineStar Branimir', 'Branimirova ulica 29', '10000',
    45.8044, 15.9991, 'Europe/Zagreb', true
  ),
  (
    'dddddddd-0003-0003-0003-dddddddddddd',
    'cccccccc-0003-0003-0003-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'Cineplexx Avenue Mall', 'Avenija Dubrovnik 16', '10020',
    45.7800, 16.0280, 'Europe/Zagreb', true
  ),
  (
    'dddddddd-0004-0004-0004-dddddddddddd',
    'cccccccc-0004-0004-0004-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'Kino Tuškanac', 'Tuškanac 1', '10000',
    45.8167, 15.9650, 'Europe/Zagreb', true
  )
ON CONFLICT (id) DO NOTHING;
