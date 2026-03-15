# Lab 04: Auth0 Management API

## Objectives

By the end of this lab you will be able to:

- Obtain a Management API access token via Client Credentials
- Create, read, update, and delete users via the API
- Create roles and permissions
- Assign roles to users
- Search users with Lucene query syntax
- Understand Management API rate limits and best practices

## Prerequisites

- Completed [Lab 01: Tenant Setup](lab-01-tenant-setup.md)
- Auth0 tenant with an M2M application authorized for the Management API
- `curl` and `jq` installed on your machine
- Basic understanding of REST APIs and JSON

## Estimated Time

35-45 minutes

---

## Step 1: Create an M2M Application for the Management API

1. Navigate to **Applications > Applications** in the Auth0 Dashboard
2. Click **+ Create Application**
3. Fill in:
   - **Name**: `Management API Client`
   - **Type**: Select **Machine to Machine Applications**
4. Click **Create**
5. When prompted to select an API, choose **Auth0 Management API**
6. Select the scopes your application needs. For this lab, enable:

```
read:users          create:users          update:users          delete:users
read:users_app_metadata                   update:users_app_metadata
read:roles          create:roles          update:roles          delete:roles
read:role_members   create:role_members
read:connections
read:stats
read:logs
```

7. Click **Authorize**
8. Note the **Client ID** and **Client Secret** from the Settings tab

---

## Step 2: Obtain a Management API Token

Set up environment variables:

```bash
export AUTH0_DOMAIN="your-tenant.us.auth0.com"
export AUTH0_M2M_CLIENT_ID="your-m2m-client-id"
export AUTH0_M2M_CLIENT_SECRET="your-m2m-client-secret"
```

Request an access token:

```bash
AUTH0_TOKEN=$(curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/oauth/token" \
  --header 'content-type: application/json' \
  --data "{
    \"client_id\": \"${AUTH0_M2M_CLIENT_ID}\",
    \"client_secret\": \"${AUTH0_M2M_CLIENT_SECRET}\",
    \"audience\": \"https://${AUTH0_DOMAIN}/api/v2/\",
    \"grant_type\": \"client_credentials\"
  }" | jq -r '.access_token')

echo "Token obtained: ${AUTH0_TOKEN:0:20}..."
```

### Verify the Token

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .
```

Expected response includes API version and description.

> **Note**: Management API tokens expire after 24 hours by default. For production scripts, always request a fresh token at the start of each run.

---

## Step 3: User CRUD Operations

### Create Users

Create a user with email and password:

```bash
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/users" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "email": "alice@example.com",
    "password": "Str0ng!P@ssw0rd#2024",
    "connection": "Username-Password-Authentication",
    "email_verified": true,
    "name": "Alice Johnson",
    "nickname": "alice",
    "user_metadata": {
      "preferred_language": "en",
      "timezone": "America/New_York"
    },
    "app_metadata": {
      "plan": "premium",
      "department": "engineering",
      "employee_id": "EMP-001"
    }
  }' | jq .
```

Create several more test users:

```bash
# Bob - regular user
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/users" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "email": "bob@example.com",
    "password": "Str0ng!P@ssw0rd#2024",
    "connection": "Username-Password-Authentication",
    "email_verified": true,
    "name": "Bob Smith",
    "app_metadata": { "plan": "free", "department": "sales" }
  }' | jq '.user_id'

# Carol - admin user
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/users" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "email": "carol@example.com",
    "password": "Str0ng!P@ssw0rd#2024",
    "connection": "Username-Password-Authentication",
    "email_verified": true,
    "name": "Carol Williams",
    "app_metadata": { "plan": "enterprise", "department": "management" }
  }' | jq '.user_id'
```

### Read Users

**Get all users** (paginated, default 50 per page):

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?per_page=10&page=0&include_totals=true" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .
```

**Get a specific user by ID**:

```bash
USER_ID="auth0|64a1b2c3d4e5f6a7b8c9d0e1"  # Replace with actual user_id

curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .
```

**Search users by email**:

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=email%3A%22alice%40example.com%22&search_engine=v3" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .
```

**Search users with Lucene query syntax**:

```bash
# Users in the engineering department
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=app_metadata.department%3A%22engineering%22&search_engine=v3" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq '.[].name'

