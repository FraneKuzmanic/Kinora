alter table public.private_booking_requests
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id uuid references public.profiles(user_id) on delete set null,
  add column if not exists cancellation_reason text;

create index if not exists private_booking_order_idx
  on public.private_booking_requests(order_id);

