create table if not exists public.campaign_views (
    id          uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    user_id     uuid references auth.users(id),
    viewed_at   timestamptz not null default now()
);

create index if not exists idx_campaign_views_campaign_id on public.campaign_views(campaign_id);
create index if not exists idx_campaign_views_viewed_at   on public.campaign_views(viewed_at);