# Users created in the last 7 days
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=created_at%3A%5B$(date -d '7 days ago' +%Y-%m-%d)%20TO%20*%5D&search_engine=v3" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq '.[].email'

# Users with verified emails on the premium plan
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=email_verified%3Atrue%20AND%20app_metadata.plan%3A%22premium%22&search_engine=v3" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq '.[].email'
```

### Update Users

**Update user profile**:

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "name": "Alice M. Johnson",
    "nickname": "alice.johnson",
    "user_metadata": {
      "preferred_language": "en",
      "timezone": "America/New_York",
      "theme": "dark"
    }
  }' | jq '.name, .user_metadata'
```

**Update app_metadata** (server-controlled metadata):

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "app_metadata": {
      "plan": "enterprise",
      "department": "engineering",
      "employee_id": "EMP-001",
      "permissions_synced_at": "2026-03-15T00:00:00Z"
    }
  }' | jq '.app_metadata'
```

> **user_metadata vs app_metadata**:
> - `user_metadata`: Data the user can read and update (preferences, settings). Editable by the user via the Management API.
> - `app_metadata`: Data only the server can modify (roles, plans, internal IDs). Not visible or editable by the user through regular APIs.

### Delete Users

```bash
curl -s --request DELETE \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}"

# No response body on success (204 No Content)
echo "User deleted: $?"
```

> **Warning**: Deletion is permanent and cannot be undone. In production, consider blocking users instead of deleting them.

**Block a user instead of deleting**:

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{ "blocked": true }' | jq '.blocked'
```

---

## Step 4: Role-Based Access Control (RBAC)

### Enable RBAC on Your API

1. Go to **Applications > APIs > Identity Lab API**
2. Click the **Settings** tab
3. Under **RBAC Settings**, enable:
   - **Enable RBAC**: Yes
   - **Add Permissions in the Access Token**: Yes
4. Click **Save**

### Create Roles

```bash
# Create Admin role
ADMIN_ROLE=$(curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "name": "Admin",
    "description": "Full administrative access to all resources"
  }' | jq -r '.id')

echo "Admin Role ID: ${ADMIN_ROLE}"

# Create Editor role
EDITOR_ROLE=$(curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "name": "Editor",
    "description": "Can read and write content but cannot manage users"
  }' | jq -r '.id')

echo "Editor Role ID: ${EDITOR_ROLE}"

# Create Viewer role
VIEWER_ROLE=$(curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "name": "Viewer",
    "description": "Read-only access to content"
  }' | jq -r '.id')

echo "Viewer Role ID: ${VIEWER_ROLE}"
```

### Assign Permissions to Roles

```bash
# Get the API identifier (resource server ID)
API_ID=$(curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/resource-servers" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq -r '.[] | select(.name == "Identity Lab API") | .id')

# Assign all permissions to Admin role
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles/${ADMIN_ROLE}/permissions" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "permissions": [
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "read:profile" },
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "write:profile" },
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "read:items" },
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "write:items" }
    ]
  }'

# Assign read + write to Editor role
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles/${EDITOR_ROLE}/permissions" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "permissions": [
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "read:profile" },
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "read:items" },
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "write:items" }
    ]
  }'

# Assign read-only to Viewer role
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles/${VIEWER_ROLE}/permissions" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "permissions": [
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "read:profile" },
      { "resource_server_identifier": "https://api.identity-lab.local", "permission_name": "read:items" }
    ]
  }'
```

### Assign Roles to Users

```bash
# Get Alice's user ID
ALICE_ID=$(curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=email%3A%22alice%40example.com%22&search_engine=v3" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq -r '.[0].user_id')

# Assign Admin role to Alice
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${ALICE_ID}/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data "{\"roles\": [\"${ADMIN_ROLE}\"]}"

# Get Bob's user ID and assign Viewer role
BOB_ID=$(curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=email%3A%22bob%40example.com%22&search_engine=v3" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq -r '.[0].user_id')

curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${BOB_ID}/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data "{\"roles\": [\"${VIEWER_ROLE}\"]}"
```

