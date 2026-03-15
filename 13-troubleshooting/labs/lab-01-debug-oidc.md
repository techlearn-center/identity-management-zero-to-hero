# Lab 01: Debug a Broken OIDC Flow

## Objective

Practice debugging real-world identity issues. This lab presents a broken OIDC authentication flow with 6 intentional bugs. You'll use browser DevTools, network inspection, JWT debugging, and Auth0 logs to find and fix each one.

## Prerequisites

- Completed Modules 02-07 (understanding of OIDC, Auth0, React)
- Browser with DevTools (Chrome recommended)
- Auth0 tenant with a test application

## Estimated Time

60–90 minutes

---

## Part 1: The Scenario

Your team deployed a new version of the identity service and users are reporting:
- "I can't log in"
- "I get logged in but immediately get logged out"
- "The admin page says Access Denied even though I'm an admin"
- "API calls return 401 even though I'm logged in"

You need to systematically diagnose and fix each issue.

---

## Part 2: Bug Hunt Setup

### Step 1: Create the buggy application

Create a new directory and set up a simple test app with these intentional bugs embedded (or use your existing app from Module 07 and introduce the bugs):

**Bug 1: Wrong Auth0 Domain**

In your `.env.local`, change the domain to have an extra character:
```
VITE_AUTH0_DOMAIN=your-tenantt.us.auth0.com   # Extra 't' - typo
```

**Bug 2: Mismatched Callback URL**

In Auth0 Dashboard, your Allowed Callback URL is `http://localhost:5173` but your app redirects to `http://localhost:5173/callback`:
```tsx
// In Auth0Provider config:
redirect_uri: window.location.origin + "/callback"  // /callback not in Auth0
```

**Bug 3: Wrong Audience**

In the API call, the audience doesn't match what the API expects:
```
VITE_AUTH0_AUDIENCE=https://api.identity-lab.local/v2   # /v2 doesn't exist in Auth0
```

**Bug 4: Missing CORS Origin**

The API server allows `http://localhost:3000` but the React app runs on `http://localhost:5173`.

**Bug 5: Auth0 Action Namespace Mismatch**

The Auth0 Action sets roles on:
```javascript
api.idToken.setCustomClaim("https://my-app.com/roles", roles);
```

But the React app reads from:
```typescript
const roles = user["https://identity-lab.local/roles"];  // Wrong namespace!
```

**Bug 6: Expired Signing Key**

The API is caching an old JWKS key and Auth0 has rotated its signing key.

---

## Part 3: Debugging Methodology — TRACE

Use the **TRACE** method for every identity issue:

```
T — Token:   Inspect the token (jwt.io). Is it present? Valid? Right audience?
R — Request:  Check the HTTP request. Headers correct? CORS ok?
A — Auth0:   Check Auth0 Dashboard logs. What errors appear?
C — Config:  Verify all configuration. URLs match? Secrets correct?
E — Error:   Read the EXACT error message. What does it say?
```

---

## Part 4: Finding and Fixing Each Bug

### Bug 1: Wrong Auth0 Domain

**Symptoms:**
- Login button click goes nowhere or shows a browser error
- Console shows: `Failed to fetch` or `net::ERR_NAME_NOT_RESOLVED`

**Debug steps:**
1. Open Browser DevTools → Console tab
2. Look for network errors
3. Check the URL the SDK is trying to reach
4. Compare with your Auth0 Dashboard tenant URL

**Fix:**
```
# .env.local — fix the typo
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
```

**Lesson:** Always copy-paste Auth0 domain from the dashboard, never type it manually.

---

### Bug 2: Callback URL Mismatch

**Symptoms:**
- Auth0 login page appears, you can log in
- After login, you see: "Callback URL mismatch" error page from Auth0

**Debug steps:**
1. Read the error page — Auth0 tells you the exact URL it received
2. Go to Auth0 Dashboard → Applications → Your App → Settings
3. Compare **Allowed Callback URLs** with what the error shows
4. They must match exactly (including protocol, port, path)

**Fix:**
Either add `http://localhost:5173/callback` to Auth0, or remove `/callback` from your code:
```tsx
redirect_uri: window.location.origin  // Just the origin, no /callback
```

**Lesson:** Auth0 callback URL matching is exact. `http://localhost:5173` does not match `http://localhost:5173/callback`.

---

### Bug 3: Wrong Audience

**Symptoms:**
- Login works, user appears authenticated
- API calls return 401
- Token seems valid at jwt.io

