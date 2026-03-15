# Lab 01: SSO Setup

## Objectives

By the end of this lab you will be able to:

- Configure Single Sign-On (SSO) between two applications on the same Auth0 tenant
- Verify seamless authentication across applications
- Configure SSO session settings (lifetime, inactivity timeout)
- Understand SSO session behavior with different application types
- Implement SSO logout (single logout)

## Prerequisites

- Completed Module 03 labs (Auth0 tenant with applications and users)
- Auth0 tenant with at least one database connection
- Node.js 18+ installed
- Two available ports (3000 and 3001)

## Estimated Time

30-40 minutes

---

## Step 1: Understand Auth0 SSO

Auth0 SSO works at the tenant level. When a user authenticates with any application on the tenant, Auth0 creates an SSO session. Any other application on the same tenant can leverage this session.

### SSO Session Flow

```
1. User visits App A (localhost:3000)
2. App A redirects to Auth0 for login
3. User authenticates (email/password, social, etc.)
4. Auth0 creates an SSO session cookie on *.auth0.com
5. Auth0 redirects back to App A with tokens

6. User visits App B (localhost:3001)
7. App B redirects to Auth0 for login
8. Auth0 detects the existing SSO session cookie
9. Auth0 redirects back to App B with tokens (NO login prompt)
```

> **Key insight**: The SSO session is a cookie on the Auth0 domain. It is separate from your application sessions.

---

## Step 2: Register Two Applications

### Application A: Primary App

1. Go to **Applications > Applications > + Create Application**
2. Name: `SSO App A`
3. Type: **Single Page Web Applications**
4. Settings:
   - Allowed Callback URLs: `http://localhost:3000/callback`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
5. Note the **Client ID**

### Application B: Secondary App

1. Create another application
2. Name: `SSO App B`
3. Type: **Single Page Web Applications**
4. Settings:
   - Allowed Callback URLs: `http://localhost:3001/callback`
   - Allowed Logout URLs: `http://localhost:3001`
   - Allowed Web Origins: `http://localhost:3001`
5. Note the **Client ID**

### Enable Connections

Ensure both applications have the same connections enabled:

1. Go to each application's **Connections** tab
2. Enable `Username-Password-Authentication` and any social connections
3. Both apps must share at least one connection for SSO to work

---

## Step 3: Create Test Applications

Create a shared HTML template for both apps. The only differences are the port, Client ID, and app name.

### App A (port 3000)

Create `app-a/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SSO App A</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; background: #e8f4f8; }
    .card { background: white; border-radius: 8px; padding: 24px; margin: 16px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .app-badge { background: #0059d6; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
    button { background: #0059d6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 4px; }
    button.logout { background: #dc3545; }
    button.secondary { background: #6c757d; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    .hidden { display: none; }
    a { color: #0059d6; }
  </style>
</head>
<body>
  <h1><span class="app-badge">APP A</span> SSO Demo - Primary</h1>

  <div id="not-auth" class="card">
    <h2>Not Authenticated</h2>
    <p>Click below to log in. After logging in here, visit
      <a href="http://localhost:3001" target="_blank">App B (port 3001)</a>
      -- you should be logged in automatically via SSO.</p>
    <button onclick="login()">Log In</button>
  </div>

  <div id="auth" class="card hidden">
    <h2>Authenticated in App A</h2>
    <p>Welcome, <strong id="user-name"></strong></p>
    <p>Now visit <a href="http://localhost:3001" target="_blank">App B (port 3001)</a>
      to verify SSO is working.</p>
    <h3>ID Token Claims</h3>
    <pre id="claims"></pre>
    <button class="logout" onclick="logout()">Log Out (App A only)</button>
    <button class="secondary" onclick="logoutAll()">Log Out (SSO - All Apps)</button>
  </div>

  <script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>
  <script>
    const AUTH0_DOMAIN = 'YOUR_TENANT.us.auth0.com';  // REPLACE
    const CLIENT_ID = 'APP_A_CLIENT_ID';               // REPLACE

    let client;

    async function init() {
      client = await auth0.createAuth0Client({
        domain: AUTH0_DOMAIN,
        clientId: CLIENT_ID,
        authorizationParams: {
          redirect_uri: window.location.origin + '/callback'
        },
        cacheLocation: 'localstorage'
      });

      if (location.search.includes('code=')) {
        await client.handleRedirectCallback();
        history.replaceState({}, '', '/');
      }

      const isAuth = await client.isAuthenticated();
      document.getElementById('not-auth').classList.toggle('hidden', isAuth);
      document.getElementById('auth').classList.toggle('hidden', !isAuth);

      if (isAuth) {
        const user = await client.getUser();
        const claims = await client.getIdTokenClaims();
        document.getElementById('user-name').textContent = user.name || user.email;
        document.getElementById('claims').textContent = JSON.stringify(claims, null, 2);
      }
    }

    function login() { client.loginWithRedirect(); }

    function logout() {
      // Local logout only -- does NOT clear SSO session
      client.logout({ logoutParams: { returnTo: window.location.origin }, localOnly: true });
    }

    function logoutAll() {
      // Full SSO logout -- clears Auth0 session, logs out of ALL apps
      client.logout({ logoutParams: { returnTo: window.location.origin } });
    }

    init();
  </script>
</body>
</html>
```

