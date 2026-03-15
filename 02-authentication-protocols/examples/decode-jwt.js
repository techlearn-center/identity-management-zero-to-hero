#!/usr/bin/env node
/**
 * JWT Decoder and Validator (Node.js)
 * Decodes JWT tokens and validates claims.
 * Usage: node decode-jwt.js <jwt_token>
 */

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function decodeJWT(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT: expected 3 parts, got ${parts.length}`);
  }

  return {
    header: JSON.parse(base64urlDecode(parts[0])),
    payload: JSON.parse(base64urlDecode(parts[1])),
    signature: parts[2],
  };
}

function validateClaims(payload) {
  const issues = [];
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (payload.exp) {
    const expDate = new Date(payload.exp * 1000).toISOString();
    if (payload.exp < now) {
      issues.push(`EXPIRED: Token expired at ${expDate}`);
    } else {
      const remaining = payload.exp - now;
      const mins = Math.floor(remaining / 60);
      issues.push(`OK: Expires at ${expDate} (${mins} minutes remaining)`);
    }
  } else {
    issues.push("WARNING: No 'exp' claim - token never expires");
  }

  // Check not-before
  if (payload.nbf) {
    const nbfDate = new Date(payload.nbf * 1000).toISOString();
    if (payload.nbf > now) {
      issues.push(`NOT YET VALID: Valid from ${nbfDate}`);
    } else {
      issues.push(`OK: Valid since ${nbfDate}`);
    }
  }

  // Check issued-at
  if (payload.iat) {
    const iatDate = new Date(payload.iat * 1000).toISOString();
    if (payload.iat > now) {
      issues.push(`WARNING: Issued in the future: ${iatDate}`);
    } else {
      issues.push(`OK: Issued at ${iatDate}`);
    }
  }

  // Check required claims
  const recommended = ['sub', 'iss', 'aud'];
  for (const claim of recommended) {
    if (!(claim in payload)) {
      issues.push(`WARNING: Missing recommended claim '${claim}'`);
    }
  }

  // Check algorithm in header
  return issues;
}

function formatOutput(decoded) {
  console.log('='.repeat(60));
  console.log('JWT DECODER (Node.js)');
  console.log('='.repeat(60));

  console.log('\n--- HEADER ---');
  console.log(JSON.stringify(decoded.header, null, 2));

  console.log('\n--- PAYLOAD ---');
  console.log(JSON.stringify(decoded.payload, null, 2));

  console.log('\n--- SIGNATURE ---');
  const sig = decoded.signature;
  console.log(sig.length > 50 ? sig.substring(0, 50) + '...' : sig);

  console.log('\n--- VALIDATION ---');
  const issues = validateClaims(decoded.payload);
  issues.forEach(issue => console.log(`  ${issue}`));

  console.log('\n' + '='.repeat(60));
}

// Main
const token = process.argv[2];
if (!token) {
  console.log('Usage: node decode-jwt.js <jwt_token>');
  console.log('\nExample:');
  console.log('  node decode-jwt.js eyJhbGciOiJSUzI1NiIs...');
  process.exit(1);
}

try {
  const decoded = decodeJWT(token);
  formatOutput(decoded);
} catch (err) {
  console.error(`Error decoding JWT: ${err.message}`);
  process.exit(1);
}
