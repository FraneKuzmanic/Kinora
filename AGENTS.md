# AGENTS.md

## Project Snapshot
- Kinora is a Zagreb-scoped cinema MVP with 3 app roles: `audience`, `cinema_admin`, `validator` (`CLAUDE.md`, `server/app/api/deps/authorization.py`).
- Production code lives in `client/` + `server/`; `prototype/` is reference-only UI material (`README.md`).
- Backend is the workflow authority; Supabase is auth + Postgres + constraints, not the place for core business logic (`CLAUDE.md`, `supabase/README.md`).

## Architecture You Need To Internalize
- FastAPI app bootstraps in `server/app/main.py` and mounts versioned routes from `server/app/api/router.py` under `/api/v1`.
- Keep route handlers thin: route files perform auth/ownership checks, then delegate to services (see `server/app/api/routes/campaigns.py` -> `server/app/services/campaign_service.py`).
- Lifecycle automation runs from `server/app/services/lifecycle_scheduler.py` (not in `main.py`):
  - Core loop every 60s:
  1) `resolve_expired_campaigns()`
  2) `open_scheduled_screenings()`
  3) `confirm_selling_screenings()`
  4) `cancel_undersold_screenings()` (moves to `pending` at decision deadline)
  - Pending expiry loop every 30m:
  5) `auto_cancel_expired_pending_screenings()`
- Campaign resolution auto-creates screenings (`CampaignService.resolve_campaign()` -> `ScreeningService.create_from_campaign()`).

## Role/Auth Data Flow (Frontend <-> Backend <-> Supabase)
- Frontend signs in with Supabase JS and stores session in `AuthProvider` (`client/src/features/auth/auth-context.tsx`).
- API calls must include bearer token via `apiFetch` (`client/src/lib/api/client.ts`).
- Backend validates JWT via Supabase `/auth/v1/user` (`server/app/services/supabase_auth.py`).
- `/api/v1/auth/me` ensures `profiles` row exists and resolves role precedence: profile -> app_metadata -> user_metadata -> `audience` (`server/app/api/routes/auth.py`, `server/app/api/deps/authorization.py`).

## Domain Conventions Specific To Kinora
- State machines are explicit and enforced with 409s on invalid transitions:
  - Campaign: `draft -> voting -> resolved` or `cancelled` (voting starts at publish, using `voting_duration_days`).
  - Screening: `scheduled -> selling -> confirmed`, or `selling -> pending -> confirmed|cancelled`, or `cancelled`.
  (See `server/app/services/campaign_service.py` and `server/app/services/screening_service.py`.)
- Ownership rule: `cinema_admin` actions require `cinema_memberships` linkage (`get_admin_cinema_id`) before mutation.
- Read endpoints return enriched, join-heavy payloads (city/cinema/hall/movie metadata) to avoid frontend fan-out queries.
- Search pattern is body-based `POST /search` with optional filters (campaigns + screenings routes).
- Selling windows are no longer timestamp-driven; screenings use `decision_days_before_start` and a pending grace flow.

## Database + Integrity Guardrails
- Never patch tables manually; add numbered SQL migrations in `supabase/migrations/`.
- DB constraints already enforce core invariants (one vote/user/campaign, one winner/campaign, one campaign-derived screening, hall/cinema consistency) (`supabase/README.md`, `CLAUDE.md`).
- Service logic assumes these DB guarantees and converts expected constraint collisions into API errors (example: duplicate campaign movie/vote -> 409).

## Workflows That Save Time
- Backend dev loop (from `server/README.md` + `CLAUDE.md`): create venv, `pip install -e .[dev]`, run `uvicorn app.main:app --reload`, run `pytest`, lint with `ruff check .`.
- Frontend dev loop: `npm install`, `npm run dev`, build with `npm run build` (`client/package.json`).
- Use lifecycle scripts for realistic integration checks (Supabase + auth + scheduler timing):
  - `scripts/seed_campaign_demo.py`
  - `scripts/test_lifecycle.py`

## Current Integration Reality (Do Not Assume Done)
- Stripe capture/refund webhooks, Resend outbox email, QR PDF generation, and TMDB scheduled sync are still pending (`CLAUDE.md`, `LIFECYCLE.md`).
- Treat refund/email references in services as placeholders for future jobs; do not wire request-time service role operations in public endpoints.

