# Lab 02: Implement OIDC Authentication

## Objective

Build a Node.js application that authenticates users via OpenID Connect, validates ID tokens, retrieves user info, and handles the complete authentication lifecycle.

---

## Prerequisites

- Completed Lab 01 (OAuth 2.0 Flows)
- Auth0 application configured from Lab 01

---

## Part 1: OIDC Discovery

### Step 1: Fetch and Understand the Discovery Document

```bash
# Fetch your Auth0 tenant's OIDC discovery document
curl -s https://YOUR_DOMAIN.auth0.com/.well-known/openid-configuration | jq .
```

**Key endpoints to note:**
- `authorization_endpoint` — Where to send users to log in
- `token_endpoint` — Where to exchange codes for tokens
- `userinfo_endpoint` — Where to get user profile data
- `jwks_uri` — Where to get public keys for token validation
- `issuer` — The expected `iss` claim value

### Step 2: Fetch the JWKS (JSON Web Key Set)

```bash
# Get the public keys used to sign tokens
curl -s https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json | jq .
```

---

## Part 2: Build OIDC Authentication

### Step 3: Create the OIDC Application

```bash
mkdir oidc-lab && cd oidc-lab
npm init -y
npm install express express-session dotenv axios jsonwebtoken jwks-rsa
```

```javascript
// oidc-server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();
const PORT = 3000;

// Session middleware
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 3600000 }
}));

// JWKS client for token verification
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Validate ID token properly
function validateIdToken(idToken, nonce) {
  return new Promise((resolve, reject) => {
    jwt.verify(idToken, getKey, {
      algorithms: ['RS256'],
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      audience: process.env.AUTH0_CLIENT_ID,
    }, (err, decoded) => {
      if (err) return reject(err);

      // Verify nonce to prevent replay attacks
      if (decoded.nonce !== nonce) {
        return reject(new Error('Invalid nonce - possible replay attack'));
      }

      resolve(decoded);
    });
  });
}

// Home page
app.get('/', (req, res) => {
  if (req.session.user) {
    res.send(`
      <h1>Welcome, ${req.session.user.name}!</h1>
      <img src="${req.session.user.picture}" width="100" />
      <p>Email: ${req.session.user.email}</p>
      <p>Email Verified: ${req.session.user.email_verified}</p>
      <h2>ID Token Claims:</h2>
      <pre>${JSON.stringify(req.session.idTokenClaims, null, 2)}</pre>
      <a href="/logout">Logout</a>
    `);
  } else {
    res.send(`
      <h1>OIDC Authentication Lab</h1>
      <a href="/login">Login with OIDC</a>
    `);
  }
});

// Initiate OIDC login
app.get('/login', (req, res) => {
  // Generate state (CSRF) and nonce (replay protection)
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  req.session.authState = state;
  req.session.authNonce = nonce;

  const authUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `http://localhost:${PORT}/callback`);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);  // OIDC-specific!

  res.redirect(authUrl.toString());
});

// Handle OIDC callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.status(400).send(`Auth error: ${error}`);

  // Verify state
  if (state !== req.session.authState) {
    return res.status(403).send('Invalid state - CSRF detected');
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: `http://localhost:${PORT}/callback`,
      }
    );

    const { id_token, access_token } = tokenRes.data;

    // Validate ID token (signature, expiry, issuer, audience, nonce)
    const claims = await validateIdToken(id_token, req.session.authNonce);
    console.log('ID Token validated successfully');
    console.log('Claims:', JSON.stringify(claims, null, 2));

    // Fetch additional user info from UserInfo endpoint
    const userInfoRes = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    // Store in session
    req.session.user = userInfoRes.data;
    req.session.idTokenClaims = claims;
    req.session.idToken = id_token;

    // Clean up auth state
    delete req.session.authState;
    delete req.session.authNonce;

    res.redirect('/');
  } catch (err) {
    console.error('OIDC Error:', err.message);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

// Logout (OIDC RP-Initiated Logout)
app.get('/logout', (req, res) => {
  const idToken = req.session.idToken;
  req.session.destroy();

  // Redirect to Auth0 logout endpoint
  const logoutUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/v2/logout`);
  logoutUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  logoutUrl.searchParams.set('returnTo', `http://localhost:${PORT}`);

  res.redirect(logoutUrl.toString());
});

app.listen(PORT, () => console.log(`OIDC Lab running at http://localhost:${PORT}`));
```

---

## Part 3: Validate and Test

### Step 4: Verification Tests

```bash
# Start the server
node oidc-server.js

# Test 1: Login flow — open browser to http://localhost:3000/login
# Expected: Redirect to Auth0, login, redirect back with user info

# Test 2: Verify ID token has required claims
# Check console output for: iss, sub, aud, exp, iat, nonce

# Test 3: Test CSRF protection — tamper with state
# Manually visit /callback?code=fake&state=wrong
# Expected: "Invalid state - CSRF detected"

# Test 4: Logout — click logout link
# Expected: Session cleared, redirected to Auth0 logout, then back to home
```

---

## Validation Checklist

- [ ] OIDC discovery document is fetched and understood
- [ ] ID token is validated (signature, expiry, issuer, audience, nonce)
- [ ] UserInfo endpoint returns additional user claims
- [ ] State parameter prevents CSRF attacks
- [ ] Nonce parameter prevents token replay attacks
- [ ] Logout clears session and logs out from Auth0
- [ ] Session is properly managed

---

**Next Lab**: [Lab 03: SAML Setup →](./lab-03-saml-setup.md)
