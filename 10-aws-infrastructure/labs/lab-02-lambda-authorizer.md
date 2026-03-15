# Lab 02: Build a Lambda JWT Authorizer

## Objective

Build an AWS Lambda function that validates JWT access tokens for API Gateway. This is how you protect AWS APIs with Auth0 — API Gateway calls your Lambda authorizer before forwarding requests to your backend.

## Prerequisites

- AWS CLI configured
- Node.js 18+ installed
- Auth0 tenant from Module 03 (you need the domain and API audience)

## Estimated Time

45–60 minutes

---

## Part 1: How Lambda Authorizers Work

```
Client                API Gateway              Lambda Authorizer          Backend
──────                ───────────              ─────────────────          ───────
1. Request + JWT ──→
2.                    Extract token from
                      Authorization header
3.                    Invoke Lambda ──────→
4.                                             Validate JWT:
                                               - Verify signature (JWKS)
                                               - Check expiry
                                               - Check audience
                                               - Check issuer
5.                                             Return IAM policy ──→
6.                    Cache policy (5 min)
7.                    Policy says Allow? ──────────────────────────→
8.                                                                  Process request
9. ←──────────────────────────────────────────────────────────────── Response
```

---

## Part 2: Write the Lambda Function

### Step 1: Set up the project

```bash
mkdir -p ~/lambda-authorizer && cd ~/lambda-authorizer
npm init -y
npm install jsonwebtoken jwks-rsa
```

### Step 2: Create the handler

Create `index.js`:

```javascript
// index.js — Lambda JWT Authorizer for API Gateway
//
// This function validates JWTs from Auth0 and returns an IAM policy
// that API Gateway uses to allow or deny the request.

const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

// Configuration — set these for your Auth0 tenant
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN; // e.g., "your-tenant.us.auth0.com"
const API_AUDIENCE = process.env.API_AUDIENCE; // e.g., "https://api.identity-lab.local"

// JWKS client — fetches Auth0's public keys to verify JWT signatures
const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,          // Cache keys in memory
  cacheMaxAge: 600000,  // Cache for 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// Get the signing key from JWKS
function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

// Main handler
exports.handler = async (event) => {
  console.log("Authorizer invoked. Method ARN:", event.methodArn);

  try {
    // Step 1: Extract the token from the Authorization header
    const token = extractToken(event);
    if (!token) {
      console.log("No token found");
      throw new Error("Unauthorized");
    }

    // Step 2: Decode the token header to get the key ID (kid)
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      console.log("Invalid token format");
      throw new Error("Unauthorized");
    }

    // Step 3: Get the public key from Auth0's JWKS endpoint
    const signingKey = await getSigningKey(decoded.header.kid);

    // Step 4: Verify the token (signature, expiry, audience, issuer)
    const payload = jwt.verify(token, signingKey, {
      audience: API_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
      algorithms: ["RS256"],
    });

    console.log("Token valid. Subject:", payload.sub);

    // Step 5: Generate an IAM policy that allows access
    const policy = generatePolicy(payload.sub, "Allow", event.methodArn, payload);
    return policy;

  } catch (error) {
    console.error("Authorization failed:", error.message);
    // Return Deny policy (API Gateway will return 403)
    return generatePolicy("unauthorized", "Deny", event.methodArn);
  }
};

// Extract Bearer token from the event
function extractToken(event) {
  // API Gateway sends the token in event.authorizationToken
  const authHeader = event.authorizationToken || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

// Generate an IAM policy document
function generatePolicy(principalId, effect, resource, tokenPayload = {}) {
  const policy = {
    principalId: principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource.replace(/\/[^/]+\/[^/]+$/, "/*"), // Allow all methods/paths
        },
      ],
    },
    // Pass token claims to the backend via context
    context: {
      sub: tokenPayload.sub || "",
      email: tokenPayload.email || "",
      scope: tokenPayload.scope || "",
      permissions: JSON.stringify(tokenPayload.permissions || []),
    },
  };
  return policy;
}
```

**What each step does:**
1. Extracts the JWT from the `Authorization: Bearer <token>` header
2. Decodes the JWT header to find the key ID (`kid`)
3. Fetches the matching public key from Auth0's JWKS endpoint
4. Verifies the signature, expiration, audience, and issuer
5. Returns an IAM policy: `Allow` if valid, `Deny` if invalid

### Step 3: Test locally

Create `test-event.json`:

```json
{
  "type": "TOKEN",
  "authorizationToken": "Bearer YOUR_ACCESS_TOKEN_HERE",
  "methodArn": "arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/api/protected"
}
```

Get a test token from Auth0 (Dashboard → APIs → your API → Test tab) and paste it in.

```bash
# Set environment variables
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export API_AUDIENCE=https://api.identity-lab.local

# Test with Node.js directly
node -e "
const handler = require('./index').handler;
const event = require('./test-event.json');
handler(event).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

---

## Part 3: Deploy to AWS

### Step 4: Package the function

```bash
# Create a deployment package
zip -r authorizer.zip index.js node_modules/ package.json
```

### Step 5: Deploy with AWS CLI

```bash
# Create the Lambda function
aws lambda create-function \
    --function-name identity-lab-jwt-authorizer \
    --runtime nodejs18.x \
    --handler index.handler \
    --zip-file fileb://authorizer.zip \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/identity-lab-lambda-role \
    --environment "Variables={AUTH0_DOMAIN=your-tenant.us.auth0.com,API_AUDIENCE=https://api.identity-lab.local}" \
    --timeout 10 \
    --memory-size 128

# Test the deployed function
aws lambda invoke \
    --function-name identity-lab-jwt-authorizer \
    --payload file://test-event.json \
    output.json

cat output.json | jq .
```

---

## Validation Checklist

- [ ] Lambda function validates JWT signature using JWKS
- [ ] Token expiry, audience, and issuer are checked
- [ ] Valid token returns Allow policy
- [ ] Invalid/expired token returns Deny policy
- [ ] Token claims passed to backend via context
- [ ] Function deployed and invocable

---

**Next Lab**: [Lab 03: API Gateway with Auth →](./lab-03-api-gateway-auth.md)
