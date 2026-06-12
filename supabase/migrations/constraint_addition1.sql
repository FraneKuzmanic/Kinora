do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_winning_movie_candidate_fkey'
  ) then
    alter table public.campaigns
      add constraint campaigns_winning_movie_candidate_fkey
      foreign key (id, winning_movie_id)
      references public.campaign_movies(campaign_id, movie_id)
      on delete restrict;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'admissions_earlybird_screening_null_chk'
  ) then
    alter table public.admissions
      add constraint admissions_earlybird_screening_null_chk
      check (
        type <> 'campaign_earlybird'::public.admission_type
        or screening_id is null
      );
  end if;
end $$;
