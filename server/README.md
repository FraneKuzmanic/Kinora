# Kinora Server

FastAPI backend for Kinora.

## Setup

1. Create a virtual environment
2. Install dependencies
3. Copy `.env.example` to `.env`
4. Run the development server

Example:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

## Current Scope

Backend now includes baseline Supabase auth integration and SQLAlchemy database wiring.

Included:

- app bootstrap
- settings/config
- versioned API router
- health endpoint
- Supabase access-token verification (`/api/v1/auth/me`)
- Async SQLAlchemy session setup for Supabase Postgres
- Profile model and service (`public.profiles`)
- Domain models/schemas/services/routes for:
  - cinemas and halls
  - movies
  - campaigns and voting
  - screenings
  - private booking requests
  - Stripe Checkout test payments and refunds
  - validator QR redemption
- Router wiring under `/api/v1/*` for the above domains
- Route-level tests for key domain paths and role guards
- Google One Tap-ready auth profile bootstrap (`/auth/me` accepts Supabase sessions
  created through Google ID token sign-in)

Still pending for full MVP:

- analytics jobs
- robust RLS policy rollout and authz hardening pass
- richer test coverage for DB-backed integration scenarios

## API Surface (Current)

- `GET /api/v1/health`
- `GET /api/v1/auth/me`
- `GET /api/v1/cinemas`
- `GET /api/v1/cinemas/{cinema_id}`
- `GET /api/v1/cinemas/{cinema_id}/halls`
- `GET /api/v1/movies`
- `GET /api/v1/movies/{movie_id}`
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/{campaign_id}`
- `GET /api/v1/campaigns/{campaign_id}/movies`
- `POST /api/v1/campaigns/{campaign_id}/votes` (create or switch a user's campaign vote)
- `GET /api/v1/screenings`
- `GET /api/v1/screenings/{screening_id}`
- `GET /api/v1/private-bookings`
- `POST /api/v1/private-bookings`
- `PATCH /api/v1/private-bookings/{booking_id}/review`
- `POST /api/v1/screenings/{screening_id}/checkout-session`
- `POST /api/v1/screenings/{screening_id}/cancel`
- `POST /api/v1/campaigns/{campaign_id}/movies/{campaign_movie_id}/checkout-session`
- `GET /api/v1/admissions/me`
- `POST /api/v1/admissions/{admission_id}/refund`
- `POST /api/v1/stripe/webhook`
- `POST /api/v1/validator/admissions/{qr_token}/redeem`
- `GET /share/campaigns/{campaign_id}` (public social preview HTML; deploy rewrite from frontend domain)
- `GET /share/screenings/{screening_id}` (public social preview HTML; deploy rewrite from frontend domain)

## Required Environment

At minimum set the following in `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL` (Supabase Postgres connection string with `postgresql+asyncpg://`)
- `CLIENT_URL` (public frontend origin, e.g. `https://kinora.hr`)
- `CORS_ORIGINS` (optional comma-separated extra allowed frontend origins;
  local Vite origins are allowed automatically outside production)
- `API_PUBLIC_URL` (public backend origin, e.g. `https://api.kinora.hr`)
- `SHARE_PUBLIC_URL` (public share origin, e.g. `https://kinora.hr`; defaults to `CLIENT_URL`)

For polished social previews on the main domain, configure the frontend host or
reverse proxy to forward `/share/*` to this FastAPI app while keeping normal SPA
routes on the frontend.

For Stripe test payments also set:

- `STRIPE_SECRET_KEY` (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)

## Google One Tap Auth Setup

Kinora keeps Supabase as the session issuer. The frontend should exchange the
Google One Tap credential with Supabase Auth, then call this API with the
returned Supabase access token:

```ts
await supabase.auth.signInWithIdToken({
  provider: "google",
  token: response.credential,
  nonce,
});
```

External setup required before enabling the frontend:

- Enable the Google provider in the Supabase project.
- Configure the Google OAuth web client with local and production frontend
  origins.
- Use Google scopes `openid`, email, and profile.
- Enable FedCM for the One Tap prompt.

Reference docs:

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/reference/javascript/auth-signinwithidtoken

For local webhook testing:

```bash
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook
```

