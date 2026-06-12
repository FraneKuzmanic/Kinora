# Supabase

This directory contains Kinora's Supabase-related project files.

## Purpose

This folder is the home for:

- database migrations
- seed data
- optional Edge Functions
- local Supabase config later if the team decides to use the Supabase CLI locally

## Current State

Initial schema migration is now defined for the backend MVP:

- `migrations/20260411094500_initial_schema.sql`
- role-based users (`audience`, `cinema_admin`, `validator`)
- cinema brand → locations → halls hierarchy
- voting campaigns with strict single winner and one vote per user per campaign
- screenings, orders/payments/refunds, admissions/QR redemptions
- private booking request/offer/accept flow (kept separate from screenings)
- minimal analytics event tables + essential reporting views

## Migration Notes

Run SQL migrations through the Supabase SQL editor or CLI migration flow used by your team.

The migration includes integrity safeguards for:

- hall/cinema consistency on campaigns and screenings
- private booking location/hall consistency
- one screening per campaign when campaign-derived
- one winner per campaign via partial unique index

## Seeds

`seeds/0001_demo_seed.sql` provides a full demo baseline for Zagreb:

- country/city bootstrap (`Croatia`, `Zagreb`)
- demo cinemas, locations, halls
- demo movies
- one active voting campaign with candidate movies
- one selling screening

This seed intentionally does not write `auth.users`; use Kinora's backend signup endpoint or the Supabase admin API for user creation.

## Functions (SQL)

The migration includes PostgreSQL functions used by triggers:

- `public.set_updated_at()` keeps `updated_at` columns consistent.
- `public.validate_hall_cinema_consistency()` enforces hall/cinema integrity.
- `public.validate_private_booking_links()` validates booking location/hall relationships.

These are database-side guardrails; business workflows remain in FastAPI services.

## Notification Outbox

Transactional email delivery is owned by the backend notification pipeline and persisted in `public.email_outbox`.

- owner module: `server/app/notifications/`
- purpose: retryable transactional email queue for booking, payment, refund, and screening outcomes
- key fields: event type, template key, recipient kind, payload, attempt counters, provider message id, last error, and send timestamps
- access pattern: FastAPI domain services enqueue rows in the same transaction as business changes; the backend background runner claims due rows and sends them through Resend
- auth expectations: only trusted backend jobs should write delivery state or call the provider

## Auth Email Sender

Password reset and signup confirmation emails are delivered by FastAPI through Resend. The backend generates Supabase Auth action links with the service-role client, then sends them from Kinora's verified Resend sender.

- sender: `Kinora <noreply@kinora.live>`
- provider: Resend API
- route: `POST /api/v1/auth/signup`
- route: `POST /api/v1/auth/password-reset`
- operational notes: `docs/supabase-auth-email.md`

## Suggested Structure

```text
supabase/
  migrations/   # SQL migrations
  seeds/        # seed SQL or data files
  functions/    # optional Supabase Edge Functions
```

## Notes

- For Kinora, Supabase is planned as the database/auth/realtime platform.
- Business logic should still primarily live in the FastAPI backend.
- Keep migrations forward-only and additive when possible.
