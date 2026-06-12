alter table public.private_booking_requests
  add column if not exists event_type varchar(100);
