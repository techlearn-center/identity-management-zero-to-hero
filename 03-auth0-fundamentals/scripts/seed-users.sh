#!/usr/bin/env bash
# ==============================================================================
# seed-users.sh
# Create test users in Auth0 via the Management API
#
# This script creates a set of test users with different roles and metadata,
# useful for development and testing environments.
#
# Prerequisites:
#   - An Auth0 tenant with an M2M application authorized for the Management API
#   - The setup-tenant.sh script should have been run first (to create roles)
#   - curl and jq installed
#   - Environment variables set (see below)
#
# Usage:
#   export AUTH0_DOMAIN="your-tenant.us.auth0.com"
#   export AUTH0_M2M_CLIENT_ID="your-m2m-client-id"
#   export AUTH0_M2M_CLIENT_SECRET="your-m2m-client-secret"
#   ./seed-users.sh
#
# Options:
#   --clean    Delete all test users before creating new ones
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Color output helpers
# ------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
CONNECTION="Username-Password-Authentication"
DEFAULT_PASSWORD="IdmLab!2026#Str0ng"

# Test users: email|name|role|department|plan|employee_id
declare -a USERS=(
  "alice.admin@identity-lab.local|Alice Johnson|Admin|engineering|premium|EMP-001"
  "bob.editor@identity-lab.local|Bob Smith|Editor|marketing|professional|EMP-002"
  "carol.viewer@identity-lab.local|Carol Williams|Viewer|sales|free|EMP-003"
  "dave.admin@identity-lab.local|Dave Brown|Admin|engineering|enterprise|EMP-004"
  "eve.editor@identity-lab.local|Eve Davis|Editor|design|professional|EMP-005"
  "frank.viewer@identity-lab.local|Frank Miller|Viewer|support|free|EMP-006"
  "grace.editor@identity-lab.local|Grace Wilson|Editor|engineering|professional|EMP-007"
  "henry.viewer@identity-lab.local|Henry Taylor|Viewer|hr|free|EMP-008"
)

# ------------------------------------------------------------------------------
# Validate environment
# ------------------------------------------------------------------------------
check_prerequisites() {
  log_info "Checking prerequisites..."

  for cmd in curl jq; do
    if ! command -v "$cmd" &> /dev/null; then
      log_error "$cmd is required but not installed."
      exit 1
    fi
  done

  for var in AUTH0_DOMAIN AUTH0_M2M_CLIENT_ID AUTH0_M2M_CLIENT_SECRET; do
    if [[ -z "${!var:-}" ]]; then
      log_error "$var environment variable is not set."
      exit 1
    fi
  done

  log_success "All prerequisites met."
}

# ------------------------------------------------------------------------------
# Obtain Management API token
# ------------------------------------------------------------------------------
get_mgmt_token() {
  log_info "Obtaining Management API token..."

  AUTH0_TOKEN=$(curl -s --request POST \
    --url "https://${AUTH0_DOMAIN}/oauth/token" \
    --header 'content-type: application/json' \
    --data "{
      \"client_id\": \"${AUTH0_M2M_CLIENT_ID}\",
      \"client_secret\": \"${AUTH0_M2M_CLIENT_SECRET}\",
      \"audience\": \"https://${AUTH0_DOMAIN}/api/v2/\",
      \"grant_type\": \"client_credentials\"
    }" | jq -r '.access_token')

  if [[ -z "$AUTH0_TOKEN" || "$AUTH0_TOKEN" == "null" ]]; then
    log_error "Failed to obtain Management API token."
    exit 1
  fi

  log_success "Management API token obtained."
}

# ------------------------------------------------------------------------------
# Helper: Make authenticated API request with rate limit handling
# ------------------------------------------------------------------------------
auth0_api() {
  local method=$1
  local endpoint=$2
  local data=${3:-}
  local retries=0
  local max_retries=5

  while [[ $retries -lt $max_retries ]]; do
    if [[ -n "$data" ]]; then
      response=$(curl -s -w "\n%{http_code}" --request "$method" \
        --url "https://${AUTH0_DOMAIN}/api/v2${endpoint}" \
        --header "authorization: Bearer ${AUTH0_TOKEN}" \
        --header 'content-type: application/json' \
        --data "$data")
    else
      response=$(curl -s -w "\n%{http_code}" --request "$method" \
        --url "https://${AUTH0_DOMAIN}/api/v2${endpoint}" \
        --header "authorization: Bearer ${AUTH0_TOKEN}")
    fi

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" -eq 429 ]]; then
      wait_time=$((2 ** retries))
      log_warn "Rate limited. Waiting ${wait_time}s..."
      sleep "$wait_time"
      retries=$((retries + 1))
    else
      echo "$body"
      return 0
    fi
  done

  log_error "Max retries exceeded."
  return 1
}

# ------------------------------------------------------------------------------
# Get role IDs
# ------------------------------------------------------------------------------
get_role_ids() {
  log_info "Fetching existing roles..."

  ROLES_JSON=$(auth0_api GET "/roles")

  ADMIN_ROLE_ID=$(echo "$ROLES_JSON" | jq -r '.[] | select(.name == "Admin") | .id // empty')
  EDITOR_ROLE_ID=$(echo "$ROLES_JSON" | jq -r '.[] | select(.name == "Editor") | .id // empty')
  VIEWER_ROLE_ID=$(echo "$ROLES_JSON" | jq -r '.[] | select(.name == "Viewer") | .id // empty')

  if [[ -z "$ADMIN_ROLE_ID" ]]; then
    log_warn "Admin role not found. Run setup-tenant.sh first to create roles."
  fi
  if [[ -z "$EDITOR_ROLE_ID" ]]; then
    log_warn "Editor role not found."
  fi
  if [[ -z "$VIEWER_ROLE_ID" ]]; then
    log_warn "Viewer role not found."
  fi

  log_success "Role IDs: Admin=${ADMIN_ROLE_ID:-N/A}, Editor=${EDITOR_ROLE_ID:-N/A}, Viewer=${VIEWER_ROLE_ID:-N/A}"
}

