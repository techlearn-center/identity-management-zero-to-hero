#!/bin/bash
# setup-tenant.sh - Configure Auth0 tenant via Management API
set -euo pipefail

AUTH0_DOMAIN="${AUTH0_DOMAIN:?Set AUTH0_DOMAIN}"
AUTH0_M2M_CLIENT_ID="${AUTH0_M2M_CLIENT_ID:?Set AUTH0_M2M_CLIENT_ID}"
AUTH0_M2M_CLIENT_SECRET="${AUTH0_M2M_CLIENT_SECRET:?Set AUTH0_M2M_CLIENT_SECRET}"

echo "=== Auth0 Tenant Setup ==="

MGMT_TOKEN=$(curl -s -X POST "https://$AUTH0_DOMAIN/oauth/token" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$AUTH0_M2M_CLIENT_ID\",\"client_secret\":\"$AUTH0_M2M_CLIENT_SECRET\",\"audience\":\"https://$AUTH0_DOMAIN/api/v2/\",\"grant_type\":\"client_credentials\"}" | jq -r '.access_token')

echo "[1/4] Creating API..."
curl -s -X POST "https://$AUTH0_DOMAIN/api/v2/resource-servers" \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Identity Lab API","identifier":"https://api.identity-lab.local","signing_alg":"RS256","scopes":[{"value":"read:data"},{"value":"write:data"},{"value":"delete:data"},{"value":"admin:all"}]}' | jq '{name,identifier}' 2>/dev/null || echo "API may already exist"

echo "[2/4] Creating roles..."
for role in '{"name":"admin","description":"Full admin"}' '{"name":"editor","description":"Edit content"}' '{"name":"viewer","description":"Read only"}'; do
  curl -s -X POST "https://$AUTH0_DOMAIN/api/v2/roles" \
    -H "Authorization: Bearer $MGMT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$role" | jq -r '.name // "exists"'
done

echo "[3/4] Configuring tenant..."
curl -s -X PATCH "https://$AUTH0_DOMAIN/api/v2/tenants/settings" \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"friendly_name":"Identity Lab","session_lifetime":1,"idle_session_lifetime":0.5}' > /dev/null

echo "[4/4] Enabling OTP MFA..."
curl -s -X PUT "https://$AUTH0_DOMAIN/api/v2/guardian/factors/otp" \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}' > /dev/null

echo "=== Setup Complete ==="
