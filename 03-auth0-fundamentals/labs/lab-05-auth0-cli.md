# Lab 05: Auth0 CLI

## Objectives

By the end of this lab you will be able to:

- Install the Auth0 CLI on your operating system
- Authenticate the CLI with your Auth0 tenant
- Manage applications, APIs, users, and roles from the command line
- Stream tenant logs in real time
- Test login flows from the terminal
- Use the CLI in CI/CD pipelines with non-interactive authentication

## Prerequisites

- Completed [Lab 01: Tenant Setup](lab-01-tenant-setup.md)
- Auth0 tenant with at least one application and users from previous labs
- Terminal access (bash, zsh, PowerShell, or cmd)
- `jq` installed (optional, for JSON formatting)

## Estimated Time

25-30 minutes

---

## Step 1: Install the Auth0 CLI

### macOS (Homebrew)

```bash
brew tap auth0/auth0-cli
brew install auth0
```

### Linux

```bash
# Using the install script
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin

# Or using snap
sudo snap install auth0
```

### Windows

```powershell
# Using Scoop
scoop bucket add auth0 https://github.com/auth0/scoop-auth0-cli.git
scoop install auth0

# Or download the binary from GitHub Releases
# https://github.com/auth0/auth0-cli/releases
```

### Verify Installation

```bash
auth0 --version
# Output: auth0 version x.x.x
```

---

## Step 2: Authenticate with Your Tenant

### Interactive Login (Device Authorization)

```bash
auth0 login
```

This will:
1. Display a device code and a URL
2. Open your browser to the Auth0 device authorization page
3. Ask you to enter the device code
4. Authenticate you with your Auth0 account
5. Store credentials locally for future use

### Select Your Tenant

If you have multiple tenants:

```bash
# List available tenants
auth0 tenants list

# Switch to a specific tenant
auth0 tenants use your-tenant.us.auth0.com
```

### Verify Connection

```bash
# Show current tenant info
auth0 tenants list

# Quick test
auth0 apps list
```

---

## Step 3: Manage Applications

### List Applications

```bash
auth0 apps list
```

Output shows a table with name, type, client ID, and callbacks.

### Create an Application

```bash
# Create a SPA
auth0 apps create \
  --name "CLI Test SPA" \
  --type spa \
  --callbacks "http://localhost:4000/callback" \
  --logout-urls "http://localhost:4000" \
  --origins "http://localhost:4000"

# Create a Regular Web App
auth0 apps create \
  --name "CLI Test Web App" \
  --type regular \
  --callbacks "http://localhost:5000/callback" \
  --logout-urls "http://localhost:5000"

# Create an M2M App
auth0 apps create \
  --name "CLI Test M2M" \
  --type m2m
```

### View Application Details

```bash
# Show details of a specific application
auth0 apps show <CLIENT_ID>

# Open application in the dashboard
auth0 apps open <CLIENT_ID>
```

### Update an Application

```bash
auth0 apps update <CLIENT_ID> \
  --name "Updated App Name" \
  --callbacks "http://localhost:4000/callback,https://myapp.com/callback"
```

### Delete an Application

```bash
auth0 apps delete <CLIENT_ID>
```

---

## Step 4: Manage APIs

### List APIs

```bash
auth0 apis list
```

### Create an API

```bash
auth0 apis create \
  --name "CLI Test API" \
  --identifier "https://api.cli-test.local" \
  --scopes "read:data,write:data,delete:data"
```

### View API Details

```bash
auth0 apis show <API_ID>
```

### Update an API

```bash
auth0 apis update <API_ID> \
  --name "Updated API Name" \
  --scopes "read:data,write:data,delete:data,admin:all"
```

---

## Step 5: Manage Users

### Search Users

```bash
# List all users
auth0 users search

# Search by email
auth0 users search --query "email:alice@example.com"

# Search by name
auth0 users search --query "name:Alice"

# Search with pagination
auth0 users search --number 5
```

### Create a User

```bash
auth0 users create \
  --name "Dave Test" \
  --email "dave@example.com" \
  --connection "Username-Password-Authentication" \
  --password "Str0ng!P@ssw0rd#2024"
```

### View User Details

```bash
auth0 users show <USER_ID>

# Open user in dashboard
auth0 users open <USER_ID>
```

### Update a User

```bash
auth0 users update <USER_ID> \
  --name "Dave T. Test" \
  --email "dave.test@example.com"
```

### Block and Unblock Users

```bash
# Block a user
auth0 users blocks add <USER_ID>

# List blocked users
auth0 users blocks list <USER_ID>

# Unblock a user
auth0 users blocks unblock <USER_ID>
```

### Delete a User

```bash
auth0 users delete <USER_ID>
```

---

## Step 6: Manage Roles

### List Roles

```bash
auth0 roles list
```

### Create a Role

```bash
auth0 roles create \
  --name "Support" \
  --description "Customer support team with read access and ticket management"
```

### View Role Details

```bash
auth0 roles show <ROLE_ID>
```

### Assign Roles to a User

```bash
# List available roles and note the role ID
auth0 roles list

# Assign a role (uses the Management API under the hood)
auth0 users roles assign <USER_ID> --roles <ROLE_ID>
```

### View User's Roles

```bash
auth0 users roles show <USER_ID>
```

---

## Step 7: Test Login Flows

The Auth0 CLI can simulate login flows for testing:

### Test Universal Login

```bash
auth0 test login
```