# ------------------------------------------------------------------------------
# Get role ID by name
# ------------------------------------------------------------------------------
get_role_id_by_name() {
  local role_name=$1
  case "$role_name" in
    "Admin")  echo "$ADMIN_ROLE_ID" ;;
    "Editor") echo "$EDITOR_ROLE_ID" ;;
    "Viewer") echo "$VIEWER_ROLE_ID" ;;
    *)        echo "" ;;
  esac
}

# ------------------------------------------------------------------------------
# Clean up existing test users
# ------------------------------------------------------------------------------
clean_users() {
  log_info "Cleaning up existing test users..."

  for user_entry in "${USERS[@]}"; do
    IFS='|' read -r email name role dept plan emp_id <<< "$user_entry"

    encoded_email=$(echo "$email" | sed 's/@/%40/g')
    existing=$(auth0_api GET "/users?q=email%3A%22${encoded_email}%22&search_engine=v3")
    user_id=$(echo "$existing" | jq -r '.[0].user_id // empty')

    if [[ -n "$user_id" ]]; then
      auth0_api DELETE "/users/${user_id}" > /dev/null 2>&1
      log_info "Deleted: $email"
    fi

    sleep 0.3
  done

  log_success "Cleanup complete."
}

# ------------------------------------------------------------------------------
# Create users and assign roles
# ------------------------------------------------------------------------------
create_users() {
  log_info "Creating test users..."

  local created=0
  local skipped=0
  local failed=0

  for user_entry in "${USERS[@]}"; do
    IFS='|' read -r email name role dept plan emp_id <<< "$user_entry"

    log_info "Creating user: $name ($email) - Role: $role"

    user_result=$(auth0_api POST "/users" "{
      \"email\": \"${email}\",
      \"password\": \"${DEFAULT_PASSWORD}\",
      \"connection\": \"${CONNECTION}\",
      \"email_verified\": true,
      \"name\": \"${name}\",
      \"user_metadata\": {
        \"preferred_language\": \"en\",
        \"timezone\": \"America/New_York\"
      },
      \"app_metadata\": {
        \"plan\": \"${plan}\",
        \"department\": \"${dept}\",
        \"employee_id\": \"${emp_id}\",
        \"role\": \"${role}\"
      }
    }")

    user_id=$(echo "$user_result" | jq -r '.user_id // empty')
    error_code=$(echo "$user_result" | jq -r '.statusCode // empty')

    if [[ "$error_code" == "409" ]]; then
      log_warn "User already exists: $email (skipping)"
      skipped=$((skipped + 1))
      continue
    fi

    if [[ -z "$user_id" ]]; then
      log_error "Failed to create user: $email"
      echo "$user_result" | jq . 2>/dev/null || echo "$user_result"
      failed=$((failed + 1))
      continue
    fi

    log_success "Created user: $email (ID: $user_id)"
    created=$((created + 1))

    # Assign role
    role_id=$(get_role_id_by_name "$role")
    if [[ -n "$role_id" ]]; then
      auth0_api POST "/users/${user_id}/roles" "{\"roles\": [\"${role_id}\"]}" > /dev/null 2>&1
      log_success "  Assigned role: $role"
    else
      log_warn "  Role '$role' not found, skipping role assignment"
    fi

    # Brief pause to respect rate limits
    sleep 0.5
  done

  echo ""
  log_info "Summary: Created=${created}, Skipped=${skipped}, Failed=${failed}"
}

# ------------------------------------------------------------------------------
# List created users
# ------------------------------------------------------------------------------
list_users() {
  echo ""
  log_info "Listing all users in tenant..."
  echo ""

  users=$(auth0_api GET "/users?per_page=50&include_totals=true&sort=created_at:-1")

  total=$(echo "$users" | jq -r '.total // empty')
  if [[ -n "$total" ]]; then
    echo "Total users: $total"
    echo ""
    printf "  %-40s %-20s %-10s %-15s\n" "EMAIL" "NAME" "ROLE" "DEPARTMENT"
    printf "  %-40s %-20s %-10s %-15s\n" "-----" "----" "----" "----------"
    echo "$users" | jq -r '.users[]? | "  \(.email // "N/A" | .[0:38])|\(.name // "N/A" | .[0:18])|\(.app_metadata.role // "N/A")|\(.app_metadata.department // "N/A")"' | \
      while IFS='|' read -r email name role dept; do
        printf "%-40s %-20s %-10s %-15s\n" "$email" "$name" "$role" "$dept"
      done
  else
    echo "Users:"
    echo "$users" | jq -r '.[] | "  \(.email) - \(.name) (\(.app_metadata.role // "no role"))"' 2>/dev/null
  fi

  echo ""
  echo "Default password for all test users: ${DEFAULT_PASSWORD}"
  echo ""
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------
main() {
  echo "============================================"
  echo "  Auth0 User Seed Script"
  echo "  Domain: ${AUTH0_DOMAIN:-NOT SET}"
  echo "============================================"
  echo ""

  check_prerequisites
  get_mgmt_token
  get_role_ids

  # Handle --clean flag
  if [[ "${1:-}" == "--clean" ]]; then
    clean_users
  fi

  create_users
  list_users

  log_success "User seeding complete!"
}

main "$@"
