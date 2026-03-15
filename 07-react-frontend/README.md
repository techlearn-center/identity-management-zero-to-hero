# Module 07: React Frontend with Auth0

## Overview
Build a React SPA with Auth0 authentication, protected routes, role-based UI, and secure API calls.

## Key Concepts

### Auth0 React SDK
The `@auth0/auth0-react` SDK provides React hooks and components:
- `Auth0Provider` - Wraps your app with Auth0 context
- `useAuth0()` - Hook for login, logout, user data, tokens
- `withAuthenticationRequired()` - HOC for protected routes

### Architecture
```
React App
  -> Auth0Provider (wraps entire app)
    -> Router
      -> Public Routes (accessible to all)
      -> Protected Routes (require auth)
        -> RoleGuard (check user roles)
          -> API calls with access token
```

## Hands-On Labs
| Lab | Description |
|---|---|
| [Lab 01: Setup](./labs/lab-01-react-auth0-setup.md) | React + Auth0 from scratch |
| [Lab 02: Protected Routes](./labs/lab-02-protected-routes.md) | Route protection and role-based nav |
| [Lab 03: API Calls](./labs/lab-03-api-calls.md) | Calling protected APIs with tokens |

**Next Module**: [08 - PostgreSQL Identity ->](../08-postgresql-identity/)
