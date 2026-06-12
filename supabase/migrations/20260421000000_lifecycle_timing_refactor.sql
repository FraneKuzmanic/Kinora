-- Lifecycle timing refactor:
-- - voting starts at publish time (campaign durations drive voting window)
-- - explicit screening sales window timestamps removed
-- - pending screening state with grace expiry introduced

ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS voting_duration_days INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN IF NOT EXISTS decision_days_before_screening INTEGER NOT NULL DEFAULT 7;

ALTER TABLE public.campaigns
    ALTER COLUMN voting_starts_at DROP NOT NULL,
    ALTER COLUMN voting_ends_at DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'campaigns'
          AND column_name = 'voting_starts_at'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'campaigns'
          AND column_name = 'voting_ends_at'
    ) THEN
        UPDATE public.campaigns
        SET voting_duration_days = GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (voting_ends_at - voting_starts_at)) / 86400.0)::INTEGER
        )
        WHERE voting_starts_at IS NOT NULL
          AND voting_ends_at IS NOT NULL;
    END IF;
END $$;

ALTER TABLE public.screenings
    ADD COLUMN IF NOT EXISTS decision_days_before_start INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'screening_status'
          AND e.enumlabel = 'pending'
    ) THEN
        ALTER TYPE public.screening_status ADD VALUE 'pending';
    END IF;
END $$;

ALTER TABLE public.screenings
    DROP COLUMN IF EXISTS sales_starts_at,
    DROP COLUMN IF EXISTS sales_ends_at;

CREATE INDEX IF NOT EXISTS screenings_pending_expires_idx
    ON public.screenings (pending_expires_at)
    WHERE status = 'pending';

