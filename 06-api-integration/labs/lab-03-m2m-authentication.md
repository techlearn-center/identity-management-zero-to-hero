# Lab 03: Machine-to-Machine (M2M) Authentication

## Objective

Set up machine-to-machine authentication between two backend services using the OAuth 2.0 Client Credentials grant. Service A (a data processor) will authenticate with Auth0 to get an access token, then use that token to call Service B (a data API).

## Prerequisites

- Completed Labs 01 and 02
- Auth0 account with API configured
- Node.js 18+ (for Service A)
- Python 3.10+ or Node.js (for Service B)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      M2M Authentication Flow                     │
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────┐ │
│  │  Service A   │  Step 1 │              │  Step 2  │          │ │
│  │  (Data       │────────▶│    Auth0     │────────▶│ Service  │ │
│  │  Processor)  │  Client │   /oauth/    │  Access  │ A gets   │ │
│  │              │  Creds  │   token      │  Token   │ token    │ │
│  └──────┬───────┘         └──────────────┘         └──────────┘ │
│         │                                                        │
│         │ Step 3: API call with Bearer token                     │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │  Service B   │  Step 4: Validates JWT (same as user tokens)   │
│  │  (Data API)  │  Step 5: Checks permissions                    │
│  │              │  Step 6: Returns data                           │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

## M2M vs User Tokens

| Aspect | User Token | M2M Token |
|--------|-----------|-----------|
| Grant type | Authorization Code + PKCE | Client Credentials |
| `sub` claim | `auth0\|user123` | `CLIENT_ID@clients` |
| `gty` claim | Not present | `client-credentials` |
| Scopes | User-consented | Pre-authorized |
| Refresh token | Yes | No (request new token) |
| Human identity | Yes | No |
| Use case | User-facing APIs | Service-to-service |

## Step 1: Create an M2M Application in Auth0

### 1.1 Create the Application

1. Go to **Auth0 Dashboard** → **Applications** → **Applications**
2. Click **+ Create Application**
3. Fill in:
   - **Name**: `Service A - Data Processor`
   - **Application Type**: **Machine to Machine Applications**
4. Click **Create**

### 1.2 Authorize the Application for Your API

1. On the next screen, select your API (`Identity Lab API`)
2. Select the permissions (scopes) to grant:
   - `read:data`
   - `write:data`
3. Click **Authorize**

### 1.3 Note the Credentials

From the **Settings** tab, record:

```
Client ID:     M2M_CLIENT_ID_VALUE
Client Secret: M2M_CLIENT_SECRET_VALUE
```

## Step 2: Request an M2M Token

### Using curl

```bash
curl -X POST "https://YOUR_DOMAIN.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "M2M_CLIENT_ID",
    "client_secret": "M2M_CLIENT_SECRET",
    "audience": "https://api.identity-lab.local",
    "grant_type": "client_credentials"
  }'
```

### Expected Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### Decode the Token

```bash
echo "ACCESS_TOKEN" | cut -d'.' -f2 | base64 -d | python3 -m json.tool
```

```json
{
  "iss": "https://your-tenant.auth0.com/",
  "sub": "M2M_CLIENT_ID@clients",
  "aud": "https://api.identity-lab.local",
  "iat": 1700000000,
  "exp": 1700086400,
  "gty": "client-credentials",
  "azp": "M2M_CLIENT_ID",
  "permissions": ["read:data", "write:data"]
}
```

Notice:
- `sub` is the client ID with `@clients` suffix
- `gty` is `client-credentials` (identifies this as M2M)
- No `email` or `name` claims (no human user)
- `permissions` are the ones authorized in Step 1.2

## Step 3: Build Service A (Data Processor)

Create `service-a/`:

```bash
mkdir service-a && cd service-a
npm init -y
npm install axios dotenv
```

Create `service-a/.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
M2M_CLIENT_ID=your_m2m_client_id
M2M_CLIENT_SECRET=your_m2m_client_secret
SERVICE_B_AUDIENCE=https://api.identity-lab.local
SERVICE_B_URL=http://localhost:3001
```

