# Lab 03: Actions Pipeline

## Objectives

By the end of this lab you will be able to:

- Create and deploy Auth0 Actions for the post-login flow
- Enrich user profiles and tokens with data from external APIs
- Implement role mapping based on user attributes
- Validate user registration with pre-registration Actions
- Use Action secrets to store sensitive configuration
- Test and debug Actions using the built-in test runner
- Chain multiple Actions in a flow and control execution order

## Prerequisites

- Completed Module 03 labs (Auth0 tenant with applications, users, and roles)
- Basic JavaScript knowledge
- Understanding of JWT token structure

## Estimated Time

40-50 minutes

---

## Step 1: Create a Post-Login Action -- Enrich User Profile

This Action calls an external API to enrich the user's profile with additional data on every login.

### Create the Action

1. Go to **Actions > Library** in the Auth0 Dashboard
2. Click **+ Build Custom**
3. Fill in:
   - **Name**: `Post-Login: Enrich User Profile`
   - **Trigger**: Login / Post Login
   - **Runtime**: Node 18
4. Click **Create**

### Add the Code

Replace the default code with:

```javascript
const axios = require('axios');

/**
 * Post-Login Action: Enrich User Profile
 *
 * Fetches additional user data from an external API and adds it
 * as custom claims to the ID and access tokens.
 *
 * Secrets required:
 *   - ENRICHMENT_API_URL: URL of the enrichment API
 *   - ENRICHMENT_API_KEY: API key for authentication
 */
exports.onExecutePostLogin = async (event, api) => {
  // Namespace for custom claims (must be a URL to avoid collisions)
  const namespace = 'https://identity-lab.local/';

  // Add basic enrichment from user metadata
  const department = event.user.app_metadata?.department || 'unassigned';
  const plan = event.user.app_metadata?.plan || 'free';
  const employeeId = event.user.app_metadata?.employee_id || null;

  // Set custom claims on the ID token (visible to the frontend)
  api.idToken.setCustomClaim(namespace + 'department', department);
  api.idToken.setCustomClaim(namespace + 'plan', plan);

  // Set custom claims on the access token (visible to the API)
  api.accessToken.setCustomClaim(namespace + 'department', department);
  api.accessToken.setCustomClaim(namespace + 'plan', plan);
  api.accessToken.setCustomClaim(namespace + 'employee_id', employeeId);

  // Add login metadata
  api.idToken.setCustomClaim(namespace + 'login_count', event.stats.logins_count);
  api.idToken.setCustomClaim(namespace + 'last_ip', event.request.ip);

  // Optional: Call external API for enrichment
  if (event.secrets.ENRICHMENT_API_URL) {
    try {
      const { data } = await axios.get(event.secrets.ENRICHMENT_API_URL, {
        params: { email: event.user.email },
        headers: {
          'Authorization': `Bearer ${event.secrets.ENRICHMENT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 3000 // 3 second timeout to avoid login delays
      });

      if (data.team) {
        api.accessToken.setCustomClaim(namespace + 'team', data.team);
      }
      if (data.manager) {
        api.accessToken.setCustomClaim(namespace + 'manager', data.manager);
      }
    } catch (error) {
      // Log the error but do not block login
      console.error('Enrichment API call failed:', error.message);
    }
  }
};
```

### Add Dependencies

1. Click the **Dependencies** tab (package icon) in the Action editor
2. Click **Add Dependency**
3. Add: `axios` (version `1.6.0` or latest)

### Add Secrets

1. Click the **Secrets** tab (lock icon)
2. Add:
   - Key: `ENRICHMENT_API_URL`, Value: `https://jsonplaceholder.typicode.com/users` (for testing)
   - Key: `ENRICHMENT_API_KEY`, Value: `test-key-12345`

### Test the Action

1. Click **Test** (play icon) in the Action editor
2. Auth0 provides a simulated `event` object
3. Modify the test event to include your user data:
   ```json
   {
     "user": {
       "email": "alice@example.com",
       "app_metadata": {
         "department": "engineering",
         "plan": "premium",
         "employee_id": "EMP-001"
       }
     },
     "stats": { "logins_count": 42 },
     "request": { "ip": "203.0.113.1" }
   }
   ```
4. Click **Run**
5. Verify the output shows custom claims being set

### Deploy the Action

