# Module 05: Identity Testing

## Overview

Testing identity and authentication systems is critical for security. A single auth bug can expose all user data. This module covers the full testing pyramid for identity: unit tests, integration tests, E2E tests, security tests, and load tests.

---

## Table of Contents

1. [Why Identity Testing Matters](#why-identity-testing-matters)
2. [Testing Pyramid for Identity](#testing-pyramid-for-identity)
3. [Unit Testing Auth Logic](#unit-testing-auth-logic)
4. [Integration Testing Auth Flows](#integration-testing-auth-flows)
5. [E2E Testing](#e2e-testing)
6. [Security Testing](#security-testing)
7. [Performance Testing](#performance-testing)
8. [Tools Overview](#tools-overview)
9. [Hands-On Labs](#hands-on-labs)

---

## Why Identity Testing Matters

| Real-World Incident | Root Cause | Could Testing Have Prevented It? |
|---|---|---|
| OAuth token leak via open redirect | Missing redirect URI validation | Yes - integration test |
| Password reset works for any user | Broken authorization check | Yes - unit test |
| Session fixation attack | Session not regenerated after login | Yes - security test |
| Auth service crashes under load | No rate limiting on login endpoint | Yes - load test |
| JWT accepted after user deletion | Token not revoked on user delete | Yes - integration test |

---

## Testing Pyramid for Identity

```
                    /\
                   /  \           E2E Tests
                  / E2E\          Full login flows in browser
                 /------\         (Playwright, Cypress)
                /        \
               / Security \       Security Tests
              /  Testing   \     OWASP, penetration testing
             /--------------\    (ZAP, Burp Suite)
            /                \
           /   Integration    \   Integration Tests
          /     Testing        \  Auth flows, token exchange
         /----------------------\  (Supertest, Postman)
        /                        \
       /      Unit Testing        \  Unit Tests
      /        (Foundation)        \ JWT validation, password hashing
     /------------------------------\(Jest, pytest)
```

---

## Unit Testing Auth Logic

### What to Unit Test

| Component | Test Cases |
|---|---|
| JWT Validation | Valid token, expired, wrong audience, wrong issuer, tampered signature, missing claims, `alg: none` |
| Password Hashing | Hash generation, hash comparison, timing attack resistance |
| Permission Checks | User has permission, user lacks permission, admin bypass, expired roles |
| Token Generation | Correct claims, correct expiry, correct signing algorithm |
| Input Validation | Email format, password strength, SQL injection in username |

### Example: JWT Validation Tests (Jest)

```javascript
describe('JWT Validation', () => {
  test('rejects expired tokens', () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(() => validateToken(token)).toThrow('Token expired');
  });

  test('rejects wrong audience', () => {
    const token = createToken({ aud: 'wrong-audience' });
    expect(() => validateToken(token)).toThrow('Invalid audience');
  });

  test('rejects alg:none attack', () => {
    const token = createTokenWithAlg('none');
    expect(() => validateToken(token)).toThrow('Invalid algorithm');
  });
});
```

---

## Integration Testing Auth Flows

Test complete authentication flows against real (or mock) identity providers:

- Login with valid credentials -> returns tokens
- Login with invalid credentials -> returns 401
- Token refresh -> returns new access token
- Password reset flow -> sends email, accepts new password
- Registration -> creates user, sends verification email
- Logout -> revokes session/tokens

---

## Security Testing

### OWASP Top 10 for Authentication

| # | Vulnerability | Test |
|---|---|---|
| 1 | Broken Authentication | Test credential stuffing, brute force |
| 2 | Session Fixation | Verify session ID changes after login |
| 3 | CSRF | Test state parameter in OAuth flows |
| 4 | Token Leakage | Check tokens not in URLs, logs, referer |
| 5 | Privilege Escalation | Test accessing admin endpoints as user |
| 6 | Injection | SQL injection in login forms |
| 7 | Open Redirect | Test redirect_uri validation |
| 8 | Insecure Token Storage | Verify httpOnly, Secure cookie flags |
| 9 | Missing Rate Limiting | Test login endpoint rate limits |
| 10 | Weak Passwords | Test password policy enforcement |

---

## Tools Overview

| Tool | Purpose | Type |
|---|---|---|
| **Jest** | Unit testing (JavaScript) | Unit |
| **pytest** | Unit testing (Python) | Unit |
| **Supertest** | HTTP integration testing | Integration |
| **Postman/Newman** | API testing and collections | Integration |
| **Playwright** | Browser E2E testing | E2E |
| **Cypress** | Browser E2E testing | E2E |
| **OWASP ZAP** | Security scanning | Security |
| **Burp Suite** | Penetration testing | Security |
| **k6** | Load testing | Performance |
| **Artillery** | Load testing | Performance |

---

## Hands-On Labs

| Lab | Description | Time |
|---|---|---|
| [Lab 01: Unit Testing JWT](./labs/lab-01-unit-testing-jwt.md) | Write unit tests for JWT validation | 2 hrs |
| [Lab 02: Integration Testing](./labs/lab-02-integration-testing-auth-flows.md) | Test complete auth flows | 2 hrs |
| [Lab 03: E2E with Playwright](./labs/lab-03-e2e-testing-playwright.md) | Browser-based auth testing | 2 hrs |
| [Lab 04: Security Testing](./labs/lab-04-security-testing.md) | Test for OWASP auth vulnerabilities | 2 hrs |
| [Lab 05: Load Testing](./labs/lab-05-load-testing-auth.md) | Load test auth endpoints with k6 | 2 hrs |

---

**Next Module**: [06 - API Integration ->](../06-api-integration/)
