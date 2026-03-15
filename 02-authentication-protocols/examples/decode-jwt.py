#!/usr/bin/env python3
"""
JWT Decoder and Validator
Decodes JWT tokens and validates claims without external dependencies.
Usage: python decode-jwt.py <jwt_token>
"""

import json
import base64
import sys
import hmac
import hashlib
from datetime import datetime, timezone


def base64url_decode(data: str) -> bytes:
    """Decode Base64URL-encoded string."""
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def decode_jwt(token: str) -> dict:
    """Decode a JWT token without validation (for inspection)."""
    parts = token.strip().split(".")

    if len(parts) != 3:
        raise ValueError(f"Invalid JWT format: expected 3 parts, got {len(parts)}")

    header = json.loads(base64url_decode(parts[0]))
    payload = json.loads(base64url_decode(parts[1]))
    signature = parts[2]

    return {
        "header": header,
        "payload": payload,
        "signature": signature,
    }


def validate_claims(payload: dict) -> list:
    """Validate standard JWT claims and return any issues found."""
    issues = []
    now = datetime.now(timezone.utc).timestamp()

    # Check expiration
    if "exp" in payload:
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        if payload["exp"] < now:
            issues.append(f"EXPIRED: Token expired at {exp_time.isoformat()}")
        else:
            issues.append(f"OK: Expires at {exp_time.isoformat()}")
    else:
        issues.append("WARNING: No 'exp' claim - token never expires")

    # Check not-before
    if "nbf" in payload:
        nbf_time = datetime.fromtimestamp(payload["nbf"], tz=timezone.utc)
        if payload["nbf"] > now:
            issues.append(f"NOT YET VALID: Valid from {nbf_time.isoformat()}")
        else:
            issues.append(f"OK: Valid since {nbf_time.isoformat()}")

    # Check issued-at
    if "iat" in payload:
        iat_time = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        if payload["iat"] > now:
            issues.append(f"WARNING: Issued in the future: {iat_time.isoformat()}")
        else:
            issues.append(f"OK: Issued at {iat_time.isoformat()}")

    # Check required claims
    required = ["sub", "iss", "aud"]
    for claim in required:
        if claim not in payload:
            issues.append(f"WARNING: Missing recommended claim '{claim}'")

    return issues


def format_output(decoded: dict) -> str:
    """Format decoded JWT for display."""
    lines = []
    lines.append("=" * 60)
    lines.append("JWT DECODER")
    lines.append("=" * 60)

    lines.append("\n--- HEADER ---")
    lines.append(json.dumps(decoded["header"], indent=2))

    lines.append("\n--- PAYLOAD ---")
    lines.append(json.dumps(decoded["payload"], indent=2))

    lines.append("\n--- SIGNATURE ---")
    lines.append(decoded["signature"][:50] + "..." if len(decoded["signature"]) > 50 else decoded["signature"])

    lines.append("\n--- VALIDATION ---")
    for issue in validate_claims(decoded["payload"]):
        lines.append(f"  {issue}")

    lines.append("\n" + "=" * 60)
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python decode-jwt.py <jwt_token>")
        print("\nExample:")
        print("  python decode-jwt.py eyJhbGciOiJSUzI1NiIs...")
        print("  echo $TOKEN | python decode-jwt.py -")
        sys.exit(1)

    token = sys.argv[1]
    if token == "-":
        token = sys.stdin.read().strip()

    try:
        decoded = decode_jwt(token)
        print(format_output(decoded))
    except Exception as e:
        print(f"Error decoding JWT: {e}", file=sys.stderr)
        sys.exit(1)