### App B (port 3001)

Create `app-b/index.html` with the same structure but different styling and Client ID:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SSO App B</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; background: #f0e8f8; }
    .card { background: white; border-radius: 8px; padding: 24px; margin: 16px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .app-badge { background: #7c3aed; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
    button { background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 4px; }
    button.logout { background: #dc3545; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    .hidden { display: none; }
    a { color: #7c3aed; }
  </style>
</head>
<body>
  <h1><span class="app-badge">APP B</span> SSO Demo - Secondary</h1>

  <div id="not-auth" class="card">
    <h2>Not Authenticated</h2>
    <p>If you already logged into
      <a href="http://localhost:3000" target="_blank">App A (port 3000)</a>,
      click below -- you should be logged in automatically via SSO (no password prompt).</p>
    <button onclick="login()">Log In (SSO)</button>
  </div>

  <div id="auth" class="card hidden">
    <h2>Authenticated in App B via SSO</h2>
    <p>Welcome, <strong id="user-name"></strong></p>
    <p>You were authenticated without entering credentials -- SSO is working.</p>
    <h3>ID Token Claims</h3>
    <pre id="claims"></pre>
    <button class="logout" onclick="logoutAll()">Log Out (SSO - All Apps)</button>
  </div>

  <script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>
  <script>
    const AUTH0_DOMAIN = 'YOUR_TENANT.us.auth0.com';  // REPLACE
    const CLIENT_ID = 'APP_B_CLIENT_ID';               // REPLACE

    let client;

    async function init() {
      client = await auth0.createAuth0Client({
        domain: AUTH0_DOMAIN,
        clientId: CLIENT_ID,
        authorizationParams: {
          redirect_uri: window.location.origin + '/callback'
        },
        cacheLocation: 'localstorage'
      });

      if (location.search.includes('code=')) {
        await client.handleRedirectCallback();
        history.replaceState({}, '', '/');
      }

      const isAuth = await client.isAuthenticated();
      document.getElementById('not-auth').classList.toggle('hidden', isAuth);
      document.getElementById('auth').classList.toggle('hidden', !isAuth);

      if (isAuth) {
        const user = await client.getUser();
        const claims = await client.getIdTokenClaims();
        document.getElementById('user-name').textContent = user.name || user.email;
        document.getElementById('claims').textContent = JSON.stringify(claims, null, 2);
      }
    }

    function login() { client.loginWithRedirect(); }

    function logoutAll() {
      client.logout({ logoutParams: { returnTo: window.location.origin } });
    }

    init();
  </script>
</body>
</html>
```

---

## Step 4: Run Both Applications

Open two terminal windows:

```bash
# Terminal 1 - App A
cd app-a && npx http-server -p 3000 -c-1

# Terminal 2 - App B
cd app-b && npx http-server -p 3001 -c-1
```

---

## Step 5: Test SSO Flow

### Test 1: SSO Login

1. Open `http://localhost:3000` (App A) in your browser
2. Click **Log In**
3. Authenticate with your credentials on the Auth0 Universal Login page
4. Verify you are logged into App A (see your name and token claims)
5. Open `http://localhost:3001` (App B) in a **new tab** (same browser)
6. Click **Log In (SSO)**
7. You should be redirected to Auth0 and back to App B **without entering credentials**
8. Verify you are logged into App B with the same user

### Test 2: SSO Logout

1. In App A, click **Log Out (SSO - All Apps)**
2. This clears the Auth0 SSO session
3. Switch to App B and refresh the page
4. App B should show you as logged out (the local token is still cached, but the SSO session is gone)
5. Click **Log In (SSO)** in App B
6. You should be prompted to enter credentials again (SSO session was cleared)

### Test 3: Local Logout vs SSO Logout

1. Log into App A
2. Verify SSO works in App B
3. In App A, click **Log Out (App A only)** -- this clears App A's local session but keeps the Auth0 SSO session
4. In App B, you remain logged in
5. In App A, click **Log In** -- you should be logged in automatically via the still-active SSO session

---

## Step 6: Configure SSO Session Settings

1. Go to **Settings** (gear icon) in the Auth0 Dashboard
2. Scroll to **Login Session Management**
3. Configure:

| Setting | Description | Recommended |
|---|---|---|
| Inactivity Timeout | Max time with no activity | 4320 min (3 days) |
| Session Lifetime | Absolute max session duration | 10080 min (7 days) |
| Persistent Sessions | Survive browser restart | Enable for convenience |

4. Click **Save**

### Test Session Timeout

To quickly test session timeout:

1. Set **Inactivity Timeout** to 1 minute (for testing only)
2. Log into App A
3. Wait 2 minutes without any Auth0 interaction
4. Try to log into App B -- you should be prompted for credentials
5. Reset the timeout to a production-appropriate value

---

## Step 7: SSO with Enterprise Connections (Optional)

If you have an enterprise IdP available (e.g., Okta, Azure AD):

1. Configure an enterprise connection in **Authentication > Enterprise**
2. Enable it for both App A and App B
3. Test SSO -- the enterprise IdP handles the first authentication, and Auth0's SSO session handles subsequent apps

---

## Validation Checklist

- [ ] Two SPA applications registered on the same tenant
- [ ] Both apps share the same database connection
- [ ] SSO login works: authenticate in App A, automatically logged into App B
- [ ] SSO logout works: logging out with SSO in one app clears the session for all
- [ ] Local logout works: logging out locally in one app does not affect the other
- [ ] SSO session settings configured and understood
- [ ] Token claims are consistent across both apps (same user identity)

---

## Troubleshooting

### SSO Not Working -- Prompted for Credentials in App B

**Cause**: Apps are not on the same Auth0 tenant, or using different connections.

**Fix**: Verify both apps are registered under the same tenant. Ensure both have the same connections enabled.

### "Login Required" Error

**Cause**: SSO session expired or was never created.

**Fix**: Check session timeout settings. Ensure the user completed authentication (not just started it).

### Third-Party Cookies Blocked

**Cause**: Modern browsers block third-party cookies, which can affect silent authentication.

**Fix**: Use a custom domain for Auth0 so the auth domain matches your app domain. Alternatively, use `prompt: 'none'` with the authorization endpoint.

### Logout Not Clearing SSO Session

**Cause**: Using `localOnly: true` in the logout call.

**Fix**: To clear the SSO session, do not use `localOnly`. Call `client.logout()` without the `localOnly` flag, which redirects to Auth0's `/v2/logout` endpoint.

---

## Next Lab

Proceed to [Lab 02: MFA Configuration](lab-02-mfa-configuration.md) to add multi-factor authentication to your tenant.
