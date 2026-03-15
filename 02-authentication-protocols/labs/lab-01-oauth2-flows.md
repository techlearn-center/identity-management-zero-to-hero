# Lab 01: Implement OAuth 2.0 Grant Types

## Objective

Implement and test the four main OAuth 2.0 grant types using Auth0 as the authorization server, building a hands-on understanding of each flow.

---

## Prerequisites

- Auth0 account (free tier)
- Node.js 20+ installed
- cURL or Postman installed
- Basic understanding of HTTP

---

## Setup

### Step 1: Create Auth0 Applications

Log into Auth0 Dashboard and create two applications:

**Application 1 — Regular Web App:**
- Name: `OAuth Lab - Web App`
- Type: Regular Web Application
- Allowed Callback URLs: `http://localhost:3000/callback`
- Allowed Logout URLs: `http://localhost:3000`

**Application 2 — Machine-to-Machine:**
- Name: `OAuth Lab - M2M Service`
- Type: Machine to Machine
- Authorize it for your API

**API Registration:**
- Name: `OAuth Lab API`
- Identifier: `https://api.oauth-lab.local`
- Signing Algorithm: RS256
- Add permissions: `read:data`, `write:data`, `admin:all`

### Step 2: Create the Project

```bash
mkdir oauth2-flows-lab && cd oauth2-flows-lab
npm init -y
npm install express express-openid-connect dotenv axios jsonwebtoken jwks-rsa
```

### Step 3: Create Environment File

```bash
# .env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_web_app_client_id
AUTH0_CLIENT_SECRET=your_web_app_client_secret
AUTH0_AUDIENCE=https://api.oauth-lab.local
M2M_CLIENT_ID=your_m2m_client_id
M2M_CLIENT_SECRET=your_m2m_client_secret
PORT=3000
```

---

## Part 1: Authorization Code Flow

### Step 4: Build the Web Server

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Store state values for CSRF protection
const stateStore = new Map();

// Home page
app.get('/', (req, res) => {
  res.send(`
    <h1>OAuth 2.0 Flows Lab</h1>
    <ul>
      <li><a href="/login/auth-code">Authorization Code Flow</a></li>
      <li><a href="/login/auth-code-pkce">Authorization Code + PKCE</a></li>
      <li><a href="/login/client-credentials">Client Credentials Flow</a></li>
    </ul>
  `);
});

// Step 1: Initiate Authorization Code Flow
app.get('/login/auth-code', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { flow: 'auth-code', created: Date.now() });

  const authUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `http://localhost:${PORT}/callback`);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('audience', process.env.AUTH0_AUDIENCE);
  authUrl.searchParams.set('state', state);

  console.log('\\n--- Authorization Code Flow ---');
  console.log('Redirecting to:', authUrl.toString());

  res.redirect(authUrl.toString());
});

// Step 2: Handle callback and exchange code for tokens
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Check for errors
  if (error) {
    return res.send(`<h1>Error</h1><p>${error}: ${error_description}</p>`);
  }

  // Verify state (CSRF protection)
  if (!stateStore.has(state)) {
    return res.status(403).send('Invalid state parameter - possible CSRF attack');
  }

  const stateData = stateStore.get(state);
  stateStore.delete(state);

  console.log('\\nReceived authorization code:', code.substring(0, 20) + '...');

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code: code,
        redirect_uri: `http://localhost:${PORT}/callback`,
      }
    );

    const tokens = tokenResponse.data;

    console.log('\\nTokens received:');
    console.log('Access Token:', tokens.access_token.substring(0, 30) + '...');
    console.log('ID Token:', tokens.id_token ? tokens.id_token.substring(0, 30) + '...' : 'N/A');
    console.log('Token Type:', tokens.token_type);
    console.log('Expires In:', tokens.expires_in, 'seconds');

    // Decode ID token (for display, not validation)
    let idTokenClaims = {};
    if (tokens.id_token) {
      const payload = tokens.id_token.split('.')[1];
      idTokenClaims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    }

    res.send(`
      <h1>Authorization Code Flow - Success!</h1>
      <h2>Tokens Received:</h2>
      <pre>${JSON.stringify({
        access_token: tokens.access_token.substring(0, 50) + '...',
        id_token: tokens.id_token ? tokens.id_token.substring(0, 50) + '...' : 'N/A',
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
      }, null, 2)}</pre>
      <h2>ID Token Claims:</h2>
      <pre>${JSON.stringify(idTokenClaims, null, 2)}</pre>
      <a href="/">Back to Home</a>
    `);
  } catch (error) {
    console.error('Token exchange failed:', error.response?.data || error.message);
    res.status(500).send(`<h1>Token Exchange Failed</h1><pre>${JSON.stringify(error.response?.data, null, 2)}</pre>`);
  }
});

