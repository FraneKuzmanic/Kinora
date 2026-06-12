# Kinora

Kinora is a cinema-on-demand MVP that helps cinemas validate audience demand before committing to screenings. Audiences can vote for films, buy early-bird or confirmed tickets, request private cinema bookings, and validate admissions at the door. Cinema admins can manage campaigns, screenings, booking requests, recommendations, and analytics from one dashboard.

The project was built as a full-stack student competition MVP focused on the question: what if cinema programming could be shaped by real audience demand instead of guesswork?

## Core Features

- Audience discovery page for voting campaigns, upcoming screenings, cinema discovery, and movie recommendations.
- Voting campaigns where users choose which film should become a real screening.
- Early-bird ticket flow for users who want to help a campaign reach its confirmation threshold.
- Confirmed screening ticket purchase flow with Stripe Checkout.
- My Tickets page with active, pending, refundable, and used admissions.
- QR/PDF ticket generation and validator dashboard for cinema staff.
- Cinema admin dashboard for campaigns, screenings, locations, halls, validators, private bookings, and cinema profile data.
- Private booking flow where users request a cinema hall for birthdays, team events, private screenings, or special occasions.
- Admin review flow for private booking offers/rejections.
- Analytics dashboard with campaign funnel, screening health, slot performance, content demand, private booking analytics, revenue metrics, and a what-if attendance predictor.
- Loyalty and gamification system with points, badges, levels, and discount vouchers.
- Email notification pipeline using an outbox pattern.

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- Recharts
- Lucide React
- HTML5 QR code scanning

### Backend

- Python 3.11+
- FastAPI
- SQLAlchemy async ORM
- asyncpg
- Pydantic settings
- Supabase Auth/PostgreSQL
- Stripe Checkout
- ReportLab for ticket PDFs
- Resend email provider

### Database And Infrastructure

- PostgreSQL through Supabase
- Supabase Auth for user accounts
- Role-based access through profiles and cinema memberships
- Background lifecycle scheduler for campaign/screening transitions
- Email outbox table for retryable notification delivery

## Project Structure

```text
Kinora/
  client/       React/Vite frontend
  server/       FastAPI backend
  supabase/     Database migrations, seeds, and Supabase config
  scripts/      Utility scripts
  docs/         Supporting documentation
  prototype/    Archived prototype/reference material
```

## Main User Roles

| Role         | Purpose                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- |
| Audience     | Browse campaigns/screenings, vote, buy tickets, request private bookings, manage tickets     |
| Cinema admin | Manage cinema operations, campaigns, screenings, private bookings, validators, and analytics |
| Validator    | Validate tickets for a specific cinema at the venue entrance                                 |

## Business Logic Overview

### Voting Campaigns

Cinema admins create campaigns with candidate movies, a voting duration, a hall, a planned screening slot, ticket threshold, and capacity. Users vote for the movie they want to see and can buy early-bird tickets to show stronger demand.

When the campaign resolves, the backend selects the winning movie based on early-bird demand and vote counts, then creates a linked screening for the predefined cinema slot.

### Screenings

Screenings move through lifecycle states such as scheduled, selling, pending, confirmed, and cancelled. A screening confirms when enough tickets are sold before the decision deadline. This prevents users and cinemas from waiting until the last moment to know whether an event will happen.

### Tickets And Validation

Successful purchases create admissions. Admissions contain ticket status, buyer information, quantity, price, screening/campaign reference, and a secure QR token. Validators are tied to a cinema and can only validate tickets for that cinema.

### Private Booking

Users can request a private cinema booking by selecting a venue, event type, guest count, preferred time, and special notes. The cinema admin reviews the request and can send an offer with hall, time, price, and message, or reject the request.

### Analytics And Recommendations

Kinora uses an explainable heuristic scoring approach, not a trained ML model. Recommendations and predictions combine product signals such as votes, early-bird tickets, movie requests, campaign views, genre performance, screening history, hall capacity, time slot performance, and TMDB popularity.

This makes the MVP transparent and suitable for early-stage use before enough real production data exists for a trained machine-learning model.

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Python 3.11+
- Supabase project
- Stripe test account
- Resend account, if testing email delivery

### Environment Variables

Create environment files locally. Do not commit real secrets.

Client:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Server:

```env
APP_ENV=development
DEBUG=true
API_V1_PREFIX=/api/v1
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql+asyncpg://...
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
RESEND_API_KEY=your_resend_key
EMAIL_FROM=noreply@example.com
```

### Run The Backend

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Backend runs on:

```text
http://localhost:8000
```

### Run The Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

### Build The Frontend

```bash
cd client
npm run build
```

## Important MVP Notes

- This is an MVP, not a production-ready cinema platform.
- Stripe is intended to run in test mode for local/demo use.
- The recommendation and prediction features are heuristic and explainable, not trained AI/ML models.
- Movie licensing is assumed to remain under cinema/distributor control. Kinora validates demand and manages workflows; it does not bypass film rights.
- `prototype/` is archived reference material and is not the production frontend.

## Documentation

- `LIFECYCLE.md` explains campaign and screening state transitions.
- `docs/` contains supporting project documentation.
- `supabase/` contains database migrations and seed data.

## Competition Context

Kinora was created as a student competition MVP. The goal was to demonstrate a complete technical and business concept for demand-driven cinema programming: audiences get a voice, cinemas reduce programming risk, and underused cinema capacity can become new revenue through screenings and private bookings.