**Debug steps:**
1. Get the access token (use the Token Inspector from Module 07 Lab 03)
2. Decode it at jwt.io
3. Check the `aud` (audience) claim
4. Compare with what your API expects

```json
// Token has:
"aud": "https://api.identity-lab.local/v2"

// API expects:
"aud": "https://api.identity-lab.local"
// MISMATCH!
```

**Fix:**
```
VITE_AUTH0_AUDIENCE=https://api.identity-lab.local
```

**Lesson:** The audience in the token request must exactly match the API Identifier in Auth0.

---

### Bug 4: CORS Blocked

**Symptoms:**
- Login works, authentication works
- API calls fail with no response
- Console shows: `Access to fetch at 'http://localhost:3001' has been blocked by CORS policy`

**Debug steps:**
1. Open DevTools → Console — read the CORS error
2. Open DevTools → Network — find the failed request, check for `access-control-allow-origin` header
3. Compare the `Origin` header with what the API allows

**Fix (API side):**
```javascript
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"]
}));
```

**Lesson:** CORS is enforced by the browser. The API must explicitly allow the frontend's origin.

---

### Bug 5: Namespace Mismatch

**Symptoms:**
- Login works, API calls work
- Role-based features don't work (admin page shows "Access Denied")
- Token at jwt.io shows roles under a different namespace

**Debug steps:**
1. Decode the ID token at jwt.io
2. Look for the roles claim — what's the exact key?
3. Search your React code for where it reads roles
4. Compare the two strings character by character

```json
// Token has: "https://my-app.com/roles": ["admin"]
// Code reads: user["https://identity-lab.local/roles"]
// These are DIFFERENT strings!
```

**Fix:** Make the Auth0 Action and React code use the same namespace.

**Lesson:** Custom claim namespaces must match exactly between the Action and the consuming application.

---

### Bug 6: JWKS Key Rotation

**Symptoms:**
- Was working yesterday, broken today
- API returns 401 for ALL requests
- Token looks valid at jwt.io

**Debug steps:**
1. Check if Auth0 recently rotated keys: Auth0 Dashboard → Settings → Signing Keys
2. Check if your API caches JWKS: Look for JWKS client configuration
3. Restart the API service to clear the JWKS cache

**Fix:**
- Configure JWKS client with TTL-based caching (e.g., refresh every 10 minutes)
- Don't cache keys indefinitely
- Handle `kid` (key ID) mismatch by re-fetching JWKS

**Lesson:** Always implement JWKS caching with a reasonable TTL. Never cache forever.

---

## Part 5: Using Auth0 Logs for Debugging

### Step 2: Navigate to Auth0 logs

1. Auth0 Dashboard → **Monitoring → Logs**
2. Important event types:

| Event Type | Code | Meaning |
|---|---|---|
| Successful Login | `s` | User logged in |
| Failed Login | `f` | Wrong password |
| Successful Exchange | `seacft` | Auth code → tokens |
| Failed Exchange | `feacft` | Token exchange failed |
| API Operation | `sapi` / `fapi` | Management API call |

3. Click on any event to see details:
   - IP address
   - User agent
   - Error description
   - Full request details

### Step 3: Set up log streaming (optional)

For production, stream logs to an external service:
1. Auth0 Dashboard → **Monitoring → Streams**
2. Create a stream to Datadog, Splunk, or AWS CloudWatch
3. This lets you search and alert on auth events in real-time

---

## Validation Checklist

- [ ] Found and fixed Bug 1 (wrong domain) using browser console
- [ ] Found and fixed Bug 2 (callback mismatch) using Auth0 error page
- [ ] Found and fixed Bug 3 (wrong audience) using jwt.io
- [ ] Found and fixed Bug 4 (CORS) using DevTools Network tab
- [ ] Found and fixed Bug 5 (namespace mismatch) using jwt.io token inspection
- [ ] Understood Bug 6 (JWKS rotation) and how to prevent it
- [ ] Used Auth0 logs to investigate failures
- [ ] Can apply the TRACE debugging methodology

---

## What You Learned

- How to systematically debug identity issues using TRACE
- How to use browser DevTools for auth debugging
- How to decode and inspect JWTs at jwt.io
- How to read Auth0 logs for error details
- The most common OIDC misconfigurations and how to fix them

---

**Next Module**: [Module 14: Capstone Project →](../../14-capstone-project/README.md)