app.listen(PORT, () => {
  console.log(`OAuth 2.0 Lab running at http://localhost:${PORT}`);
});
```

### Step 5: Test the Flow

```bash
node server.js
# Open http://localhost:3000
# Click "Authorization Code Flow"
# Log in at Auth0
# Observe the callback with tokens
```

**What to observe:**
- The redirect to Auth0's `/authorize` endpoint
- The callback URL contains a `code` parameter
- The server exchanges the code for tokens
- You receive both an access token and ID token

---

## Part 2: Authorization Code + PKCE

### Step 6: Add PKCE Flow to Server

Add this route to `server.js`:

```javascript
// PKCE helpers
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Initiate PKCE flow
app.get('/login/auth-code-pkce', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store verifier (in real app, use session)
  stateStore.set(state, {
    flow: 'pkce',
    codeVerifier,
    created: Date.now()
  });

  const authUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `http://localhost:${PORT}/callback`);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('audience', process.env.AUTH0_AUDIENCE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('\\n--- PKCE Flow ---');
  console.log('Code Verifier:', codeVerifier);
  console.log('Code Challenge:', codeChallenge);

  res.redirect(authUrl.toString());
});
```

---

## Part 3: Client Credentials Flow

### Step 7: Add M2M Flow

```javascript
app.get('/login/client-credentials', async (req, res) => {
  console.log('\\n--- Client Credentials Flow ---');

  try {
    const response = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: process.env.M2M_CLIENT_ID,
        client_secret: process.env.M2M_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
      }
    );

    const tokens = response.data;

    // Decode access token
    const payload = tokens.access_token.split('.')[1];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());

    console.log('M2M Access Token received');
    console.log('Expires in:', tokens.expires_in, 'seconds');

    res.send(`
      <h1>Client Credentials Flow - Success!</h1>
      <p>No user involved - this is machine-to-machine.</p>
      <h2>Access Token Claims:</h2>
      <pre>${JSON.stringify(claims, null, 2)}</pre>
      <p><strong>Notice:</strong> No <code>sub</code> claim with user info —
      this token represents the <em>application</em>, not a user.</p>
      <a href="/">Back to Home</a>
    `);
  } catch (error) {
    res.status(500).send(`<h1>Failed</h1><pre>${JSON.stringify(error.response?.data, null, 2)}</pre>`);
  }
});
```

---

## Part 4: Test with cURL

### Step 8: Test Client Credentials via CLI

```bash
# Client Credentials Flow via cURL
curl -s -X POST "https://YOUR_DOMAIN.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://api.oauth-lab.local"
  }' | jq .

# Decode the access token
ACCESS_TOKEN="paste-token-here"
echo $ACCESS_TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

---

## Validation Checklist

- [ ] Authorization Code flow redirects to Auth0 and returns tokens
- [ ] State parameter is validated to prevent CSRF
- [ ] PKCE flow includes code_challenge and code_verifier
- [ ] Client Credentials flow returns an access token without user login
- [ ] ID tokens contain user claims (sub, email, name)
- [ ] Access tokens can be decoded to see permissions

---

## Key Observations

After completing this lab, you should understand:

1. **Auth Code flow** requires a redirect — the user leaves your app
2. **PKCE** adds security without needing a client secret
3. **Client Credentials** has no user interaction — it's service-to-service
4. **State** prevents CSRF attacks in redirect-based flows
5. **ID tokens** identify users, **access tokens** authorize API calls
6. **Never** send ID tokens to APIs — use access tokens

---

**Next Lab**: [Lab 02: OIDC Implementation →](./lab-02-oidc-implementation.md)
