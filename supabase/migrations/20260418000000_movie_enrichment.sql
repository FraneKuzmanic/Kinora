-- Add TMDB integration fields to movies table
ALTER TABLE public.movies
    ADD COLUMN tmdb_id INTEGER UNIQUE,
    ADD COLUMN backdrop_url TEXT;

CREATE INDEX movies_tmdb_id_idx ON public.movies (tmdb_id);

-- done
