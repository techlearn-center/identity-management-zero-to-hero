# Module 04: Auth0 Advanced

## Overview

This module covers advanced Auth0 features for production-grade identity management. You will learn how to implement Single Sign-On (SSO), configure Multi-Factor Authentication (MFA), build custom logic with Auth0 Actions, set up B2B multi-tenancy with Organizations, migrate users from legacy systems, and harden your tenant against attacks.

By the end of this module you will be able to design and implement enterprise-grade identity solutions using Auth0's full feature set.

---

## Table of Contents

1. [Single Sign-On (SSO)](#single-sign-on-sso)
2. [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
3. [Auth0 Actions](#auth0-actions)
4. [Auth0 Rules (Legacy)](#auth0-rules-legacy)
5. [Organizations (B2B Multi-Tenancy)](#organizations-b2b-multi-tenancy)
6. [Role-Based Access Control](#role-based-access-control-in-auth0)
7. [Custom Database Connections](#custom-database-connections)
8. [User Migration Strategies](#user-migration-strategies)
9. [Auth0 Logs and Monitoring](#auth0-logs-and-monitoring)
10. [Rate Limiting and Attack Protection](#rate-limiting-and-attack-protection)
11. [Breached Password Detection](#breached-password-detection)

---

## Single Sign-On (SSO)

Single Sign-On allows users to authenticate once and access multiple applications without logging in again. Auth0 supports SSO natively through session management at the tenant level.

### How SSO Works in Auth0

1. User logs into **App A** via Auth0 Universal Login
2. Auth0 creates an SSO session (cookie on the Auth0 domain)
3. User navigates to **App B** (which also uses the same Auth0 tenant)
4. App B redirects to Auth0 for login
5. Auth0 detects the existing SSO session
6. User is automatically authenticated in App B without entering credentials

### SSO Session Configuration

SSO sessions are controlled at the tenant level:

| Setting | Description | Default |
|---|---|---|
| **Inactivity Timeout** | Session expires after inactivity | 3 days |
| **Session Lifetime** | Maximum session duration regardless of activity | 7 days |
| **Persistent Sessions** | Session survives browser restart | Disabled |

Configure in **Settings > Advanced > Login Session Management**.

### SSO with Enterprise Connections

For enterprise SSO (e.g., employees using their corporate IdP):

1. Configure an enterprise connection (SAML, OIDC, Azure AD)
2. Auth0 acts as a Service Provider (SP) or Relying Party (RP)
3. The corporate IdP handles authentication
4. Auth0 issues tokens for your applications

### SSO Integrations

Auth0 provides pre-built SSO integrations for popular SaaS applications:

- Slack, Zoom, Salesforce, Zendesk
- Box, Dropbox, Google Workspace
- AWS, Azure, GitHub Enterprise

Configure under **Applications > SSO Integrations**.

---

## Multi-Factor Authentication (MFA)

MFA adds an extra layer of security by requiring users to provide a second factor beyond their password.

### Supported MFA Factors

| Factor | Description | Security Level |
|---|---|---|
| **TOTP** | Time-based one-time password (Google Authenticator, Authy) | High |
| **SMS** | One-time code sent via text message | Medium |
| **Email** | One-time code sent via email | Medium |
| **Push Notifications** | Auth0 Guardian push to mobile | High |
| **WebAuthn (Roaming)** | Hardware security keys (YubiKey, Titan) | Very High |
| **WebAuthn (Platform)** | Biometrics (Touch ID, Windows Hello) | Very High |
| **Recovery Codes** | Backup codes for account recovery | N/A (backup only) |

### MFA Policies

Auth0 offers flexible MFA policies:

- **Never** -- MFA is disabled
- **Always** -- MFA required for every login
- **Adaptive** -- MFA triggered based on risk signals (new device, new location, impossible travel)
- **Confidence-based** -- MFA required only when Auth0 detects low-confidence authentication

### Configuring MFA

1. Go to **Security > Multi-factor Auth** in the dashboard
2. Enable your desired factors
3. Set the policy (Always, Adaptive, or Custom via Actions)
4. Configure factor-specific settings:
   - **TOTP**: Enable OTP fallback
   - **SMS**: Configure Twilio or a custom SMS provider
   - **Push**: Set up Auth0 Guardian
   - **WebAuthn**: Configure attestation preferences

### Forcing MFA via Actions

For fine-grained MFA control, use a post-login Action:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Require MFA for admin users
  if (event.user.app_metadata?.role === 'admin') {
    api.multifactor.enable('any', { allowRememberBrowser: true });
  }

  // Require MFA for sensitive operations
  if (event.request.query?.audience === 'https://api.admin.example.com') {
    api.multifactor.enable('any', { allowRememberBrowser: false });
  }
};
```

---

## Auth0 Actions

Actions are serverless functions that execute at specific points in the Auth0 pipeline. They replace the legacy Rules and Hooks features.

### Action Triggers (Flows)

| Trigger | When It Fires | Common Use Cases |
|---|---|---|
| **Post Login** | After successful authentication | Enrich tokens, enforce policies, sync data |
| **Pre User Registration** | Before a user is created | Validate business rules, block disposable emails |
| **Post User Registration** | After a user is created | Send welcome notifications, sync to CRM |
| **Post Change Password** | After password change | Audit logging, notify security team |
| **Send Phone Message** | When MFA SMS is needed | Custom SMS provider integration |
| **Machine to Machine** | During M2M token exchange | Add custom claims to M2M tokens |
| **Password Reset Post Challenge** | After password reset verification | Custom post-reset logic |

### Action Structure

```javascript
/**
 * @param {Event} event - Details about the user and the context
 * @param {PostLoginAPI} api - Methods to modify the login flow
 */
exports.onExecutePostLogin = async (event, api) => {
  // event.user         -- The authenticated user
  // event.request      -- HTTP request details
  // event.connection   -- Connection used for authentication
  // event.client       -- Application that initiated login
  // event.organization -- Organization (if B2B)
  // event.secrets      -- Secrets stored in the Action
  // event.transaction  -- Transaction details (protocol, etc.)

  // api.idToken.setCustomClaim()    -- Add claims to ID token
  // api.accessToken.setCustomClaim() -- Add claims to access token
  // api.user.setAppMetadata()       -- Update app_metadata
  // api.user.setUserMetadata()      -- Update user_metadata
  // api.multifactor.enable()        -- Trigger MFA
  // api.access.deny()               -- Block the login
  // api.redirect.sendUserTo()       -- Redirect to external page
};
```

### Action Dependencies

Actions support npm packages. Add dependencies in the Action editor:

```javascript
// Using the axios package (add via Dependencies tab)
const axios = require('axios');

exports.onExecutePostLogin = async (event, api) => {
  const { data } = await axios.get('https://api.internal.com/user-status', {
    params: { email: event.user.email },
    headers: { Authorization: `Bearer ${event.secrets.INTERNAL_API_KEY}` }
  });

  api.accessToken.setCustomClaim('https://myapp.com/status', data.status);
};
```

### Action Secrets

Store sensitive values in Action secrets (not in code):

1. Open the Action editor
2. Click **Secrets** (lock icon)
3. Add key-value pairs (e.g., `API_KEY`, `WEBHOOK_URL`)
4. Access via `event.secrets.API_KEY`

### Action Versioning

- Actions have versions (drafts and deployed)
- You can test changes before deploying
- Roll back to a previous version if needed
- Each flow can have multiple Actions executed in order (drag to reorder)

---

## Auth0 Rules (Legacy)

Rules are the predecessor to Actions. They are JavaScript functions that run during the authentication pipeline.

### Why Migrate from Rules to Actions

| Aspect | Rules | Actions |
|---|---|---|
| **Architecture** | Synchronous, single pipeline | Asynchronous, multiple triggers |
| **Dependencies** | Limited built-in modules | Full npm package support |
| **Debugging** | Limited | Real-time logging, test runner |
| **Versioning** | No versioning | Draft/deploy with rollback |
| **Performance** | Runs sequentially, can timeout | Better isolation and performance |
| **Maintenance** | Deprecated | Actively developed |

### Migration Steps

1. **Audit existing Rules**: List all active Rules and their purpose
2. **Map to Action triggers**: Determine which trigger each Rule maps to
3. **Rewrite as Actions**: Convert Rule code to Action syntax
4. **Test thoroughly**: Use the Action test runner
5. **Deploy Actions**: Add to the appropriate flow
6. **Disable Rules**: Turn off Rules after Actions are verified

### Example Migration

**Rule (old)**:
```javascript
function addRolesToToken(user, context, callback) {
  const namespace = 'https://myapp.com/';
  const assignedRoles = (context.authorization || {}).roles;
  context.idToken[namespace + 'roles'] = assignedRoles;
  context.accessToken[namespace + 'roles'] = assignedRoles;
  callback(null, user, context);
}
```

**Action (new)**:
```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://myapp.com/';
  const roles = event.authorization?.roles || [];
  api.idToken.setCustomClaim(namespace + 'roles', roles);
  api.accessToken.setCustomClaim(namespace + 'roles', roles);
};
```

---

## Organizations (B2B Multi-Tenancy)

Auth0 Organizations let you model B2B multi-tenancy where each customer (organization) can have its own login experience, identity providers, and member management.

### Key Concepts

- **Organization**: Represents a customer/company in your B2B app
- **Members**: Users belonging to an organization
- **Connections**: Each org can have its own identity sources (e.g., Acme Corp uses Okta, Beta Inc uses Azure AD)
- **Branding**: Each org can have custom login page branding
- **Invitations**: Invite users to join an organization via email

### Organization Flow

```
User visits app.example.com/login?organization=org_AcmeCorp
  -> Auth0 shows Acme Corp's branded login page
  -> User authenticates via Acme's configured IdP (e.g., Okta SAML)
  -> Auth0 issues tokens with org_id claim
  -> App validates org_id and scopes access to Acme's data
```

### Token Claims

When a user logs in via an organization, tokens include:

```json
{
  "org_id": "org_AcmeCorp123",
  "org_name": "Acme Corporation",
  "permissions": ["read:data", "write:data"]
}
```

### When to Use Organizations

- SaaS platforms with multiple business customers
- Each customer needs their own IdP (SAML, OIDC, etc.)
- Different roles/permissions per customer
- Branded login per customer
- Centralized user management per customer admin

---

## Role-Based Access Control in Auth0

Auth0 RBAC provides a way to assign permissions to roles and roles to users.

### RBAC Architecture

```
Permission (read:items) ─── Role (Editor) ─── User (alice@example.com)
Permission (write:items) ──┘                       │
                                                    Role (Viewer)
Permission (read:items) ──── Role (Viewer) ─── User (bob@example.com)
```

### Enabling RBAC

1. Go to **Applications > APIs > your API > Settings**
2. Enable **RBAC**
3. Enable **Add Permissions in the Access Token**

### Permissions in Tokens

With RBAC enabled, access tokens include a `permissions` claim:

```json
{
  "iss": "https://your-tenant.us.auth0.com/",
  "sub": "auth0|123",
  "aud": "https://api.example.com",
  "permissions": ["read:profile", "write:profile", "read:items"]
}
```

### Backend Validation

```python
# Python (FastAPI) example
from fastapi import Depends, HTTPException
import jwt

def require_permission(required_permission: str):
    def permission_checker(token: dict = Depends(verify_token)):
        permissions = token.get("permissions", [])
        if required_permission not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return token
    return permission_checker

@app.get("/items")
async def list_items(token=Depends(require_permission("read:items"))):
    return {"items": [...]}
```

---

## Custom Database Connections

Custom database connections let you use your own database as the identity store while leveraging Auth0's features.

### Use Cases

- **Gradual migration**: Keep users in your legacy database during transition
- **Existing user store**: You have a database with millions of users you cannot move immediately
- **Custom validation**: Password hashing with a non-standard algorithm

### Scripts

Custom database connections require two scripts:

1. **Login**: Authenticate a user against your database
2. **Get User**: Look up a user by email (used for password reset, social linking)

Optional scripts:
3. **Create**: Register a new user in your database
4. **Change Password**: Update password in your database
5. **Verify**: Mark email as verified
6. **Delete**: Remove a user from your database

### Automatic Migration

Enable **Import Users to Auth0** to progressively migrate users:

1. User logs in for the first time via your custom DB connection
2. Auth0 calls your Login script to validate credentials
3. If successful, Auth0 creates a local copy of the user
4. Subsequent logins use Auth0's database (no custom script call)
5. Over time, all active users migrate to Auth0

---

## User Migration Strategies

### Strategy 1: Automatic (Trickle) Migration

- Users migrate when they log in
- No downtime, transparent to users
- Only active users migrate
- Requires custom database scripts
- Migration timeline depends on user login frequency

### Strategy 2: Bulk Import

- Export all users from legacy system
- Format as JSON per Auth0's import schema
- Use the Management API `/api/v2/jobs/users-imports` endpoint
- Users receive a password reset email (passwords cannot be imported if hashed differently)
- Fast, predictable timeline
- See `migrations/bulk-import-script.py` for implementation

### Strategy 3: Hybrid

- Bulk import all users (without passwords)
- Set up custom database for password validation
- Users log in with their existing password (validated by custom DB script)
- On successful login, Auth0 creates the local password hash
- After migration period, disable custom database

### Password Handling

| Legacy Hash | Strategy |
|---|---|
| bcrypt | Direct import possible (Auth0 uses bcrypt) |
| PBKDF2 | Custom login script with PBKDF2 validation |
| SHA-256/MD5 | Custom login script; force password reset on first login |
| Plaintext | Custom login script; immediately hash on migration |
| Unknown | Bulk import without passwords + password reset flow |

---

## Auth0 Logs and Monitoring

### Log Types

Auth0 generates detailed logs for every event:

| Category | Event Types |
|---|---|
| **Authentication** | Login success/failure, signup, logout |
| **Token** | Token issued, refreshed, revoked |
| **Management** | User CRUD, config changes, API calls |
| **Security** | Breached password, brute force, anomaly |
| **MFA** | Factor enrollment, challenge success/failure |

### Log Retention

| Plan | Retention |
|---|---|
| Free | 2 days |
| Essential | 2 days |
| Professional | 10 days |
| Enterprise | 30 days |

### Log Streams

For long-term retention and analysis, forward logs to external systems:

- **Amazon EventBridge** -- Route to any AWS service
- **Amazon S3** -- Store logs in S3 buckets
- **Azure Event Hub** -- Stream to Azure services
- **Datadog** -- Real-time monitoring and alerting
- **Splunk** -- Enterprise SIEM integration
- **Sumo Logic** -- Cloud-native analytics
- **Custom Webhook** -- Send to any HTTP endpoint
- **Mixpanel** -- Product analytics

### Setting Up a Log Stream

1. Go to **Monitoring > Streams**
2. Click **+ Create Stream**
3. Select your destination (e.g., Datadog)
4. Enter the required configuration (API key, endpoint, etc.)
5. Select which event categories to stream
6. Click **Save**

---

## Rate Limiting and Attack Protection

### Rate Limits

Auth0 applies rate limits to protect the platform and your tenant:

| Endpoint Category | Free | Essential | Professional | Enterprise |
|---|---|---|---|---|
| Authentication | 300/min | 300/min | 300/min | Custom |
| Management API | 2/sec | 10/sec | 50/sec | Custom |
| User Search | 20/sec | 20/sec | 20/sec | Custom |

### Attack Protection Features

Auth0 provides three layers of attack protection:

#### 1. Bot Detection

- Uses CAPTCHA to block automated attacks
- Triggered on login and signup
- Configurable sensitivity

#### 2. Brute Force Protection

Protects against credential stuffing and brute force attacks:

- **Mode**: Count per identifier, per IP, or both
- **Threshold**: Number of failed attempts before blocking (default: 10)
- **Block duration**: Configurable (default: until admin unblock or user self-service)
- **Notifications**: Alert admins and/or users

#### 3. Suspicious IP Throttling

Detects unusual activity from specific IPs:

- Tracks failed login velocity per IP
- Blocks IPs that exceed the threshold
- Separate thresholds for login and registration
- Allow-lists for known IPs (VPNs, office IPs)

---

## Breached Password Detection

Auth0 checks user passwords against databases of known breached credentials.

### How It Works

1. When a user signs up or logs in with a database connection, Auth0 hashes the password
2. The hash is checked against Auth0's database of breached credentials (sourced from public breach datasets)
3. If a match is found, Auth0 can:
   - **Block** the login/signup
   - **Notify the admin** via email or log stream
   - **Notify the user** and require password change

### Configuration

1. Go to **Security > Attack Protection > Breached Password Detection**
2. Enable the feature
3. Choose detection stages:
   - **On signup**: Block users from creating accounts with breached passwords
   - **On login**: Detect when existing users log in with breached passwords
   - **On password change**: Prevent users from changing to a breached password
4. Select the response:
   - Block access
   - Send admin notification
   - Send user notification

### Response in Your Application

When a breached password is detected, Auth0 returns an error:

```json
{
  "error": "access_denied",
  "error_description": "password_leaked"
}
```

Your application should handle this by showing a message like: "Your password has been found in a data breach. Please reset your password."

---

## Key Takeaways

| Feature | When to Use |
|---|---|
| **SSO** | Multiple apps in your organization need seamless login |
| **MFA** | Protect sensitive accounts and meet compliance requirements |
| **Actions** | Custom logic at any point in the auth pipeline |
| **Organizations** | B2B SaaS with per-customer identity configuration |
| **Custom DB** | Legacy database migration or custom password validation |
| **Automatic Migration** | Gradual, transparent user migration from legacy systems |
| **Bulk Import** | Fast, predictable migration with a known timeline |
| **Log Streams** | Long-term log retention and real-time security monitoring |
| **Attack Protection** | Protect against bots, brute force, and credential stuffing |
| **Breached Passwords** | Prevent use of compromised credentials |

---

## Labs

1. [Lab 01: SSO Setup](labs/lab-01-sso-setup.md) -- Configure SSO between two applications
2. [Lab 02: MFA Configuration](labs/lab-02-mfa-configuration.md) -- Enable MFA with multiple factors
3. [Lab 03: Actions Pipeline](labs/lab-03-actions-pipeline.md) -- Build custom Auth0 Actions
4. [Lab 04: Organizations](labs/lab-04-organizations.md) -- Set up B2B multi-tenancy
5. [Lab 05: User Migration](labs/lab-05-user-migration.md) -- Migrate users from a legacy system
6. [Lab 06: Attack Protection](labs/lab-06-attack-protection.md) -- Configure security protections

## Code Samples

- [rules-actions/](rules-actions/) -- Auth0 Action scripts
- [migrations/](migrations/) -- User migration scripts

---

## Next Steps

After completing this module, proceed to Module 05 to learn about integrating Auth0 with real application frameworks (React, Node.js, Python) and implementing end-to-end authentication flows.
