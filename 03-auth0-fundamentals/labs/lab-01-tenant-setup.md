# Lab 01: Auth0 Tenant Setup

## Objectives

By the end of this lab you will be able to:

- Create a free Auth0 tenant
- Register your first application (SPA)
- Configure callback and logout URLs
- Test the login flow with Auth0's Universal Login
- Inspect the tokens returned by Auth0
- Create an API (resource server) for your backend

## Prerequisites

- A modern web browser (Chrome, Firefox, Edge)
- An email address for Auth0 signup (or a Google/GitHub account)
- Node.js 18+ installed (for the test app)
- Basic understanding of OAuth 2.0 and OpenID Connect (covered in Module 01-02)

## Estimated Time

30-40 minutes

---

## Step 1: Create an Auth0 Account and Tenant

1. Open [https://auth0.com/signup](https://auth0.com/signup)
2. Sign up using your preferred method (email, Google, or GitHub)
3. When prompted for a **tenant name**, enter a descriptive name:
   - Example: `idm-zero-to-hero-dev`
   - This becomes your Auth0 domain: `idm-zero-to-hero-dev.us.auth0.com`
4. Select your **region**:
   - US (United States)
   - EU (Europe)
   - AU (Australia)
   - JP (Japan)
   - Choose the region closest to your target users
5. Click **Create Account**

> **Important**: Tenant names are permanent and globally unique. Use a clear naming convention. For this course, we recommend `{your-name}-idm-dev`.

### Validation

After creation, you should land on the Auth0 Dashboard. Confirm:
- The tenant name appears in the top-left corner
- The URL contains your tenant name: `manage.auth0.com/dashboard/us/{your-tenant}`

---

## Step 2: Explore the Dashboard

Take a moment to familiarize yourself with the sidebar navigation:

| Section | Purpose |
|---|---|
| Getting Started | Quickstart guides and checklist |
| Applications | Register and configure your apps |
| Authentication | Database, social, enterprise connections |
| User Management | Users, roles, permissions |
| Branding | Universal Login customization, emails |
| Security | Attack protection, MFA |
| Actions | Extensibility pipelines |
| Monitoring | Logs and log streams |

Click through each section briefly. We will use most of them throughout this course.

---

## Step 3: Register a Single Page Application

1. Navigate to **Applications > Applications**
2. Click **+ Create Application**
3. Fill in:
   - **Name**: `Identity Lab SPA`
   - **Type**: Select **Single Page Web Applications**
4. Click **Create**
5. You are taken to the application's **Quick Start** tab -- skip this for now
6. Click the **Settings** tab

### Record Your Application Credentials

Note the following values (you will need them later):

```
Domain:        {your-tenant}.us.auth0.com
Client ID:     xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note**: SPAs do not use a Client Secret because they are public clients. The secret field is present but should never be used in browser code.

### Configure URLs

Scroll down to **Application URIs** and enter:

| Field | Value |
|---|---|
| Allowed Callback URLs | `http://localhost:3000/callback` |
| Allowed Logout URLs | `http://localhost:3000` |
| Allowed Web Origins | `http://localhost:3000` |

> **Tip**: You can enter multiple URLs separated by commas. For production, add your deployed URL alongside localhost.

Scroll to the bottom and click **Save Changes**.

---

## Step 4: Create a Test API

1. Navigate to **Applications > APIs**
2. Click **+ Create API**
3. Fill in:
   - **Name**: `Identity Lab API`
   - **Identifier (audience)**: `https://api.identity-lab.local`
   - **Signing Algorithm**: RS256 (default, recommended)
4. Click **Create**
5. Go to the **Permissions** tab and add these scopes:

| Permission | Description |
|---|---|
| `read:profile` | Read user profile data |
| `write:profile` | Update user profile data |
| `read:items` | Read items |
| `write:items` | Create and update items |

Click **Add** after each permission, then **Save**.

---

## Step 5: Create a Simple Test Application

Create a minimal HTML + JavaScript app to test the login flow:

```bash
mkdir -p ~/auth0-lab && cd ~/auth0-lab
```

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Auth0 Lab - Tenant Setup</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      background: #f5f7fa;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin: 16px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button {
      background: #0059d6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin: 4px;
    }
    button:hover { background: #0047b3; }
    button.logout { background: #dc3545; }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 13px;
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h1>Auth0 Lab 01: Tenant Setup</h1>

  <div id="not-authenticated" class="card">
    <h2>Welcome</h2>
    <p>Click below to log in via Auth0 Universal Login.</p>
    <button onclick="login()">Log In</button>
    <button onclick="signup()">Sign Up</button>
  </div>

  <div id="authenticated" class="card hidden">
    <h2>Authenticated!</h2>
    <p>Welcome, <strong id="user-name"></strong></p>
    <img id="user-avatar" width="64" height="64" style="border-radius:50%" />
    <h3>ID Token Claims</h3>
    <pre id="id-token-claims"></pre>
    <h3>Access Token (encoded)</h3>
    <pre id="access-token"></pre>
    <button class="logout" onclick="logout()">Log Out</button>
  </div>

  <script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>
  <script>
    // ===== REPLACE THESE VALUES =====
    const AUTH0_DOMAIN   = 'YOUR_TENANT.us.auth0.com';
    const AUTH0_CLIENT_ID = 'YOUR_CLIENT_ID';
    const AUTH0_AUDIENCE  = 'https://api.identity-lab.local';
    // ================================

    let auth0Client = null;

    async function initAuth0() {
      auth0Client = await auth0.createAuth0Client({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        authorizationParams: {
          redirect_uri: window.location.origin + '/callback',
          audience: AUTH0_AUDIENCE,
          scope: 'openid profile email read:profile'
        }
      });

      // Handle redirect callback
      if (window.location.search.includes('code=') &&
          window.location.search.includes('state=')) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, '/');
      }

      await updateUI();
    }

    async function updateUI() {
      const isAuthenticated = await auth0Client.isAuthenticated();

      document.getElementById('not-authenticated').classList.toggle('hidden', isAuthenticated);
      document.getElementById('authenticated').classList.toggle('hidden', !isAuthenticated);

      if (isAuthenticated) {
        const user = await auth0Client.getUser();
        const token = await auth0Client.getTokenSilently();
        const claims = await auth0Client.getIdTokenClaims();

        document.getElementById('user-name').textContent = user.name || user.email;
        document.getElementById('user-avatar').src = user.picture || '';
        document.getElementById('id-token-claims').textContent = JSON.stringify(claims, null, 2);
        document.getElementById('access-token').textContent = token;
      }
    }

    async function login() {
      await auth0Client.loginWithRedirect();
    }

    async function signup() {
      await auth0Client.loginWithRedirect({
        authorizationParams: { screen_hint: 'signup' }
      });
    }

    async function logout() {
      await auth0Client.logout({
        logoutParams: { returnTo: window.location.origin }
      });
    }

    initAuth0();
  </script>
