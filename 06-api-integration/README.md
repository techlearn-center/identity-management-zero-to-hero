# Module 06: API Integration with Auth0

## Overview

This module covers securing backend APIs with Auth0 JWT validation. You'll build both an Express.js and FastAPI backend, implement middleware for token validation, and set up role-based API authorization.

---

## Key Concepts

### API Authorization Flow

```
Client App          API Gateway/Server          Auth0
    |                      |                      |
    |---(1) Login -------->|                      |
    |                      |---(2) Auth Request-->|
    |                      |<--(3) Tokens --------|
    |<--(4) Access Token---|                      |
    |                      |                      |
    |---(5) API Call ----->|                      |
    |   + Bearer Token     |                      |
    |                      |---(6) Validate JWT   |
    |                      |   (check signature,  |
    |                      |    expiry, audience,  |
    |                      |    permissions)       |
    |                      |                      |
    |<--(7) API Response---|                      |
```

### Token Validation Steps

1. Extract Bearer token from Authorization header
2. Decode JWT header to get `kid` (key ID)
3. Fetch signing key from Auth0 JWKS endpoint
4. Verify signature using the public key
5. Validate claims: `iss`, `aud`, `exp`, `iat`
6. Check required scopes/permissions
7. Allow or deny the request

---

## Express.js Integration

See the complete Express app in [express-app/](./express-app/).

### Key Components
- **server.js** - Express server with Auth0 middleware
- **middleware/auth.js** - JWT validation middleware
- **middleware/rbac.js** - Permission checking middleware
- **routes/api.js** - Protected API routes

## FastAPI Integration

See the complete FastAPI app in [fastapi-app/](./fastapi-app/).

### Key Components
- **main.py** - FastAPI app with Auth0 validation
- **auth/dependencies.py** - JWT validation dependencies
- **auth/permissions.py** - Permission decorators
- **routes/api.py** - Protected routes

---

## Hands-On Labs

| Lab | Description | Time |
|---|---|---|
| [Lab 01: Express + Auth0](./labs/lab-01-express-auth0.md) | Build Express API with Auth0 | 2.5 hrs |
| [Lab 02: FastAPI + Auth0](./labs/lab-02-fastapi-auth0.md) | Build FastAPI with Auth0 | 2.5 hrs |
| [Lab 03: M2M Authentication](./labs/lab-03-m2m-authentication.md) | Service-to-service auth | 2 hrs |

---

**Next Module**: [07 - React Frontend ->](../07-react-frontend/)
