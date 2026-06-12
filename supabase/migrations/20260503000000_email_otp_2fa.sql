create table if not exists public.two_factor_email_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  next_resend_at timestamptz not null,
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists two_factor_email_challenges_user_active_idx
  on public.two_factor_email_challenges(user_id, consumed_at, created_at desc);

create table if not exists public.two_factor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists two_factor_sessions_user_active_idx
  on public.two_factor_sessions(user_id, revoked_at, expires_at);

drop trigger if exists two_factor_email_challenges_set_updated_at on public.two_factor_email_challenges;
create trigger two_factor_email_challenges_set_updated_at
before update on public.two_factor_email_challenges
for each row execute function public.set_updated_at();