1. Click **Deploy** in the top-right corner
2. Go to **Actions > Flows > Login**
3. In the flow editor, find your Action in the right sidebar under **Custom**
4. Drag `Post-Login: Enrich User Profile` into the flow
5. Click **Apply**

---

## Step 2: Create a Post-Login Action -- RBAC Sync

This Action synchronizes roles from Auth0's RBAC system into the token.

### Create the Action

1. Go to **Actions > Library > + Build Custom**
2. Name: `Post-Login: RBAC Sync`
3. Trigger: Login / Post Login
4. Runtime: Node 18

### Add the Code

```javascript
/**
 * Post-Login Action: RBAC Sync
 *
 * Adds the user's Auth0 roles and permissions as custom claims
 * in both the ID and access tokens.
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://identity-lab.local/';

  // Get roles from Auth0 RBAC
  const roles = event.authorization?.roles || [];

  // Add roles to both tokens
  api.idToken.setCustomClaim(namespace + 'roles', roles);
  api.accessToken.setCustomClaim(namespace + 'roles', roles);

  // Determine highest privilege level for simplified access checks
  let accessLevel = 'viewer';
  if (roles.includes('Admin')) accessLevel = 'admin';
  else if (roles.includes('Editor')) accessLevel = 'editor';

  api.accessToken.setCustomClaim(namespace + 'access_level', accessLevel);

  // Add feature flags based on roles
  const features = {
    canManageUsers: roles.includes('Admin'),
    canEditContent: roles.includes('Admin') || roles.includes('Editor'),
    canViewReports: true,
    canAccessBeta: event.user.app_metadata?.plan === 'enterprise'
  };

  api.idToken.setCustomClaim(namespace + 'features', features);
};
```

### Deploy and Add to Flow

1. Deploy the Action
2. Go to **Actions > Flows > Login**
3. Drag `Post-Login: RBAC Sync` into the flow, **after** the enrichment Action
4. Click **Apply**

> **Order matters**: Actions execute in order from top to bottom. Place enrichment before RBAC sync so that the enriched data is available.

---

## Step 3: Create a Pre-Registration Action -- Validate Registration

This Action runs before a user is created and can block registration based on business rules.

### Create the Action

1. Go to **Actions > Library > + Build Custom**
2. Name: `Pre-Registration: Validate`
3. Trigger: Pre User Registration
4. Runtime: Node 18

### Add the Code

```javascript
/**
 * Pre-Registration Action: Validate
 *
 * Validates new user registrations against business rules:
 * - Block disposable email domains
 * - Restrict to allowed email domains (optional)
 * - Set default app_metadata for new users
 */
exports.onExecutePreUserRegistration = async (event, api) => {
  const email = event.user.email || '';
  const domain = email.split('@')[1]?.toLowerCase();

  // Block disposable email providers
  const blockedDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com',
    'throwaway.email', 'yopmail.com', 'sharklasers.com',
    'guerrillamailblock.com', 'grr.la', 'dispostable.com',
    'trashmail.com', '10minutemail.com', 'temp-mail.org'
  ];

  if (blockedDomains.includes(domain)) {
    api.access.deny('registration_blocked', 'Disposable email addresses are not allowed.');
    return;
  }

  // Optional: Restrict to specific domains (uncomment for invite-only orgs)
  // const allowedDomains = ['your-company.com', 'partner-company.com'];
  // if (!allowedDomains.includes(domain)) {
  //   api.access.deny('domain_not_allowed', 'Registration is restricted to authorized domains.');
  //   return;
  // }

  // Set default metadata for new users
  api.user.setAppMetadata('plan', 'free');
  api.user.setAppMetadata('department', 'unassigned');
  api.user.setAppMetadata('registered_at', new Date().toISOString());
  api.user.setAppMetadata('registration_ip', event.request.ip);
  api.user.setAppMetadata('registration_source', event.client?.name || 'unknown');

  // Set user preferences
  api.user.setUserMetadata('preferred_language', 'en');
  api.user.setUserMetadata('notifications_enabled', true);
};
```

### Deploy and Add to Flow

1. Deploy the Action
2. Go to **Actions > Flows > Pre User Registration**
3. Drag the Action into the flow
4. Click **Apply**

### Test Registration Validation

1. Try to register a new user with a disposable email (e.g., `test@mailinator.com`)
2. You should see a registration error
3. Register with a valid email -- it should succeed
4. Check the new user's `app_metadata` in the dashboard -- it should have the default values

---

## Step 4: Chain Multiple Actions in a Flow

