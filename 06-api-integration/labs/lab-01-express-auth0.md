# Lab 01: Build an Express API Secured with Auth0

## Objective

Build a complete Express.js REST API secured with Auth0 JWT validation, step by step. You will configure Auth0, implement JWT middleware, add role-based access control, create protected routes, and test everything with curl.

## Prerequisites

- Node.js 18+ installed
- An Auth0 account (free tier works)
- curl or Postman for testing

## Architecture

```
┌───────────────┐      ┌────────────────┐      ┌──────────────┐
│   Client      │      │  Express API   │      │   Auth0      │
│   (curl/      │─────▶│                │      │              │
│    Postman)   │      │  ┌──────────┐  │      │  ┌────────┐  │
│               │      │  │ Auth MW  │  │◀────▶│  │ JWKS   │  │
│               │      │  └────┬─────┘  │      │  │ Endpt  │  │
│               │      │  ┌────▼─────┐  │      │  └────────┘  │
│               │◀─────│  │ RBAC MW  │  │      │              │
│               │      │  └────┬─────┘  │      │  ┌────────┐  │
│               │      │  ┌────▼─────┐  │      │  │ Token  │  │
│               │      │  │ Routes   │  │      │  │ Endpt  │  │
│               │      │  └──────────┘  │      │  └────────┘  │
└───────────────┘      └────────────────┘      └──────────────┘
```

## Step 1: Configure Auth0

### 1.1 Create an API in Auth0

1. Log in to the [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → **APIs**
3. Click **+ Create API**
4. Fill in:
   - **Name**: `Identity Lab API`
   - **Identifier**: `https://api.identity-lab.local` (this becomes your audience)
   - **Signing Algorithm**: RS256
5. Click **Create**

### 1.2 Define Permissions

In your new API's **Permissions** tab, add:

| Permission | Description |
|-----------|-------------|
| `read:data` | Read application data |
| `write:data` | Create and modify data |
| `delete:data` | Delete data |
| `admin:all` | Full administrative access |

### 1.3 Create Roles

Navigate to **User Management** → **Roles**:

**Viewer Role:**
- Permissions: `read:data`

**Editor Role:**
- Permissions: `read:data`, `write:data`

**Admin Role:**
- Permissions: `read:data`, `write:data`, `delete:data`, `admin:all`

### 1.4 Enable RBAC

Back in your API settings:
1. Scroll to **RBAC Settings**
2. Enable **Enable RBAC**
3. Enable **Add Permissions in the Access Token**

### 1.5 Create a Test User

1. Go to **User Management** → **Users**
2. Click **+ Create User**
3. Create a test user and assign them the **Editor** role

### 1.6 Note Your Configuration

Record these values (you will need them):

```
Auth0 Domain:   your-tenant.auth0.com
API Audience:   https://api.identity-lab.local
Client ID:      (from a test application)
Client Secret:  (from a test application)
```

## Step 2: Initialize the Express Project

```bash
mkdir express-auth0-api && cd express-auth0-api
npm init -y
npm install express cors helmet morgan dotenv express-rate-limit \
  express-jwt jwks-rsa
npm install --save-dev nodemon jest supertest
```

## Step 3: Create Environment Configuration

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.identity-lab.local
AUTH0_NAMESPACE=https://identity-lab.com
ALLOWED_ORIGINS=http://localhost:3000
PORT=3001
```

## Step 4: Build the JWT Middleware

Create `middleware/auth.js`:

```javascript
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

/**
 * JWT validation middleware using express-jwt and jwks-rsa.
 *
 * This middleware:
 * 1. Extracts the Bearer token from the Authorization header
 * 2. Fetches the signing key from Auth0's JWKS endpoint
 * 3. Verifies the RS256 signature
 * 4. Validates issuer, audience, and expiration
 * 5. Attaches decoded payload to req.auth
 */
const checkJwt = jwt({
  // Dynamically provide a signing key based on the kid in the JWT header
  secret: jwksRsa.expressJwtSecret({
    cache: true,                      // Cache signing keys
    cacheMaxAge: 36000000,            // 10 hours
    rateLimit: true,                  // Rate limit JWKS requests
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),

  // Validate these claims
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

module.exports = { checkJwt };
```

## Step 5: Build the RBAC Middleware

Create `middleware/rbac.js`:

```javascript
/**
 * Check if the authenticated user has ALL specified permissions.
 */
function checkPermission(...requiredPermissions) {
  return (req, res, next) => {
    const tokenPermissions = req.auth?.permissions || [];

    const hasAll = requiredPermissions.every(p => tokenPermissions.includes(p));

    if (!hasAll) {
      const missing = requiredPermissions.filter(p => !tokenPermissions.includes(p));
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        missing,
      });
    }

    next();
  };
}

module.exports = { checkPermission };
```

## Step 6: Build the Server

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { checkJwt } = require('./middleware/auth');
const { checkPermission } = require('./middleware/rbac');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
}));
app.use(morgan('combined'));
app.use(express.json());

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Public routes (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/public', (req, res) => {
  res.json({ message: 'This is a public endpoint. No authentication required.' });
});

// Protected routes (JWT required)
app.use('/api', checkJwt, apiRoutes);

// Error handling
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'unauthorized',
      message: err.message || 'Invalid or missing token',
    });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Express API running on port ${PORT}`);
  console.log(`Auth0 Domain: ${process.env.AUTH0_DOMAIN}`);
  console.log(`Auth0 Audience: ${process.env.AUTH0_AUDIENCE}`);
});

