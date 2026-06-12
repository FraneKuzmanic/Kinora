# Kinora - Campaign & Screening Lifecycle

## The Actors

| Actor | Role | What they can do |
|---|---|---|
| Cinema admin | `cinema_admin` | Create/manage campaigns and screenings for owned cinema |
| Audience member | `audience` | Browse, vote, buy tickets (purchase endpoints pending) |
| Validator | `validator` | Scan and redeem admissions |
| Scheduler | background jobs | Runs periodic lifecycle transitions |

## Part 1 - Campaign Lifecycle

### States

```
draft --publish--> voting --resolve--> resolved --(creates screening)
  |                  |
  +------cancel------+----cancel----> cancelled
```

### Create (`draft`)

`POST /api/v1/campaigns`

```json
{
  "hall_id": "uuid",
  "title": "What should we screen?",
  "slot_starts_at": "2026-05-15T20:00:00Z",
  "slot_ends_at": "2026-05-15T22:15:00Z",
  "voting_duration_days": 7,
  "decision_days_before_screening": 7,
  "min_tickets_to_confirm": 30,
  "max_tickets": 120
}
```

- Campaign starts in `draft`; voting window is not active yet.
- `voting_duration_days` default: 7 days.
- `decision_days_before_screening` default: 7 days.
- `max_tickets = null` means fallback to hall capacity on screening side.

### Publish (`draft -> voting`)

`POST /api/v1/campaigns/{id}/publish`

- Voting always starts at publish time.
- Backend computes:
  - `voting_starts_at = now()`
  - `voting_ends_at = now() + voting_duration_days`
- Publish fails if computed `voting_ends_at >= slot_starts_at`.

### Vote

`POST /api/v1/campaigns/{id}/votes`

```json
{ "campaign_movie_id": "uuid" }
```

Rules:
- Requires auth.
- One vote per user per campaign (DB unique constraint; 409 on duplicate).
- Allowed only while status is `voting` and `now` is inside `[voting_starts_at, voting_ends_at]`.

### Resolve (`voting -> resolved`)

Automatic (scheduler every 60s) or manual (`POST /api/v1/campaigns/{id}/resolve`).

Winner selection:
1. If any movie has early-bird qty `>= min_tickets_to_confirm`, choose among those by:
   tickets desc -> votes desc -> lowest `sort_order`.
2. Otherwise choose by:
   votes desc -> early-bird tickets desc -> lowest `sort_order`.

After resolve:
- `winning_movie_id` and `resolved_at` are set.
- Linked screening is auto-created in `scheduled`.

## Part 2 - Screening Lifecycle

### States

```
scheduled --open-sales--> selling --confirm--> confirmed
    |                         |
    +---------cancel----------+----decision deadline unmet--> pending
                                                     |
                                      confirm/cancel + auto-cancel (grace expiry)
                                                     v
                                                 cancelled
```

### Create (`scheduled`)

Auto-created from campaign resolve, or standalone via `POST /api/v1/screenings`.

```json
{
  "hall_id": "uuid",
  "movie_id": "uuid",
  "starts_at": "2026-05-15T20:00:00Z",
  "ends_at": "2026-05-15T22:15:00Z",
  "decision_days_before_start": 7,
  "min_tickets_to_confirm": 30,
  "max_tickets": 120
}
```

- Explicit `sales_starts_at`/`sales_ends_at` are removed.
- `decision_days_before_start` controls when threshold decision is made.

### Open sales (`scheduled -> selling`)

- Manual endpoint: `POST /api/v1/screenings/{id}/open-sales`.
- Scheduler (60s) also opens all scheduled screenings.

### Confirm (`selling|pending -> confirmed`)

Auto-confirm check runs every 60s:

```
tickets_sold >= min_tickets_to_confirm
OR

```

- `tickets_sold` includes regular screening tickets + campaign early-bird tickets (if campaign-derived).
- `effective_max_tickets = max_tickets ?? hall_capacity`.
- On confirm: `pending_outcome -> active` admissions.

### Pending grace decision (`selling -> pending`)

At decision deadline:

```
decision_deadline = starts_at - decision_days_before_start
```

If threshold is still unmet when deadline is reached:
- screening moves to `pending`
- `pending_expires_at = now() + 12 days`

During `pending`:
- cinema admin can confirm (`POST /confirm`) or cancel (`POST /cancel`)
- auto-confirm still works if threshold/capacity becomes met

### Cancel (`scheduled|selling|pending -> cancelled`)

- Manual: `POST /api/v1/screenings/{id}/cancel`
- Automatic pending expiry loop (every 30 min):
  - cancels when `pending_expires_at <= now()`
  - or when `starts_at <= now()` and still not confirmed

On cancel:
- `pending_outcome -> lost_refund_pending` admissions.

### Confirmed selling behavior

After confirmation, ticket selling is still allowed until `starts_at`, unless `max_tickets` is reached first.

## Part 3 - Search Pattern

Both domains use body-based `POST /search` with optional filters.

- Campaign statuses: `draft`, `voting`, `resolved`, `cancelled`
- Screening statuses: `scheduled`, `selling`, `pending`, `confirmed`, `cancelled`

## Part 4 - Scheduler Topology

Scheduler orchestration is in `server/app/services/lifecycle_scheduler.py`.

Core loop (every 60s):
1. `resolve_expired_campaigns()`
2. `open_scheduled_screenings()`
3. `confirm_selling_screenings()`
4. `cancel_undersold_screenings()` (moves to `pending` at deadline)

Pending expiry loop (every 30 min):
5. `auto_cancel_expired_pending_screenings()`

## Part 5 - Not Yet Implemented

| Feature | Notes |
|---|---|
| Ticket purchasing APIs | endpoint implementation pending |
| Early-bird purchase APIs | endpoint implementation pending |
| Stripe payments/refunds | webhook flows pending |
| QR ticket PDF generation | pending |
| Resend email outbox processing | pending |
| TMDB scheduled bulk sync | manual single-movie sync exists |
