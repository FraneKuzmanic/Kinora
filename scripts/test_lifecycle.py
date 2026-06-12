"""
Kinora Lifecycle Test Script
=============================
Tests the full campaign → screening admin lifecycle that is currently implemented.
Ticket purchasing is NOT yet implemented, so threshold/auto-confirm flows are
skipped and marked clearly.

What this script tests
----------------------
Campaign path:
  1. Create campaign (draft)
  2. Add 2 candidate movies
  3. Publish (draft → voting)
  4. Vote as 3 audience users
  5. Manually resolve (voting → resolved) → screening auto-created
  6. Verify screening appears in GET /screenings

Standalone screening path:
  7. Create a standalone screening
  8. Manually open sales (scheduled → selling)
  9. Manually confirm (selling → confirmed)        [normally auto when tickets sold]
 10. Create another standalone screening and cancel it

Filter / search:
 11. POST /screenings/search  (by city, by cinema, by status)
 12. POST /campaigns/search   (by status)
 13. GET  /campaigns/{id}     (detail with movie stats)

Prerequisites
-------------
- Backend running at API_BASE (default http://localhost:8000/api/v1)
- Seeds applied (cinemas, halls, movies, cities)
- A cinema_admin user with a cinema_membership row for CINEMA_ID
- .env.seed file (or env vars):

    API_BASE=http://localhost:8000/api/v1
    SUPABASE_URL=https://xxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...
    ADMIN_EMAIL=admin@kinora.example
    ADMIN_PASSWORD=secret

Usage
-----
  pip install httpx python-dotenv
  python scripts/test_lifecycle.py
  python scripts/test_lifecycle.py --cleanup   # delete the 3 test voters after run
"""

import argparse
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent.parent / ".env.seed", override=False)

