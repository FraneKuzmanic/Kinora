# Kinora Backend Agent Rules

## 1) Architecture boundaries
- Keep business logic in FastAPI.
- Use Supabase primarily for Auth, PostgreSQL, and Realtime.
- Do not move domain rules into frontend clients.

## 2) Database rules
- Always add schema changes as SQL migrations in `supabase/migrations/`.
- Do not edit production tables manually.
- Keep one role per user profile (`audience`, `cinema_admin`, `validator`).
- Preserve core integrity:
  - one vote per user per campaign
  - one winner per campaign
  - one campaign-derived screening per campaign
  - quantity-based admissions (no seat allocation)
  - private booking flow stays separate from standard screening flow

## 3) Security and access
- Never commit secrets or live keys.
- Use service role only in trusted backend/server jobs.
- Enforce authorization in FastAPI and RLS policies in Supabase.
- Treat validator permissions as explicit cinema grants.

## 4) API and backend implementation
- Keep API versioned under `/api/v1`.
- Add/extend endpoints with Pydantic request/response models.
- Keep route handlers thin; place business rules in service/domain modules.
- Ensure idempotent handling for payment/refund webhooks.

## 5) Migration quality checklist
- Use `if not exists` where safe for idempotency.
- Add indexes for query paths and foreign keys.
- Add constraints/triggers for cross-table consistency.
- Include rollback strategy notes in PR description when risk is high.

## 6) Testing and validation
- Before changes: run existing lint/build/tests to detect baseline issues.
- After changes: rerun relevant checks and record known pre-existing failures.
- Never remove tests to pass CI.

## 7) Collaboration workflow
- Keep changes focused and small.
- Document any schema assumptions in `supabase/README.md`.
- When introducing a new table, document:
  - purpose
  - owner module
  - key relationships
  - access pattern and auth expectations
