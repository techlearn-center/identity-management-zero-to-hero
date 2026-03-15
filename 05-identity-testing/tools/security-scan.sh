#!/bin/bash
# security-scan.sh - Run security scans against auth endpoints
set -euo pipefail

TARGET_URL="${1:-http://localhost:3000}"
echo "=== Security Scan: $TARGET_URL ==="

echo "[1/4] Testing CORS..."
CORS_RESULT=$(curl -s -H "Origin: https://evil.com" -D - "$TARGET_URL/api/users/me" 2>&1 | grep -i "access-control-allow-origin" || echo "No CORS header")
echo "  $CORS_RESULT"

echo "[2/4] Testing security headers..."
HEADERS=$(curl -s -D - "$TARGET_URL" 2>&1 | head -20)
for header in "X-Content-Type-Options" "X-Frame-Options" "Strict-Transport-Security" "Content-Security-Policy"; do
  if echo "$HEADERS" | grep -qi "$header"; then
    echo "  OK: $header present"
  else
    echo "  MISSING: $header"
  fi
done

echo "[3/4] Testing rate limiting..."
RATE_LIMITED=false
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TARGET_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}')
  if [ "$STATUS" = "429" ]; then
    echo "  Rate limiting triggered at attempt $i"
    RATE_LIMITED=true
    break
  fi
done
if [ "$RATE_LIMITED" = "false" ]; then
  echo "  WARNING: No rate limiting detected after 15 attempts"
fi

echo "[4/4] Testing cookie security..."
COOKIES=$(curl -s -D - "$TARGET_URL/login" 2>&1 | grep -i "set-cookie" || echo "No cookies set")
echo "  $COOKIES"

echo "=== Scan Complete ==="