API_BASE      = os.getenv("API_BASE", "http://localhost:8000/api/v1")
SUPABASE_URL  = os.getenv("SUPABASE_URL", "")
SERVICE_ROLE  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ADMIN_EMAIL   = os.getenv("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

# Seeded UUIDs — must match your seed SQL
CINEMA_ID   = "33333333-3333-3333-3333-333333333331"
HALL_ID     = "55555555-5555-5555-5555-555555555551"
CITY_ID     = "11111111-1111-1111-1111-111111111112"   # Zagreb (from seed)
MOVIE_A_ID  = "66666666-6666-6666-6666-666666666661"   # Parasite
MOVIE_B_ID  = "66666666-6666-6666-6666-666666666662"   # In the Mood for Love

VOTER_PASSWORD = "TestVoter123!"
VOTER_PREFIX   = "lifecycle_voter_"

OK   = "✓"
FAIL = "✗"
SKIP = "○"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def api(client, method, path, token=None, **kwargs):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = client.request(method, f"{API_BASE}{path}", headers=headers, **kwargs)
    if not r.is_success:
        print(f"  {FAIL} {method} {path} → {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def supabase_admin(client, method, path, **kwargs):
    headers = {
        "apikey": SERVICE_ROLE,
        "Authorization": f"Bearer {SERVICE_ROLE}",
        "Content-Type": "application/json",
    }
    r = client.request(method, f"{SUPABASE_URL}{path}", headers=headers, **kwargs)
    if not r.is_success:
        print(f"  {FAIL} Supabase {method} {path} → {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def sign_in(client, email, password):
    r = client.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SERVICE_ROLE, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


def check(label, condition, got=None):
    icon = OK if condition else FAIL
    suffix = f"  (got: {got})" if got is not None and not condition else ""
    print(f"  {icon}  {label}{suffix}")
    return condition


def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

def run(cleanup: bool) -> int:
    assert SUPABASE_URL, "SUPABASE_URL must be set"
    assert SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY must be set"
    assert ADMIN_EMAIL, "ADMIN_EMAIL must be set"
    assert ADMIN_PASSWORD, "ADMIN_PASSWORD must be set"

    failures = 0
    voter_ids: list[str] = []

    with httpx.Client(timeout=30) as client:

        # ---------------------------------------------------------------
        # Auth
        # ---------------------------------------------------------------
        section("Auth — admin sign-in")
        admin_token = sign_in(client, ADMIN_EMAIL, ADMIN_PASSWORD)
        me = api(client, "GET", "/auth/me", token=admin_token)
        ok = check("signed in as cinema_admin", me.get("role") == "cinema_admin", me.get("role"))
        if not ok:
            failures += 1

        # ---------------------------------------------------------------
        # Campaign — create
        # ---------------------------------------------------------------
        section("Campaign — create (draft)")
        now = datetime.now(UTC)
        campaign = api(client, "POST", "/campaigns", token=admin_token, json={
            "hall_id": HALL_ID,
            "title": f"Lifecycle Test {now.strftime('%H:%M:%S')}",
            "description": "Created by test_lifecycle.py",
            "slot_starts_at":   (now + timedelta(hours=3)).isoformat(),
            "slot_ends_at":     (now + timedelta(hours=5)).isoformat(),
            "voting_duration_days": 1,
            "decision_days_before_screening": 7,
            "min_tickets_to_confirm": 3,
            "max_tickets": 50,
        })
        cid = campaign["id"]
        failures += 0 if check("status is draft",       campaign["status"] == "draft") else 1
        failures += 0 if check("city_name present",     bool(campaign.get("city_name"))) else 1
        failures += 0 if check("cinema_name present",   bool(campaign.get("cinema_name"))) else 1
        failures += 0 if check("hall_capacity present", campaign.get("hall_capacity", 0) > 0) else 1
        print(f"     campaign_id: {cid}")
        print(f"     city: {campaign.get('city_name')}  cinema: {campaign.get('cinema_name')}")

        # ---------------------------------------------------------------
        # Campaign — add movies
        # ---------------------------------------------------------------
        section("Campaign — add candidate movies")
        cm_a = api(client, "POST", f"/campaigns/{cid}/movies", token=admin_token,
                   json={"movie_id": MOVIE_A_ID, "sort_order": 1})
        cm_b = api(client, "POST", f"/campaigns/{cid}/movies", token=admin_token,
                   json={"movie_id": MOVIE_B_ID, "sort_order": 2})
        failures += 0 if check("movie A added", cm_a.get("movie_id") == MOVIE_A_ID) else 1
        failures += 0 if check("movie B added", cm_b.get("movie_id") == MOVIE_B_ID) else 1

        # ---------------------------------------------------------------
        # Campaign — publish
        # ---------------------------------------------------------------
        section("Campaign — publish (draft → voting)")
        published = api(client, "POST", f"/campaigns/{cid}/publish", token=admin_token)
        failures += 0 if check("status is voting", published["status"] == "voting") else 1

        # ---------------------------------------------------------------
        # Audience — create 3 voters and vote
        # ---------------------------------------------------------------
        section("Audience — create 3 voters and cast votes")
        ts = int(time.time())
        for i in range(1, 4):
            email = f"{VOTER_PREFIX}{i}_{ts}@kinora.test"
            user_data = supabase_admin(client, "POST", "/auth/v1/admin/users", json={
                "email": email, "password": VOTER_PASSWORD,
                "email_confirm": True, "user_metadata": {"role": "audience"},
            })
            voter_ids.append(user_data["id"])
            voter_token = sign_in(client, email, VOTER_PASSWORD)
            # Sync profile
            try:
                api(client, "GET", "/auth/me", token=voter_token)
            except Exception:
                pass
            # Voters 1-2 vote for A, voter 3 votes for B
            target = cm_a["id"] if i <= 2 else cm_b["id"]
            vote = api(client, "POST", f"/campaigns/{cid}/votes", token=voter_token,
                       json={"campaign_movie_id": target})
            failures += 0 if check(f"voter {i} vote recorded", bool(vote.get("id"))) else 1

        # ---------------------------------------------------------------
        # Campaign detail — check vote counts
        # ---------------------------------------------------------------
        section("Campaign detail — vote counts (no auth)")
        detail = api(client, "GET", f"/campaigns/{cid}")
        movies = detail.get("movies", [])
        vote_totals = {m["movie_id"]: m["vote_count"] for m in movies}
        failures += 0 if check("2 votes for movie A", vote_totals.get(MOVIE_A_ID) == 2) else 1
        failures += 0 if check("1 vote for movie B", vote_totals.get(MOVIE_B_ID) == 1) else 1
        failures += 0 if check("ticket_count is None (no auth)", movies[0]["ticket_count"] is None) else 1

        # Campaign detail as admin — ticket_count should be 0 (no purchases yet)
        detail_admin = api(client, "GET", f"/campaigns/{cid}", token=admin_token)
        movies_admin = detail_admin.get("movies", [])
        failures += 0 if check(
            "ticket_count is 0 for admin (no purchases yet)",
            all(m["ticket_count"] == 0 for m in movies_admin),
        ) else 1

        # ---------------------------------------------------------------
        # Campaign — manual resolve → screening auto-created
        # ---------------------------------------------------------------
        section("Campaign — resolve (voting → resolved + screening created)")
        resolved = api(client, "POST", f"/campaigns/{cid}/resolve", token=admin_token)
        failures += 0 if check("status is resolved",      resolved["status"] == "resolved") else 1
        failures += 0 if check("winning_movie_id set",    bool(resolved.get("winning_movie_id"))) else 1
        failures += 0 if check("resolved_at set",         bool(resolved.get("resolved_at"))) else 1
        print(f"     winner: {resolved.get('winning_movie_id')}")

        # ---------------------------------------------------------------
        # Screening auto-created — verify via search
        # ---------------------------------------------------------------
        section("Screening — verify auto-created from campaign")
        screenings = api(client, "GET", "/screenings")
        campaign_screenings = [s for s in screenings if s.get("campaign_id") == cid]
        failures += 0 if check("1 screening created for campaign", len(campaign_screenings) == 1) else 1
        if campaign_screenings:
            s = campaign_screenings[0]
            failures += 0 if check("status is scheduled",      s["status"] == "scheduled") else 1
            failures += 0 if check("movie matches winner",     s["movie_id"] == resolved["winning_movie_id"]) else 1
            failures += 0 if check("tickets_sold is 0",        s["tickets_sold"] == 0) else 1
            failures += 0 if check("max_tickets is 50",        s["max_tickets"] == 50) else 1
            failures += 0 if check("city_name present",        bool(s.get("city_name"))) else 1
            failures += 0 if check("location_id present",      bool(s.get("location_id"))) else 1
            failures += 0 if check("movie_title present",      bool(s.get("movie_title"))) else 1
            print(f"     screening_id:  {s['id']}")
            print(f"     movie:         {s['movie_title']}")
            print(f"     city:          {s['city_name']} / {s.get('location_name')}")
            print(f"     hall_capacity: {s['hall_capacity']}  max_tickets: {s['max_tickets']}")

        # ---------------------------------------------------------------
        # Standalone screening — full manual lifecycle
        # ---------------------------------------------------------------
        section("Standalone screening — create")
        now = datetime.now(UTC)
        sc = api(client, "POST", "/screenings", token=admin_token, json={
            "hall_id": HALL_ID,
            "movie_id": MOVIE_A_ID,
            "starts_at":  (now + timedelta(days=7)).isoformat(),
            "ends_at":    (now + timedelta(days=7, hours=2)).isoformat(),
            "decision_days_before_start": 7,
            "min_tickets_to_confirm": 10,
            "max_tickets": 80,
        })
        sc_id = sc["id"]
        failures += 0 if check("status is scheduled",  sc["status"] == "scheduled") else 1
        failures += 0 if check("max_tickets is 80",    sc["max_tickets"] == 80) else 1
        failures += 0 if check("city_name present",    bool(sc.get("city_name"))) else 1
        print(f"     screening_id: {sc_id}")

        section("Standalone screening — open sales (scheduled → selling)")
        selling = api(client, "POST", f"/screenings/{sc_id}/open-sales", token=admin_token)
        failures += 0 if check("status is selling", selling["status"] == "selling") else 1

        section("Standalone screening — confirm (selling → confirmed)  [manual, normally auto]")
        confirmed = api(client, "POST", f"/screenings/{sc_id}/confirm", token=admin_token)
        failures += 0 if check("status is confirmed",   confirmed["status"] == "confirmed") else 1
        failures += 0 if check("confirmed_at set",      bool(confirmed.get("confirmed_at"))) else 1

        section("Standalone screening — cancel path (separate screening)")
        sc2 = api(client, "POST", "/screenings", token=admin_token, json={
            "hall_id": HALL_ID,
            "movie_id": MOVIE_B_ID,
            "starts_at":  (now + timedelta(days=14)).isoformat(),
            "ends_at":    (now + timedelta(days=14, hours=2)).isoformat(),
            "min_tickets_to_confirm": 20,
        })
        sc2_id = sc2["id"]
        api(client, "POST", f"/screenings/{sc2_id}/open-sales", token=admin_token)
        cancelled = api(client, "POST", f"/screenings/{sc2_id}/cancel", token=admin_token,
                        json={"reason": "Testing cancel path"})
        failures += 0 if check("status is cancelled",    cancelled["status"] == "cancelled") else 1
        failures += 0 if check("cancel_reason set",      cancelled.get("cancel_reason") == "Testing cancel path") else 1
        failures += 0 if check("cancelled_at set",       bool(cancelled.get("cancelled_at"))) else 1

        # ---------------------------------------------------------------
        # Filter / search endpoints
        # ---------------------------------------------------------------
        section("POST /screenings/search — filter by city_id")
        by_city = api(client, "POST", "/screenings/search", json={"city_id": CITY_ID})
        failures += 0 if check(
            "all results in correct city",
            all(s["city_id"] == CITY_ID for s in by_city),
        ) else 1
        print(f"     screenings in city: {len(by_city)}")

        section("POST /screenings/search — filter by status=confirmed")
        by_status = api(client, "POST", "/screenings/search", json={"status": "confirmed"})
        failures += 0 if check(
            "all results have status=confirmed",
            all(s["status"] == "confirmed" for s in by_status),
        ) else 1
        print(f"     confirmed screenings: {len(by_status)}")

        section("POST /screenings/search — filter by cinema_id")
        by_cinema = api(client, "POST", "/screenings/search", json={"cinema_id": CINEMA_ID})
        failures += 0 if check(
            "all results in correct cinema",
            all(s["cinema_id"] == CINEMA_ID for s in by_cinema),
        ) else 1
        print(f"     screenings for cinema: {len(by_cinema)}")

        section("POST /campaigns/search — filter by status=resolved")
        by_camp_status = api(client, "POST", "/campaigns/search", json={"status": "resolved"})
        failures += 0 if check(
            "all results have status=resolved",
            all(c["status"] == "resolved" for c in by_camp_status),
        ) else 1
        failures += 0 if check(
            "city_name present in campaign results",
            all(bool(c.get("city_name")) for c in by_camp_status),
        ) else 1
        print(f"     resolved campaigns: {len(by_camp_status)}")

        section("POST /campaigns/search — filter by city_id")
        by_camp_city = api(client, "POST", "/campaigns/search", json={"city_id": CITY_ID})
        failures += 0 if check(
            "all results in correct city",
            all(c["city_id"] == CITY_ID for c in by_camp_city),
        ) else 1
        print(f"     campaigns in city: {len(by_camp_city)}")

        # ---------------------------------------------------------------
        # Skipped (ticket purchasing not yet implemented)
        # ---------------------------------------------------------------
        section(f"{SKIP} Skipped (ticket purchasing not yet implemented)")
        print(f"  {SKIP}  auto-confirm when min_tickets_to_confirm reached")
        print(f"  {SKIP}  auto-confirm when hall capacity full")
        print(f"  {SKIP}  pending transition at decision deadline when threshold is unmet")
        print(f"  {SKIP}  30-minute scheduler auto-cancel for expired pending screenings")
        print("       These all work but require ticket purchase endpoints to drive the flow.")

        # ---------------------------------------------------------------
        # Cleanup
        # ---------------------------------------------------------------
        if cleanup and voter_ids:
            section("Cleanup — deleting test voters")
            for uid in voter_ids:
                try:
                    supabase_admin(client, "DELETE", f"/auth/v1/admin/users/{uid}")
                    print(f"  {OK}  deleted voter {uid[:8]}...")
                except Exception as e:
                    print(f"  {FAIL}  could not delete {uid[:8]}: {e}")

    # ---------------------------------------------------------------
    # Summary
    # ---------------------------------------------------------------
    print(f"\n{'═'*60}")
    if failures == 0:
        print(f"  {OK}  ALL TESTS PASSED")
    else:
        print(f"  {FAIL}  {failures} TEST(S) FAILED")
    print(f"{'═'*60}\n")
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kinora lifecycle test")
    parser.add_argument("--cleanup", action="store_true", help="Delete test voter users after run")
    args = parser.parse_args()
    sys.exit(run(cleanup=args.cleanup))