</body>
</html>
```

### Serve the Application

```bash
# Option 1: Node.js http-server
npx http-server -p 3000 -c-1

# Option 2: Python
python3 -m http.server 3000

# Option 3: PHP
php -S localhost:3000
```

Open `http://localhost:3000` in your browser.

---

## Step 6: Test the Login Flow

1. Click **Log In** in your test app
2. You should be redirected to the Auth0 Universal Login page
3. Click **Sign Up** to create a new account with email and password
4. Complete email verification if prompted
5. After successful authentication, you are redirected back to your app
6. You should see:
   - Your name and avatar (if using a social login)
   - ID token claims (issuer, subject, email, etc.)
   - An encoded access token

### Inspect the ID Token Claims

The ID token should contain claims like:

```json
{
  "iss": "https://your-tenant.us.auth0.com/",
  "sub": "auth0|64a1b2c3d4e5f6a7b8c9d0e1",
  "aud": "YOUR_CLIENT_ID",
  "iat": 1700000000,
  "exp": 1700036000,
  "email": "your-email@example.com",
  "email_verified": true,
  "name": "Your Name",
  "picture": "https://s.gravatar.com/avatar/...",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Decode the Access Token

Copy the access token and decode it at [https://jwt.io](https://jwt.io):

- **Header**: Algorithm (RS256), type (JWT), key ID (kid)
- **Payload**: Issuer, subject, audience, scopes, expiration
- **Signature**: Verifiable with Auth0's public key (JWKS)

---

## Step 7: Verify in the Auth0 Dashboard

1. Go to **User Management > Users** in the dashboard
2. You should see the user you just created
3. Click the user to see their profile:
   - User ID (the `sub` claim)
   - Email and verification status
   - Login history
   - Raw JSON profile
4. Go to **Monitoring > Logs**
5. You should see recent log events:
   - `Successful Login` (event type: `s`)
   - `Successful Signup` (event type: `ss`)
   - `Successful Exchange` (event type: `seacft` for authorization code exchange)

---

## Step 8: Configure Environment Tag

Set the environment tag to communicate the tenant's purpose:

1. Go to **Settings** (gear icon in sidebar)
2. Under **Environment Tag**, select **Development**
3. Click **Save**

> **Note**: The environment tag affects rate limits. Development tenants have lower limits but include extra debugging features. Production tenants have higher limits but some debugging features are disabled.

---

## Validation Checklist

- [ ] Auth0 account created and tenant accessible
- [ ] SPA application registered with correct type
- [ ] Callback, logout, and web origin URLs configured
- [ ] API created with custom audience and permissions
- [ ] Test app loads and redirects to Universal Login
- [ ] Signup and login work successfully
- [ ] Tokens are returned and visible in the test app
- [ ] User appears in the Auth0 Dashboard
- [ ] Login events appear in Monitoring > Logs

---

## Troubleshooting

### "Callback URL mismatch" Error

**Cause**: The URL your app redirects to after login does not match any URL in the Allowed Callback URLs list.

**Fix**: Ensure `http://localhost:3000/callback` is in the Allowed Callback URLs field (exact match including protocol and port).

### "Access denied" or Blank Screen After Login

**Cause**: Allowed Web Origins not set, causing CORS issues with silent authentication.

**Fix**: Add `http://localhost:3000` to Allowed Web Origins.

### Login Page Shows "Wrong Tenant"

**Cause**: Domain or Client ID misconfigured in the JavaScript code.

**Fix**: Double-check the `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` values match what is shown in your application settings.

### "Grant type 'authorization_code' not allowed"

**Cause**: The application type is wrong or the grant is not enabled.

**Fix**: Go to Application Settings > Advanced Settings > Grant Types and ensure "Authorization Code" and "Implicit" (if needed) are checked.

### User Not Appearing in Dashboard

**Cause**: The user may have been created in a different connection or tenant.

**Fix**: Check that you are viewing the correct tenant and connection in User Management.

---

## Clean Up

For this lab, keep the tenant and application running -- you will use them in subsequent labs. If you want to reset:

1. Delete test users: **User Management > Users > select user > Delete**
2. Delete the application: **Applications > your app > Settings > Delete**
3. Delete the API: **Applications > APIs > your API > Delete**

---

## Next Lab

Proceed to [Lab 02: Social Connections](lab-02-social-connections.md) to add Google and GitHub login to your application.
