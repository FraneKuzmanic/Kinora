-- Store optional ticket cap on campaigns so it can be forwarded to the
-- auto-created screening when the campaign resolves.
-- NULL means the screening falls back to the hall's capacity.
ALTER TABLE public.campaigns
    ADD COLUMN max_tickets INTEGER;
