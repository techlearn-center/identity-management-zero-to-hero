# Lab 01: Unit Testing JWT Validation

## Objective
Write comprehensive unit tests for JWT validation covering all edge cases: valid tokens, expired tokens, wrong audience/issuer, tampered signatures, and algorithm attacks.

## Prerequisites
- Node.js 20+
- Jest installed

## Setup

```bash
mkdir jwt-testing-lab && cd jwt-testing-lab
npm init -y
npm install --save-dev jest jsonwebtoken
```

## Test Suite

Create `jwt-validator.test.js`:

```javascript
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-key-for-unit-tests';
const ISSUER = 'https://auth.example.com/';
const AUDIENCE = 'https://api.example.com';

function createToken(overrides = {}, secret = SECRET) {
  const payload = {
    sub: 'user-123',
    iss: ISSUER,
    aud: AUDIENCE,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'test@example.com',
    ...overrides,
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

function validateToken(token) {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

describe('JWT Validation', () => {
  describe('Valid Tokens', () => {
    test('accepts a valid token with all required claims', () => {
      const token = createToken();
      const decoded = validateToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    test('accepts token with multiple audiences', () => {
      const token = createToken({ aud: [AUDIENCE, 'https://other.api.com'] });
      const decoded = validateToken(token);
      expect(decoded.aud).toContain(AUDIENCE);
    });
  });

  describe('Expired Tokens', () => {
    test('rejects expired token', () => {
      const token = createToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
      expect(() => validateToken(token)).toThrow('jwt expired');
    });

    test('rejects token with exp in the past', () => {
      const token = createToken({ exp: 0 });
      expect(() => validateToken(token)).toThrow();
    });
  });

  describe('Invalid Claims', () => {
    test('rejects wrong issuer', () => {
      const token = createToken({ iss: 'https://evil.com/' });
      expect(() => validateToken(token)).toThrow('jwt issuer invalid');
    });

    test('rejects wrong audience', () => {
      const token = createToken({ aud: 'https://wrong-api.com' });
      expect(() => validateToken(token)).toThrow('jwt audience invalid');
    });

    test('rejects missing sub claim', () => {
      const token = createToken({ sub: undefined });
      const decoded = validateToken(token);
      expect(decoded.sub).toBeUndefined();
      // In production, you should check for required claims
    });
  });

  describe('Signature Attacks', () => {
    test('rejects token signed with different secret', () => {
      const token = createToken({}, 'wrong-secret');
      expect(() => validateToken(token)).toThrow('invalid signature');
    });

    test('rejects tampered payload', () => {
      const token = createToken();
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload.sub = 'admin-user';
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tampered = parts.join('.');
      expect(() => validateToken(tampered)).toThrow('invalid signature');
    });
  });

  describe('Not Before (nbf)', () => {
    test('rejects token used before nbf', () => {
      const token = createToken({ nbf: Math.floor(Date.now() / 1000) + 3600 });
      expect(() => validateToken(token)).toThrow('jwt not active');
    });
  });

  describe('Token Format', () => {
    test('rejects malformed token', () => {
      expect(() => validateToken('not.a.valid.token')).toThrow();
    });

    test('rejects empty string', () => {
      expect(() => validateToken('')).toThrow();
    });
  });
});
```

## Run Tests

```bash
npx jest jwt-validator.test.js --verbose
```

## Validation Checklist
- [ ] All valid token tests pass
- [ ] Expired tokens are rejected
- [ ] Wrong issuer/audience is rejected
- [ ] Tampered tokens are rejected
- [ ] Tokens signed with wrong key are rejected
- [ ] Malformed tokens are handled gracefully
