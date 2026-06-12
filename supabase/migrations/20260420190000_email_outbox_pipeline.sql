do $$ begin
  create type public.email_delivery_status as enum ('queued', 'processing', 'sent', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_recipient_kind as enum ('audience', 'cinema_partner', 'ops');
exception when duplicate_object then null; end $$;

alter table public.email_outbox
  add column if not exists event_type text;

alter table public.email_outbox
  add column if not exists recipient_kind public.email_recipient_kind;

alter table public.email_outbox
  add column if not exists attempt_count int not null default 0;

alter table public.email_outbox
  add column if not exists max_attempts int not null default 5;

alter table public.email_outbox
  add column if not exists next_attempt_at timestamptz not null default now();

alter table public.email_outbox
  add column if not exists last_attempt_at timestamptz;

alter table public.email_outbox
  add column if not exists processing_started_at timestamptz;

alter table public.email_outbox
  add column if not exists scheduled_at timestamptz not null default now();

update public.email_outbox
set event_type = coalesce(event_type, template_key)
where event_type is null;

update public.email_outbox
set recipient_kind = coalesce(recipient_kind, 'audience'::public.email_recipient_kind)
where recipient_kind is null;

update public.email_outbox
set next_attempt_at = coalesce(next_attempt_at, scheduled_at, created_at, now());

alter table public.email_outbox
  alter column event_type set not null;

alter table public.email_outbox
  alter column recipient_kind set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_outbox'
      and column_name = 'status'
  ) then
    alter table public.email_outbox
      alter column status drop default;
    alter table public.email_outbox
      alter column status type public.email_delivery_status
      using status::text::public.email_delivery_status;
    alter table public.email_outbox
      alter column status set default 'queued'::public.email_delivery_status;
  end if;
end $$;

drop type if exists public.email_status;

drop index if exists public.email_outbox_status_idx;
create index if not exists email_outbox_status_next_attempt_idx
  on public.email_outbox(status, next_attempt_at);

create index if not exists email_outbox_event_template_idx
  on public.email_outbox(event_type, template_key);