module.exports = app;
```

## Step 7: Build the Routes

Create `routes/api.js`:

```javascript
const router = require('express').Router();
const { checkPermission } = require('../middleware/rbac');

// GET /api/users/me - Any authenticated user
router.get('/users/me', (req, res) => {
  res.json({
    user_id: req.auth.sub,
    email: req.auth.email || req.auth[`${process.env.AUTH0_NAMESPACE}/email`],
    permissions: req.auth.permissions || [],
  });
});

// GET /api/data - Requires read:data permission
router.get('/data', checkPermission('read:data'), (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Item 1', owner: req.auth.sub },
      { id: 2, name: 'Item 2', owner: req.auth.sub },
    ],
  });
});

// POST /api/data - Requires write:data permission
router.post('/data', checkPermission('write:data'), (req, res) => {
  res.status(201).json({
    id: 3,
    ...req.body,
    created_by: req.auth.sub,
  });
});

// DELETE /api/data/:id - Requires admin:all permission
router.delete('/data/:id', checkPermission('admin:all'), (req, res) => {
  res.json({ deleted: req.params.id, deleted_by: req.auth.sub });
});

module.exports = router;
```

## Step 8: Get a Test Token

### Option A: Using the Auth0 Dashboard

1. Go to your API's **Test** tab in the Auth0 Dashboard
2. Copy the provided access token

### Option B: Using curl

```bash
# Get a token using Resource Owner Password Grant (must be enabled in Auth0)
curl -X POST "https://YOUR_DOMAIN.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://api.identity-lab.local",
    "grant_type": "client_credentials"
  }'
```

Store the token:

```bash
export TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIs..."
```

## Step 9: Test the API

```bash
# Start the server
npm run dev

# Test public endpoint (no token needed)
curl http://localhost:3001/api/public

# Test health check
curl http://localhost:3001/api/health

# Test without token (should return 401)
curl http://localhost:3001/api/users/me

# Test with valid token
curl http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Test read endpoint (requires read:data)
curl http://localhost:3001/api/data \
  -H "Authorization: Bearer $TOKEN"

# Test write endpoint (requires write:data)
curl -X POST http://localhost:3001/api/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Item"}'

# Test admin endpoint (requires admin:all - will fail without admin role)
curl -X DELETE http://localhost:3001/api/data/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Step 10: Decode and Inspect the Token

```bash
# Decode the token payload (without verification)
echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

Expected payload structure:

```json
{
  "iss": "https://your-tenant.auth0.com/",
  "sub": "auth0|abc123",
  "aud": "https://api.identity-lab.local",
  "iat": 1700000000,
  "exp": 1700086400,
  "azp": "YOUR_CLIENT_ID",
  "scope": "openid profile email",
  "permissions": ["read:data", "write:data"]
}
```

## Validation Checklist

- [ ] Public endpoint accessible without token
- [ ] Protected endpoint returns 401 without token
- [ ] Protected endpoint returns 401 with invalid token
- [ ] Valid token returns user data from `/api/users/me`
- [ ] `read:data` permission grants access to GET `/api/data`
- [ ] `write:data` permission grants access to POST `/api/data`
- [ ] Missing `admin:all` permission returns 403 on DELETE
- [ ] Rate limiting returns 429 after too many requests
- [ ] CORS headers are properly set

## Troubleshooting

**"UnauthorizedError: jwt expired"**
Your test token has expired. Get a new one from Auth0.

**"UnauthorizedError: jwt audience invalid"**
Your `AUTH0_AUDIENCE` in `.env` does not match the audience in the token. Check your API identifier in Auth0.

**"Unable to find signing key"**
Your `AUTH0_DOMAIN` is incorrect, or Auth0 is unreachable. Verify you can access `https://YOUR_DOMAIN/.well-known/jwks.json`.

## Next Steps

Proceed to [Lab 02: FastAPI + Auth0](./lab-02-fastapi-auth0.md) to build the same API in Python.
