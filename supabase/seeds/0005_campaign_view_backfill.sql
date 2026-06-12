-- Backfill synthetic campaign views from existing votes for demo analytics.
-- Target: one view per vote, plus one extra view for every 5th vote.
-- This keeps vote/view conversion around 80-87% instead of impossible >100% rates.

with vote_rows as (
  select
    cv.id,
    cv.campaign_id,
    cv.user_id,
    cv.created_at,
    row_number() over (
      partition by cv.campaign_id
      order by cv.created_at, cv.id
    ) as vote_index,
    count(*) over (partition by cv.campaign_id) as vote_count
  from public.campaign_votes cv
),
existing_views as (
  select
    campaign_id,
    count(*) as view_count
  from public.campaign_views
  group by campaign_id
),
targets as (
  select distinct
    campaign_id,
    vote_count + floor(vote_count / 5.0)::int as target_views,
    coalesce(ev.view_count, 0) as existing_views
  from vote_rows vr
  left join existing_views ev using (campaign_id)
),
candidates as (
  select
    md5('campaign-view-vote-' || id::text) as view_hash,
    campaign_id,
    user_id,
    created_at - interval '10 minutes' as viewed_at,
    vote_index * 2 as sort_order
  from vote_rows

  union all

  select
    md5('campaign-view-extra-' || id::text) as view_hash,
    campaign_id,
    null::uuid as user_id,
    created_at - interval '20 minutes' as viewed_at,
    vote_index * 2 - 1 as sort_order
  from vote_rows
  where vote_index % 5 = 0
),
numbered_candidates as (
  select
    (
      substr(view_hash, 1, 8) || '-' ||
      substr(view_hash, 9, 4) || '-' ||
      substr(view_hash, 13, 4) || '-' ||
      substr(view_hash, 17, 4) || '-' ||
      substr(view_hash, 21, 12)
    )::uuid as id,
    campaign_id,
    user_id,
    viewed_at,
    row_number() over (
      partition by campaign_id
      order by sort_order, view_hash
    ) as candidate_index
  from candidates
)
insert into public.campaign_views (
  id,
  campaign_id,
  user_id,
  viewed_at
)
select
  nc.id,
  nc.campaign_id,
  nc.user_id,
  nc.viewed_at
from numbered_candidates nc
join targets t using (campaign_id)
where nc.candidate_index <= greatest(t.target_views - t.existing_views, 0)
on conflict (id) do nothing;
