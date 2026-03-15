# Lab 04: JWT Deep Dive — Create, Sign, Validate, Debug

## Objective

Master JSON Web Tokens by creating them from scratch, signing with different algorithms, validating properly, and debugging common JWT issues.

---

## Prerequisites

- Node.js 20+ or Python 3.11+
- OpenSSL installed
- Basic understanding of cryptography concepts

---

## Part 1: Create JWTs from Scratch

### Step 1: Manual JWT Construction

```javascript
// manual-jwt.js — Build a JWT without any library
const crypto = require('crypto');

// Step 1: Create Header
const header = {
  alg: 'HS256',
  typ: 'JWT'
};

// Step 2: Create Payload
const payload = {
  sub: '1234567890',
  name: 'Jane Doe',
  email: 'jane@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  iss: 'https://auth.example.com',
  aud: 'https://api.example.com',
};

// Step 3: Base64URL encode
function base64url(data) {
  return Buffer.from(JSON.stringify(data))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const encodedHeader = base64url(header);
const encodedPayload = base64url(payload);

// Step 4: Create signature
const secret = 'your-256-bit-secret';
const signatureInput = `${encodedHeader}.${encodedPayload}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(signatureInput)
  .digest('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

// Step 5: Assemble JWT
const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

console.log('=== Manual JWT ===');
console.log('Header:', JSON.stringify(header));
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('\nJWT:', jwt);
console.log('\nParts:');
console.log('  Header:', encodedHeader);
console.log('  Payload:', encodedPayload);
console.log('  Signature:', signature);
```

### Step 2: Generate RSA Keys for RS256

```bash
# Generate RSA private key (2048-bit)
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# View the keys
cat private.pem
cat public.pem
```

### Step 3: Sign with RS256

```javascript
// rs256-jwt.js
const crypto = require('crypto');
const fs = require('fs');

const privateKey = fs.readFileSync('private.pem', 'utf8');
const publicKey = fs.readFileSync('public.pem', 'utf8');

function base64url(data) {
  if (typeof data === 'string') {
    return Buffer.from(data).toString('base64url');
  }
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

// Create RS256 JWT
const header = { alg: 'RS256', typ: 'JWT', kid: 'my-key-id-1' };
const payload = {
  sub: 'user-123',
  name: 'Jane Doe',
  email: 'jane@example.com',
  roles: ['admin', 'editor'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  iss: 'https://auth.example.com',
  aud: 'https://api.example.com',
};

const signatureInput = `${base64url(header)}.${base64url(payload)}`;
const signature = crypto
  .createSign('RSA-SHA256')
  .update(signatureInput)
  .sign(privateKey, 'base64url');

const token = `${base64url(header)}.${base64url(payload)}.${signature}`;
console.log('RS256 JWT:', token);

// Verify the signature
const isValid = crypto
  .createVerify('RSA-SHA256')
  .update(signatureInput)
  .verify(publicKey, signature, 'base64url');

console.log('Signature valid:', isValid);
```

---

## Part 2: Validate JWTs Properly

### Step 4: Complete Validation Implementation

```javascript
// validate-jwt.js
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

class JWTValidator {
  constructor(options) {
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.algorithms = options.algorithms || ['RS256'];
    this.clockTolerance = options.clockTolerance || 30; // seconds
    this.publicKey = options.publicKey;
  }

  // Decode without validating (for inspection only)
  static decode(token) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');

    return {
      header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
      payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
      signature: parts[2],
    };
  }

  // Full validation
  validate(token) {
    const errors = [];
    const { header, payload, signature } = JWTValidator.decode(token);
    const now = Math.floor(Date.now() / 1000);

    // 1. Validate algorithm
    if (!this.algorithms.includes(header.alg)) {
      errors.push(`Invalid algorithm: ${header.alg}. Expected: ${this.algorithms.join(', ')}`);
    }

    // CRITICAL: Reject "none" algorithm
    if (header.alg === 'none') {
      errors.push('SECURITY: "none" algorithm is not allowed');
    }

    // 2. Verify signature
    const signatureInput = token.split('.').slice(0, 2).join('.');
    const isSignatureValid = crypto
      .createVerify('RSA-SHA256')
      .update(signatureInput)
      .verify(this.publicKey, signature, 'base64url');

    if (!isSignatureValid) {
      errors.push('Invalid signature');
    }

    // 3. Check expiration
    if (payload.exp && payload.exp + this.clockTolerance < now) {
      errors.push(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }

    // 4. Check not-before
    if (payload.nbf && payload.nbf - this.clockTolerance > now) {
      errors.push(`Token not valid before ${new Date(payload.nbf * 1000).toISOString()}`);
    }

    // 5. Check issued-at (not in the future)
    if (payload.iat && payload.iat - this.clockTolerance > now) {
      errors.push('Token issued in the future');
    }

    // 6. Validate issuer
    if (this.issuer && payload.iss !== this.issuer) {
      errors.push(`Invalid issuer: ${payload.iss}. Expected: ${this.issuer}`);
    }

    // 7. Validate audience
    if (this.audience) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(this.audience)) {
        errors.push(`Invalid audience: ${payload.aud}. Expected: ${this.audience}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      header,
      payload,
    };
  }
}

// Example usage
const publicKey = fs.readFileSync('public.pem', 'utf8');

const validator = new JWTValidator({
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
  algorithms: ['RS256'],
  publicKey,
});

// Test with a valid token (use token from Step 3)
const token = 'paste-your-rs256-jwt-here';
const result = validator.validate(token);

console.log('=== JWT Validation Result ===');
console.log('Valid:', result.valid);
if (result.errors.length > 0) {
  console.log('Errors:', result.errors);
}
console.log('Claims:', JSON.stringify(result.payload, null, 2));
```

---

## Part 3: Common JWT Debugging Scenarios

### Scenario 1: Expired Token

```javascript
// Create an already-expired token
const expiredPayload = {
  sub: 'user-123',
  iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
  exp: Math.floor(Date.now() / 1000) - 3600,  // Expired 1 hour ago
};
// Validation should fail with: "Token expired"
```

### Scenario 2: Wrong Audience

```javascript
// Token has aud: "https://other-api.example.com"
// But validator expects: "https://api.example.com"
// Validation should fail with: "Invalid audience"
```

### Scenario 3: Algorithm Confusion Attack

```javascript
// Attacker changes header from RS256 to HS256
// and signs with the public key as HMAC secret
// Your validator MUST reject this by whitelisting algorithms
```

### Scenario 4: Missing Claims

```javascript
// Useful function to check required claims
function validateRequiredClaims(payload, required) {
  const missing = required.filter(claim => !(claim in payload));
  if (missing.length > 0) {
    throw new Error(`Missing required claims: ${missing.join(', ')}`);
  }
}

validateRequiredClaims(payload, ['sub', 'iss', 'aud', 'exp', 'iat']);
```

---

## Validation Checklist

- [ ] Can create JWTs manually (header + payload + signature)
- [ ] Understand HS256 (symmetric) vs RS256 (asymmetric)
- [ ] Can generate RSA key pairs with OpenSSL
- [ ] Validator checks: signature, expiry, nbf, issuer, audience, algorithm
- [ ] Reject tokens with `alg: "none"`
- [ ] Understand clock tolerance for expiry checks
- [ ] Can decode and inspect JWTs for debugging

---

**Next Module**: [03 - Auth0 Fundamentals →](../../03-auth0-fundamentals/)
