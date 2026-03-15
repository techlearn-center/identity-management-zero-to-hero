#!/usr/bin/env python3
"""Bulk Import Users to Auth0 from CSV via Management API.

Usage:
    python bulk-import-script.py --csv users.csv --connection-id con_xxxxx

Environment Variables:
    AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET
"""
import argparse
import csv
import json
import os
import sys
import tempfile
import time

import requests


def get_mgmt_token(domain, client_id, client_secret):
    """Obtain Auth0 Management API access token."""
    resp = requests.post(
        f"https://{domain}/oauth/token",
        json={
            "client_id": client_id,
            "client_secret": client_secret,
            "audience": f"https://{domain}/api/v2/",
            "grant_type": "client_credentials",
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def read_csv_users(csv_path):
    """Read users from CSV and format for Auth0 import."""
    users = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            user = {
                "email": row["email"],
                "email_verified": True,
                "name": row.get("name", row["email"]),
                "app_metadata": {
                    "department": row.get("department", ""),
                    "role": row.get("role", "member"),
                    "imported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
            }
            if row.get("password_hash"):
                user["custom_password_hash"] = {
                    "algorithm": "bcrypt",
                    "hash": {"value": row["password_hash"]},
                }
            users.append(user)
    return users


def submit_import_job(domain, token, connection_id, users):
    """Submit bulk import job to Auth0 Management API."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(users, f)
        temp_path = f.name

    try:
        with open(temp_path, "rb") as uf:
            resp = requests.post(
                f"https://{domain}/api/v2/jobs/users-imports",
                headers={"Authorization": f"Bearer {token}"},
                data={
                    "connection_id": connection_id,
                    "upsert": "false",
                    "send_completion_email": "true",
                },
                files={"users": uf},
            )
        resp.raise_for_status()
        return resp.json()
    finally:
        os.unlink(temp_path)


def check_job_status(domain, token, job_id):
    """Poll job status until completion."""
    while True:
        resp = requests.get(
            f"https://{domain}/api/v2/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        job = resp.json()
        status = job.get("status")
        print(f"  Status: {status}")
        if status in ("completed", "failed"):
            return job
        time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="Bulk import users to Auth0")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument("--connection-id", required=True, help="Auth0 DB connection ID")
    args = parser.parse_args()

    domain = os.environ.get("AUTH0_DOMAIN")
    client_id = os.environ.get("AUTH0_M2M_CLIENT_ID")
    client_secret = os.environ.get("AUTH0_M2M_CLIENT_SECRET")

    if not all([domain, client_id, client_secret]):
        print("ERROR: Set AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET")
        sys.exit(1)

    print(f"Reading users from {args.csv}...")
    users = read_csv_users(args.csv)
    print(f"Found {len(users)} users")

    print("Getting Management API token...")
    token = get_mgmt_token(domain, client_id, client_secret)

    batch_size = 500
    for i in range(0, len(users), batch_size):
        batch = users[i : i + batch_size]
        batch_num = i // batch_size + 1
        print(f"\nSubmitting batch {batch_num} ({len(batch)} users)...")
        job = submit_import_job(domain, token, args.connection_id, batch)
        print(f"  Job ID: {job['id']}")
        result = check_job_status(domain, token, job["id"])
        print(f"  Summary: {json.dumps(result.get('summary', {}), indent=2)}")
        time.sleep(2)

    print("\nBulk import complete!")


if __name__ == "__main__":
    main()
