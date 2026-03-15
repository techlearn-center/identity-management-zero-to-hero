# Lab 03: Configure SAML 2.0 Between IdP and SP

## Objective

Set up SAML 2.0 Single Sign-On between Auth0 (as the Identity Provider) and a Node.js application (as the Service Provider), including metadata exchange, assertion validation, and attribute mapping.

---

## Prerequisites

- Auth0 account with an existing tenant
- Node.js 20+ installed
- Understanding of SAML concepts from Module 02 README

---

## Part 1: Configure Auth0 as SAML IdP

### Step 1: Enable SAML Addon in Auth0

1. Go to Auth0 Dashboard → Applications → Your Application
2. Click the **Addons** tab
3. Enable **SAML2 Web App**
4. Configure the settings:

```json
{
  "audience": "urn:saml-lab:sp",
  "recipient": "http://localhost:3000/saml/acs",
  "destination": "http://localhost:3000/saml/acs",
  "mappings": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "given_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "family_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
  },
  "nameIdentifierFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "nameIdentifierProbes": ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]
}
```

### Step 2: Download IdP Metadata

1. In the SAML addon settings, click the **Usage** tab
2. Download the **Identity Provider Metadata** XML file
3. Note the following values:
   - **IdP Login URL** (SSO endpoint)
   - **IdP Certificate** (for signature validation)
   - **Issuer** (Entity ID)

Save the metadata as `idp-metadata.xml` in your project.

---

## Part 2: Build the SAML Service Provider

### Step 3: Create the SP Application

```bash
mkdir saml-lab && cd saml-lab
npm init -y
npm install express express-session passport passport-saml dotenv
```

### Step 4: Configure Passport-SAML

```javascript
// saml-sp.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: SamlStrategy } = require('passport-saml');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// SAML Strategy configuration
const samlStrategy = new SamlStrategy(
  {
    // SP configuration
    path: '/saml/acs',                          // Assertion Consumer Service URL
    entityID: 'urn:saml-lab:sp',                // SP Entity ID

    // IdP configuration (from Auth0)
    entryPoint: process.env.SAML_ENTRY_POINT,   // IdP SSO URL
    issuer: 'urn:saml-lab:sp',                  // Must match SP Entity ID
    cert: process.env.SAML_IDP_CERT,            // IdP signing certificate

    // Options
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    disableRequestedAuthnContext: true,
  },
  // Verify callback
  (profile, done) => {
    console.log('\\n=== SAML Assertion Received ===');
    console.log('NameID:', profile.nameID);
    console.log('Email:', profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']);
    console.log('Name:', profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']);
    console.log('Session Index:', profile.sessionIndex);
    console.log('Issuer:', profile.issuer);
    console.log('================================\\n');

    // Map SAML attributes to user object
    const user = {
      id: profile.nameID,
      email: profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      name: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
      firstName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'],
      lastName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'],
      sessionIndex: profile.sessionIndex,
      issuer: profile.issuer,
    };

    return done(null, user);
  }
);

passport.use('saml', samlStrategy);

// Serialize/Deserialize user for session
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes

// Home page
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.send(`
      <h1>Welcome, ${req.user.name || req.user.email}!</h1>
      <h2>User Profile (from SAML Assertion):</h2>
      <table border="1" cellpadding="8">
        <tr><td><strong>Email</strong></td><td>${req.user.email}</td></tr>
        <tr><td><strong>Name</strong></td><td>${req.user.name}</td></tr>
        <tr><td><strong>First Name</strong></td><td>${req.user.firstName}</td></tr>
        <tr><td><strong>Last Name</strong></td><td>${req.user.lastName}</td></tr>
        <tr><td><strong>NameID</strong></td><td>${req.user.id}</td></tr>
        <tr><td><strong>IdP Issuer</strong></td><td>${req.user.issuer}</td></tr>
      </table>
      <br/>
      <a href="/logout">Logout</a>
    `);
  } else {
    res.send(`
      <h1>SAML 2.0 Lab - Service Provider</h1>
      <p>You are not authenticated.</p>
      <a href="/saml/login">Login with SAML SSO</a>
    `);
  }
});

// SP-Initiated Login (redirects to IdP)
app.get('/saml/login',
  passport.authenticate('saml', { failureRedirect: '/login-failed' })
);

// Assertion Consumer Service (ACS) - receives SAML Response from IdP
app.post('/saml/acs',
  passport.authenticate('saml', { failureRedirect: '/login-failed' }),
  (req, res) => {
    console.log('SAML authentication successful!');
    res.redirect('/');
  }
);

// SP Metadata endpoint
app.get('/saml/metadata', (req, res) => {
  res.type('application/xml');
  res.send(samlStrategy.generateServiceProviderMetadata());
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.redirect('/');
  });
});

// Error handler
app.get('/login-failed', (req, res) => {
  res.status(401).send('<h1>SAML Login Failed</h1><a href="/">Try Again</a>');
});

app.listen(PORT, () => {
  console.log(`SAML SP running at http://localhost:${PORT}`);
  console.log(`SP Metadata at http://localhost:${PORT}/saml/metadata`);
});
```

### Step 5: Environment Configuration

```bash
# .env
SAML_ENTRY_POINT=https://YOUR_DOMAIN.auth0.com/samlp/YOUR_CLIENT_ID
SAML_IDP_CERT="paste-the-auth0-idp-certificate-here"
```

---

## Part 3: Test the SAML Flow

### Step 6: Run and Test

```bash
node saml-sp.js

# 1. Open http://localhost:3000
# 2. Click "Login with SAML SSO"
# 3. You'll be redirected to Auth0 login page
# 4. After login, Auth0 sends SAML assertion to /saml/acs
# 5. You're logged in with SAML attributes displayed

# Check SP metadata:
curl http://localhost:3000/saml/metadata
```

### Step 7: Debug SAML Assertions

Use browser developer tools to inspect the SAML response:

1. Open DevTools → Network tab
2. Initiate login
3. Look for the POST to `/saml/acs`
4. The `SAMLResponse` form parameter is Base64-encoded
5. Decode it to see the raw XML assertion

```bash
# Decode a SAML Response
echo "PASTE_SAML_RESPONSE_HERE" | base64 -d | xmllint --format -
```

---

## Validation Checklist

- [ ] Auth0 SAML addon is configured with correct audience and ACS URL
- [ ] SP initiates login by redirecting to IdP
- [ ] IdP returns signed SAML assertion to ACS endpoint
- [ ] Assertion signature is validated
- [ ] User attributes are correctly mapped
- [ ] SP metadata endpoint is accessible
- [ ] Logout clears the session
- [ ] SAML Response can be decoded and inspected

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| "Invalid signature" | Wrong IdP certificate | Re-download cert from Auth0 |
| "Audience mismatch" | entityID doesn't match | Ensure SP entityID matches Auth0 config |
| "InResponseTo mismatch" | Request ID tracking | Enable `validateInResponseTo: false` for testing |
| Attributes not mapped | Wrong attribute names | Check SAML addon mappings in Auth0 |
| Redirect loop | Session not persisting | Check express-session configuration |

---

**Next Lab**: [Lab 04: JWT Deep Dive →](./lab-04-jwt-deep-dive.md)