This will:
1. Open your browser to the Universal Login page
2. Let you authenticate
3. Display the resulting tokens in the terminal
4. Show decoded ID token claims

### Test a Specific Application

```bash
auth0 test login --client-id <CLIENT_ID>
```

### Test Token Exchange

```bash
auth0 test token --client-id <CLIENT_ID> --audience "https://api.identity-lab.local" --scopes "openid profile email read:profile"
```

---

## Step 8: Stream Logs in Real Time

One of the most useful CLI features is real-time log streaming:

### Tail Logs

```bash
# Stream all events
auth0 logs tail

# Stream with a filter
auth0 logs tail --filter "type:s"    # Successful logins only
auth0 logs tail --filter "type:f"    # Failed logins only
auth0 logs tail --filter "type:ss"   # Successful signups

# Show more detail
auth0 logs tail --number 20
```

### Log Event Types

| Type Code | Description |
|---|---|
| `s` | Successful Login |
| `f` | Failed Login |
| `ss` | Successful Signup |
| `fs` | Failed Signup |
| `seacft` | Successful code exchange |
| `feacft` | Failed code exchange |
| `slo` | Successful Logout |
| `flo` | Failed Logout |
| `limit_wc` | Blocked Account (too many attempts) |
| `pwd_leak` | Breached Password |

### List Historical Logs

```bash
# Get the last 100 log entries
auth0 logs list --number 100
```

---

## Step 9: CLI in CI/CD Pipelines

For automated workflows, authenticate without a browser using M2M credentials:

### Non-Interactive Authentication

```bash
export AUTH0_DOMAIN="your-tenant.us.auth0.com"
export AUTH0_CLIENT_ID="your-m2m-client-id"
export AUTH0_CLIENT_SECRET="your-m2m-client-secret"

auth0 login \
  --domain "$AUTH0_DOMAIN" \
  --client-id "$AUTH0_CLIENT_ID" \
  --client-secret "$AUTH0_CLIENT_SECRET"
```

### GitHub Actions Example

```yaml
name: Auth0 Configuration
on:
  push:
    branches: [main]
    paths: ['auth0/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Auth0 CLI
        run: |
          curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin

      - name: Authenticate
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
          AUTH0_CLIENT_ID: ${{ secrets.AUTH0_M2M_CLIENT_ID }}
          AUTH0_CLIENT_SECRET: ${{ secrets.AUTH0_M2M_CLIENT_SECRET }}
        run: |
          auth0 login \
            --domain "$AUTH0_DOMAIN" \
            --client-id "$AUTH0_CLIENT_ID" \
            --client-secret "$AUTH0_CLIENT_SECRET"

      - name: Verify Connection
        run: auth0 tenants list

      - name: List Users
        run: auth0 users search --number 5
```

### Scripting with CLI Output

The CLI outputs JSON when piped, making it scriptable:

```bash
# Get all user emails as a flat list
auth0 users search --json | jq -r '.[].email'

# Count users by connection
auth0 users search --json --number 100 | jq -r '.[].identities[0].connection' | sort | uniq -c

# Export user list to CSV
auth0 users search --json --number 100 \
  | jq -r '.[] | [.email, .name, .created_at, .logins_count] | @csv' \
  > users.csv
```

---

## Step 10: CLI Configuration and Shortcuts

### View CLI Configuration

```bash
# Show current configuration
auth0 tenants list

# Configuration is stored in ~/.config/auth0/config.json
```

### Useful Aliases

Add these to your shell profile (`.bashrc`, `.zshrc`):

```bash
alias a0="auth0"
alias a0users="auth0 users search"
alias a0logs="auth0 logs tail"
alias a0apps="auth0 apps list"
alias a0test="auth0 test login"
```

---

## Validation Checklist

- [ ] Auth0 CLI installed and version verified
- [ ] Authenticated with your Auth0 tenant
- [ ] Applications listed, created, and deleted via CLI
- [ ] APIs listed and created via CLI
- [ ] Users searched, created, and viewed via CLI
- [ ] Roles listed and assigned via CLI
- [ ] Login flow tested from the CLI
- [ ] Logs streamed in real time
- [ ] Non-interactive authentication understood for CI/CD

---

## Troubleshooting

### "auth0: command not found"

**Cause**: CLI not in your PATH.

**Fix**: Ensure the installation directory is in your PATH. For manual installs, move the binary to `/usr/local/bin/` or add its directory to PATH.

### "Login required" After Restart

**Cause**: CLI credentials expired or were not persisted.

**Fix**: Run `auth0 login` again. Credentials are stored in `~/.config/auth0/config.json`.

### "Forbidden" Errors on CLI Operations

**Cause**: The authenticated account does not have admin access to the tenant, or M2M app lacks required scopes.

**Fix**: Ensure you are logged in as the tenant owner/admin. For M2M auth, verify the application has the necessary Management API scopes.

### CLI Output Is Not JSON

**Cause**: By default, the CLI outputs a human-readable table format.

**Fix**: Add the `--json` flag to get JSON output for scripting.

### "Device Authorization" Takes Too Long

**Cause**: Browser did not open automatically, or the device code expired.

**Fix**: Manually open the URL displayed in the terminal and enter the device code. If it expired, run `auth0 login` again.

---

## Next Lab

You have completed the Auth0 Fundamentals module. Proceed to [Module 04: Auth0 Advanced](../../04-auth0-advanced/README.md) to learn about SSO, MFA, Actions, Organizations, and more.