Create `service-a/index.js`:

```javascript
require('dotenv').config();
const axios = require('axios');

const {
  AUTH0_DOMAIN,
  M2M_CLIENT_ID,
  M2M_CLIENT_SECRET,
  SERVICE_B_AUDIENCE,
  SERVICE_B_URL,
} = process.env;

// Token cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get an M2M access token from Auth0.
 * Caches the token until it expires.
 */
async function getM2MToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() / 1000 < tokenExpiresAt - 60) {
    console.log('Using cached M2M token');
    return cachedToken;
  }

  console.log('Requesting new M2M token from Auth0...');

  const response = await axios.post(
    `https://${AUTH0_DOMAIN}/oauth/token`,
    {
      client_id: M2M_CLIENT_ID,
      client_secret: M2M_CLIENT_SECRET,
      audience: SERVICE_B_AUDIENCE,
      grant_type: 'client_credentials',
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() / 1000 + response.data.expires_in;

  console.log(`M2M token obtained, expires in ${response.data.expires_in}s`);
  return cachedToken;
}

/**
 * Call Service B with M2M authentication.
 */
async function callServiceB(method, path, data = null) {
  const token = await getM2MToken();

  const config = {
    method,
    url: `${SERVICE_B_URL}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    config.data = data;
  }

  const response = await axios(config);
  return response.data;
}

/**
 * Main processing function.
 * Demonstrates reading from and writing to Service B.
 */
async function processData() {
  try {
    console.log('\n=== Service A: Data Processor ===\n');

    // Step 1: Read existing data from Service B
    console.log('1. Reading data from Service B...');
    const existingData = await callServiceB('GET', '/api/data');
    console.log(`   Found ${existingData.data.length} items`);

    // Step 2: Process and write new data to Service B
    console.log('2. Writing processed data to Service B...');
    const newItem = await callServiceB('POST', '/api/data', {
      name: `Processed Item - ${new Date().toISOString()}`,
      description: 'Created by Service A via M2M auth',
    });
    console.log(`   Created item: ${JSON.stringify(newItem)}`);

    // Step 3: Verify the write
    console.log('3. Verifying data...');
    const updatedData = await callServiceB('GET', '/api/data');
    console.log(`   Now ${updatedData.data.length} items`);

    // Step 4: Check who we are (M2M identity)
    console.log('4. Checking M2M identity...');
    const identity = await callServiceB('GET', '/api/users/me');
    console.log(`   Authenticated as: ${identity.user_id}`);
    console.log(`   Permissions: ${identity.permissions.join(', ')}`);
    console.log(`   Is M2M: ${identity.is_m2m || 'check gty claim'}`);

    console.log('\n=== Processing Complete ===\n');
  } catch (error) {
    if (error.response) {
      console.error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run
processData();
```

## Step 4: Build Service B (Data API)

Service B is the Express or FastAPI application from Lab 01 or Lab 02. It already validates JWTs and checks permissions. M2M tokens are validated the same way as user tokens.

To distinguish M2M from user requests, check the `gty` claim:

### Express (add to routes/api.js):

```javascript
// M2M-only endpoint
router.post('/internal/process', (req, res) => {
  // Check if this is an M2M token
  if (req.auth.gty !== 'client-credentials') {
    return res.status(403).json({
      error: 'This endpoint is for service-to-service calls only',
    });
  }

  res.json({
    message: 'M2M request processed',
    service_id: req.auth.sub,
    data: req.body,
  });
});
```

### FastAPI (add to routes/api.py):

```python
@router.post("/internal/process")
async def internal_process(
    body: dict,
    user: dict = Depends(get_current_user),
):
    if not user.get("is_m2m"):
        raise HTTPException(status_code=403, detail="M2M auth required")

    return {
        "message": "M2M request processed",
        "service_id": user["id"],
        "data": body,
    }
```

## Step 5: Run and Test

### Start Service B (in one terminal):

```bash
# Express
cd express-auth0-api && npm run dev

# Or FastAPI
cd fastapi-auth0-api && uvicorn main:app --reload --port 3001
```

### Run Service A (in another terminal):

```bash
cd service-a && node index.js
```

### Expected Output:

```
=== Service A: Data Processor ===

1. Reading data from Service B...
   Found 2 items
Requesting new M2M token from Auth0...
M2M token obtained, expires in 86400s
2. Writing processed data to Service B...
   Created item: {"id":3,"name":"Processed Item - 2024-01-15T10:30:00.000Z",...}
Using cached M2M token
3. Verifying data...
   Now 3 items
Using cached M2M token
4. Checking M2M identity...
   Authenticated as: M2M_CLIENT_ID@clients
   Permissions: read:data, write:data

=== Processing Complete ===
```

## Step 6: Token Caching Best Practices

### Why Cache M2M Tokens?

Each token request counts against Auth0 rate limits. An uncached service making 1000 requests/second would fail after the first request.

### Caching Strategy:

```
Request needed → Is token cached?
                  │
                  ├── YES → Is it expired (or about to)?
                  │          │
                  │          ├── NO  → Use cached token
                  │          └── YES → Request new token, cache it
                  │
                  └── NO → Request new token, cache it
```

### Python Token Cache:

```python
import time
import httpx

class M2MTokenManager:
    def __init__(self, domain, client_id, client_secret, audience):
        self.domain = domain
        self.client_id = client_id
        self.client_secret = client_secret
        self.audience = audience
        self._token = None
        self._expires_at = 0

    async def get_token(self) -> str:
        # Return cached token if valid (with 60s buffer)
        if self._token and time.time() < self._expires_at - 60:
            return self._token

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://{self.domain}/oauth/token",
                json={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "audience": self.audience,
                    "grant_type": "client_credentials",
                },
            )
            response.raise_for_status()
            data = response.json()

            self._token = data["access_token"]
            self._expires_at = time.time() + data["expires_in"]

            return self._token
```

## Step 7: Security Considerations

### 1. Protect Client Secrets

- Never commit client secrets to version control
- Use environment variables or secret managers (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets periodically

### 2. Use Minimum Required Permissions

Only grant the permissions Service A actually needs. If it only reads data, do not grant `write:data`.

### 3. Monitor M2M Token Usage

Set up alerts for:
- Unusual token request volumes
- Failed authentication attempts
- Permissions escalation

### 4. Token Rotation

If a client secret is compromised:
1. Rotate the secret in Auth0 Dashboard
2. Update the secret in Service A's configuration
3. Old tokens will continue to work until they expire
4. New tokens will use the new secret

### 5. Network Restrictions

In production, restrict M2M communication to internal networks:
- Use private subnets
- Configure security groups/network policies
- Use service mesh (Istio, Linkerd) for mutual TLS

## Validation Checklist

- [ ] M2M application created in Auth0
- [ ] Application authorized for the API with correct permissions
- [ ] Client Credentials grant returns an access token
- [ ] Token contains `gty: client-credentials`
- [ ] Token contains correct permissions
- [ ] Service A can authenticate and call Service B
- [ ] Token is cached (observe "Using cached M2M token" logs)
- [ ] Permission checks work (try calling admin endpoints)
- [ ] M2M tokens are rejected from human-only endpoints
- [ ] User tokens are rejected from M2M-only endpoints

## Troubleshooting

**"access_denied: Client is not authorized for this API"**
Go to Auth0 Dashboard → Applications → APIs → Machine to Machine Applications, and authorize Service A for your API.

**"Unauthorized: invalid_client"**
Client ID or secret is incorrect. Check the values in your `.env` file.

**Token contains no permissions**
Ensure RBAC is enabled and "Add Permissions in the Access Token" is checked in your API settings.

**Service B rejects the token**
Check that `AUTH0_AUDIENCE` in Service B matches the audience in the M2M token. Decode the token to verify.

## Next Steps

You have completed the API Integration module. Review the Express and FastAPI implementations for reference, and integrate these patterns into your own applications.
