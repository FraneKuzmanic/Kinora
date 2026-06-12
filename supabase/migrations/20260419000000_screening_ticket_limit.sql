-- Add optional ticket cap to screenings.
-- NULL means the effective cap falls back to the hall's capacity.
ALTER TABLE public.screenings
    ADD COLUMN max_tickets INTEGER;