### List a User's Roles

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${ALICE_ID}/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq '.[].name'
```

### List Members of a Role

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/roles/${ADMIN_ROLE}/users" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq '.[].email'
```

---

## Step 5: Explore Additional API Endpoints

### List Connections

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/connections" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq '.[] | {name: .name, strategy: .strategy, id: .id}'
```

### Get Tenant Statistics

```bash
# Active users count
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/stats/active-users" \
  --header "authorization: Bearer ${AUTH0_TOKEN}"

# Daily stats for the last 7 days
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/stats/daily?from=$(date -d '7 days ago' +%Y%m%d)&to=$(date +%Y%m%d)" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .
```

### View Tenant Logs

```bash
# Last 10 log events
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/logs?per_page=10&sort=date:-1" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq '.[] | {date: .date, type: .type, description: .description, user_name: .user_name}'
```

---

## Step 6: Rate Limits and Best Practices

### Understanding Rate Limits

The Management API has rate limits based on your Auth0 plan:

| Plan | Rate Limit |
|---|---|
| Free | 2 requests/second |
| Essential | 10 requests/second |
| Professional | 50 requests/second |
| Enterprise | Custom |

Rate limit headers in every response:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1700000060
```

### Best Practices

1. **Cache tokens**: Reuse Management API tokens until they expire (check `exp` claim)
2. **Paginate results**: Always use `per_page` and `page` parameters for list endpoints
3. **Use search_engine=v3**: Always specify the latest search engine version
4. **Handle rate limits**: Implement exponential backoff when receiving 429 responses
5. **Minimize scopes**: Only request the Management API scopes you need
6. **Use webhooks**: Instead of polling the API, use Auth0 Log Streams for real-time events
7. **Batch operations**: Group related operations to minimize API calls

### Rate Limit Handling Example

```bash
#!/bin/bash
# rate-limited-request.sh

make_request() {
  local url=$1
  local retries=0
  local max_retries=5

  while [ $retries -lt $max_retries ]; do
    response=$(curl -s -w "\n%{http_code}" --request GET \
      --url "$url" \
      --header "authorization: Bearer ${AUTH0_TOKEN}")

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)

    if [ "$http_code" -eq 429 ]; then
      wait_time=$((2 ** retries))
      echo "Rate limited. Waiting ${wait_time}s before retry..." >&2
      sleep $wait_time
      retries=$((retries + 1))
    else
      echo "$body"
      return 0
    fi
  done

  echo "Max retries exceeded" >&2
  return 1
}

make_request "https://${AUTH0_DOMAIN}/api/v2/users?per_page=10"
```

---

## Validation Checklist

- [ ] M2M application created and authorized for Management API
- [ ] Management API token obtained via Client Credentials
- [ ] Users created via the API (Alice, Bob, Carol)
- [ ] Users searchable by email and app_metadata
- [ ] Users updatable (name, metadata)
- [ ] Roles created (Admin, Editor, Viewer)
- [ ] Permissions assigned to roles
- [ ] Roles assigned to users
- [ ] User's roles retrievable via API
- [ ] Rate limit headers understood

---

## Troubleshooting

### "Insufficient scope" Error (403)

**Cause**: The M2M application does not have the required scopes for the operation.

**Fix**: Go to **Applications > APIs > Auth0 Management API > Machine to Machine Applications**, find your M2M app, and add the missing scopes.

### "Path validation error" on User Creation

**Cause**: Missing required fields or invalid field values.

**Fix**: Ensure `email`, `password`, and `connection` are all provided. Password must meet the connection's password policy.

### "The user already exists"

**Cause**: A user with that email already exists in the specified connection.

**Fix**: Use the search API to find the existing user, or use a different email.

### Token Expired (401)

**Cause**: Management API tokens expire after 24 hours.

**Fix**: Request a new token using the Client Credentials grant.

### Search Returns Empty Results

**Cause**: Using v2 search engine (default) which has limited capabilities, or query syntax error.

**Fix**: Always append `&search_engine=v3` to search queries. URL-encode the query parameter properly.

---

## Next Lab

Proceed to [Lab 05: Auth0 CLI](lab-05-auth0-cli.md) to learn command-line management of your Auth0 tenant.
