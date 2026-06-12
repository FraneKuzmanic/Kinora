"""
Kinora End-to-End Campaign Demo Seed
=====================================
Walks through the full campaign -> vote -> resolve -> screening flow.

Prerequisites
-------------
1. Backend running at API_BASE (default http://localhost:8000/api/v1)
2. Supabase seeds 0001_demo_seed.sql + 0002_seed.sql applied
   (cinemas, halls, and movies must exist)
3. A cinema_admin user already created in Supabase with a cinema_membership
   row pointing to '33333333-3333-3333-3333-333333333331' (Kinora Downtown Cinema)
4. .env.seed file (or env vars) with credentials:

   API_BASE=http://localhost:8000/api/v1
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   ADMIN_EMAIL=admin@kinora.example
   ADMIN_PASSWORD=secret

Usage
-----
  pip install httpx python-dotenv
  python scripts/seed_campaign_demo.py
  python scripts/seed_campaign_demo.py --cleanup   # delete the 10 test voters after run
  python scripts/seed_campaign_demo.py --voting-minutes 2  # shorter voting window for quick test
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

API_BASE = os.getenv("API_BASE", "http://localhost:8000/api/v1")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

# Seeded UUIDs from 0001_demo_seed.sql
CINEMA_ID = "33333333-3333-3333-3333-333333333331"
HALL_ID = "55555555-5555-5555-5555-555555555551"
MOVIE_A_ID = "66666666-6666-6666-6666-666666666661"  # Parasite
MOVIE_B_ID = "66666666-6666-6666-6666-666666666662"  # In the Mood for Love

TEST_VOTER_PASSWORD = "DemoVoter123!"
TEST_VOTER_PREFIX = "demo_voter_"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def api(client: httpx.Client, method: str, path: str, token: str | None = None, **kwargs) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = client.request(method, f"{API_BASE}{path}", headers=headers, **kwargs)
    if not r.is_success:
        print(f"  ERROR {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def supabase_admin(client: httpx.Client, method: str, path: str, **kwargs) -> dict:
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    r = client.request(method, f"{SUPABASE_URL}{path}", headers=headers, **kwargs)
    if not r.is_success:
        print(f"  SUPABASE ERROR {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def sign_in(client: httpx.Client, email: str, password: str) -> str:
    r = client.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# Main demo flow
# ---------------------------------------------------------------------------

def run(voting_minutes: int, cleanup: bool) -> None:
    assert SUPABASE_URL, "SUPABASE_URL must be set"
    assert SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY must be set"
    assert ADMIN_EMAIL, "ADMIN_EMAIL must be set"
    assert ADMIN_PASSWORD, "ADMIN_PASSWORD must be set"

    voter_user_ids: list[str] = []

    with httpx.Client(timeout=30) as client:

        # ------------------------------------------------------------------
        # Step 1 — Admin signs in
        # ------------------------------------------------------------------
        print("\n[1/7] Signing in as cinema_admin...")
        admin_token = sign_in(client, ADMIN_EMAIL, ADMIN_PASSWORD)
        me = api(client, "GET", "/auth/me", token=admin_token)
        print(f"      Signed in as: {me.get('email')} (role: {me.get('role')})")

        # ------------------------------------------------------------------
        # Step 2 — Create campaign with short voting window
        # ------------------------------------------------------------------
        print(f"\n[2/7] Creating campaign (voting duration: {voting_minutes} min)...")
        now = datetime.now(UTC)
        slot_start = now + timedelta(minutes=voting_minutes + 2)

        campaign = api(client, "POST", "/campaigns", token=admin_token, json={
            "hall_id": HALL_ID,
            "title": f"Demo Campaign — {now.strftime('%H:%M')}",
            "description": "Auto-created by seed_campaign_demo.py",
            "slot_starts_at": slot_start.isoformat(),
            "slot_ends_at": (slot_start + timedelta(hours=2)).isoformat(),
            "voting_duration_days": 1,
            "decision_days_before_screening": 7,
            "min_tickets_to_confirm": 3,
        })
        campaign_id = campaign["id"]
        print(f"      Campaign: {campaign['title']} (id: {campaign_id})")
        print(f"      Cinema: {campaign['cinema_name']} / {campaign['hall_name']}")

        # ------------------------------------------------------------------
        # Step 3 — Add candidate movies
        # ------------------------------------------------------------------
        print("\n[3/7] Adding candidate movies...")
        cm_a = api(client, "POST", f"/campaigns/{campaign_id}/movies", token=admin_token,
                   json={"movie_id": MOVIE_A_ID, "sort_order": 1})
        cm_b = api(client, "POST", f"/campaigns/{campaign_id}/movies", token=admin_token,
                   json={"movie_id": MOVIE_B_ID, "sort_order": 2})
        print(f"      Movie A: campaign_movie_id={cm_a['id']} (movie_id={cm_a['movie_id']})")
        print(f"      Movie B: campaign_movie_id={cm_b['id']} (movie_id={cm_b['movie_id']})")

        # ------------------------------------------------------------------
        # Step 4 — Publish campaign
        # ------------------------------------------------------------------
        print("\n[4/7] Publishing campaign (draft → voting)...")
        published = api(client, "POST", f"/campaigns/{campaign_id}/publish", token=admin_token)
        print(f"      Status: {published['status']}")
        voting_ends = datetime.fromisoformat(published["voting_ends_at"].replace("Z", "+00:00"))

        # ------------------------------------------------------------------
        # Step 5 — Create 10 test voter users
        # ------------------------------------------------------------------
        print("\n[5/7] Creating 10 test voter users via Supabase Admin API...")
        for i in range(1, 11):
            email = f"{TEST_VOTER_PREFIX}{i}_{int(time.time())}@kinora.test"
            user_data = supabase_admin(client, "POST", "/auth/v1/admin/users", json={
                "email": email,
                "password": TEST_VOTER_PASSWORD,
                "email_confirm": True,
                "user_metadata": {"role": "audience"},
            })
            user_id = user_data["id"]
            voter_user_ids.append(user_id)

            # Ensure profile row exists (backend syncs on /auth/me, but let's do it via API)
            voter_token = sign_in(client, email, TEST_VOTER_PASSWORD)
            try:
                api(client, "GET", "/auth/me", token=voter_token)
            except Exception:
                pass  # profile sync may need the user to hit the endpoint once

        print(f"      Created {len(voter_user_ids)} users")

        # ------------------------------------------------------------------
        # Step 6 — Cast votes: 7 for Movie A, 3 for Movie B
        # ------------------------------------------------------------------
        print("\n[6/7] Casting votes (7 for Parasite, 3 for In the Mood for Love)...")
        vote_counts = {cm_a["id"]: 0, cm_b["id"]: 0}
        for idx, user_id in enumerate(voter_user_ids):
            # Get user email from admin API
            user_info = supabase_admin(client, "GET", f"/auth/v1/admin/users/{user_id}")
            voter_email = user_info["email"]
            voter_token = sign_in(client, voter_email, TEST_VOTER_PASSWORD)

            # 7 vote for A, 3 vote for B
            target_cm_id = cm_a["id"] if idx < 7 else cm_b["id"]
            try:
                api(client, "POST", f"/campaigns/{campaign_id}/votes", token=voter_token,
                    json={"campaign_movie_id": target_cm_id})
                vote_counts[target_cm_id] += 1
                print(f"      User {idx+1:2d}: voted for {'Parasite' if idx < 7 else 'In the Mood for Love'}")
            except Exception as e:
                print(f"      User {idx+1:2d}: vote failed — {e}")

        print(f"\n      Vote totals: Parasite={vote_counts[cm_a['id']]}, "
              f"In the Mood for Love={vote_counts[cm_b['id']]}")

        # ------------------------------------------------------------------
        # Step 7 — Resolve campaign after vote phase
        # ------------------------------------------------------------------
        print("\n[7/7] Resolving campaign manually (voting starts on publish and uses day durations)...")
        resolved_campaign = api(client, "POST", f"/campaigns/{campaign_id}/resolve", token=admin_token)

        winner_movie_id = resolved_campaign.get("winning_movie_id")
        winner_name = "Parasite" if str(winner_movie_id) == MOVIE_A_ID else "In the Mood for Love"
        print(f"\n  ✓ Campaign resolved at {resolved_campaign['resolved_at']}")
        print(f"  ✓ Winner: {winner_name} (movie_id: {winner_movie_id})")

        # ------------------------------------------------------------------
        # Verify screening was auto-created
        # ------------------------------------------------------------------
        print("\n  Verifying screening was auto-created...")
        screenings = api(client, "GET", "/screenings")
        linked = [s for s in screenings if s.get("campaign_id") == campaign_id]

        if linked:
            s = linked[0]
            print("\n  ✓ Screening created!")
            print(f"    id:         {s['id']}")
            print(f"    status:     {s['status']}")
            print(f"    movie:      {s['movie_title']}")
            print(f"    cinema:     {s['cinema_name']} / {s['hall_name']}")
            print(f"    starts_at:  {s['starts_at']}")
        else:
            print("  ⚠ No linked screening found — check screening service logs.")

        # ------------------------------------------------------------------
        # Cleanup
        # ------------------------------------------------------------------
        if cleanup and voter_user_ids:
            print(f"\n[cleanup] Deleting {len(voter_user_ids)} test voter users...")
            for user_id in voter_user_ids:
                try:
                    supabase_admin(client, "DELETE", f"/auth/v1/admin/users/{user_id}")
                except Exception:
                    pass
            print("  Done.")

    print("\n=== Demo complete ===\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kinora end-to-end campaign demo")
    parser.add_argument("--voting-minutes", type=int, default=2,
                        help="How long the voting window lasts (default: 2)")
    parser.add_argument("--cleanup", action="store_true",
                        help="Delete test voter users after the run")
    args = parser.parse_args()
    run(voting_minutes=args.voting_minutes, cleanup=args.cleanup)