You should now have two Actions in the Login flow. Let's verify the order and add logging:

### View the Login Flow

1. Go to **Actions > Flows > Login**
2. You should see:
   1. `Post-Login: Enrich User Profile`
   2. `Post-Login: RBAC Sync`
3. Drag to reorder if needed

### Add a Logging Action

Create a simple logging Action for debugging:

1. Create a new Action: `Post-Login: Audit Log`
2. Code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  console.log('=== LOGIN EVENT ===');
  console.log('User:', event.user.email);
  console.log('Connection:', event.connection.name);
  console.log('Client:', event.client.name);
  console.log('IP:', event.request.ip);
  console.log('User Agent:', event.request.user_agent);
  console.log('Roles:', event.authorization?.roles?.join(', ') || 'none');
  console.log('Login Count:', event.stats.logins_count);
  console.log('==================');
};
```

3. Deploy and add to the Login flow (at the end)

### View Action Logs

1. Log in to trigger the Actions
2. Go to **Monitoring > Logs**
3. Find the login event and click it
4. Expand the log details to see the `console.log` output from your Actions
5. Alternatively, use **Actions > Logs** for Action-specific logs

---

## Step 5: Advanced Action Patterns

### Redirect to External Page

Actions can redirect users to an external page (e.g., for terms acceptance, profile completion):

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Check if user has accepted terms
  if (!event.user.app_metadata?.terms_accepted) {
    api.redirect.sendUserTo('https://your-app.com/accept-terms', {
      query: {
        session_token: api.redirect.encodeToken({
          secret: event.secrets.REDIRECT_SECRET,
          expiresInSeconds: 600,
          payload: { user_id: event.user.user_id }
        })
      }
    });
  }
};

exports.onContinuePostLogin = async (event, api) => {
  // Called when user returns from the redirect
  const payload = api.redirect.validateToken({
    secret: event.secrets.REDIRECT_SECRET,
    tokenParameterName: 'session_token'
  });

  // User accepted terms
  api.user.setAppMetadata('terms_accepted', true);
  api.user.setAppMetadata('terms_accepted_at', new Date().toISOString());
};
```

### Deny Access Based on Business Logic

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Block suspended users
  if (event.user.app_metadata?.suspended) {
    api.access.deny('account_suspended', 'Your account has been suspended. Contact support.');
    return;
  }

  // Block users from specific countries (compliance)
  const blockedCountries = ['XX', 'YY'];
  if (blockedCountries.includes(event.request.geoip?.countryCode)) {
    api.access.deny('region_blocked', 'Access is not available in your region.');
    return;
  }
};
```

---

## Validation Checklist

- [ ] Post-Login Enrichment Action created, tested, and deployed
- [ ] Post-Login RBAC Sync Action created and deployed
- [ ] Pre-Registration Validation Action created and deployed
- [ ] Login flow has multiple Actions in correct order
- [ ] Custom claims appear in ID and access tokens after login
- [ ] Disposable email registration is blocked
- [ ] New users get default app_metadata
- [ ] Action logs visible in Monitoring > Logs
- [ ] Action secrets configured securely

---

## Troubleshooting

### Action Not Executing

**Cause**: Action is not deployed or not added to the flow.

**Fix**: Go to Actions > Library, ensure the Action shows "Deployed." Then go to Actions > Flows > Login and verify the Action is in the pipeline.

### Custom Claims Not in Token

**Cause**: Claim namespace does not start with a URL, or the claim name conflicts with a reserved claim.

**Fix**: Custom claims must use a namespaced format like `https://your-domain.com/claim_name`. Never use reserved claim names (sub, iss, aud, exp, iat).

### Action Timeout

**Cause**: External API call took too long (Actions have a 20-second timeout).

**Fix**: Add a timeout to external HTTP calls (e.g., `timeout: 3000` in axios). Use try/catch to handle failures gracefully without blocking login.

### "Cannot find module" Error

**Cause**: npm dependency not added in the Action editor.

**Fix**: Go to the Dependencies tab in the Action editor and add the required package (e.g., axios).

### Flow Order Issues

**Cause**: Actions execute in the order shown in the flow. An Action that depends on data from another must come after it.

**Fix**: Drag Actions to reorder them in the flow editor.

---

## Next Lab

Proceed to [Lab 04: Organizations](lab-04-organizations.md) to set up Auth0 Organizations for B2B multi-tenancy.
