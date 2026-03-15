# Lab 01: React + Auth0 Setup

## Objective
Set up a React application with Auth0 authentication from scratch.

## Steps
1. Create React app: `npm create vite@latest identity-frontend -- --template react-ts`
2. Install Auth0: `npm install @auth0/auth0-react react-router-dom`
3. Create Auth0 SPA application in dashboard
4. Wrap app with `Auth0Provider`
5. Add login/logout buttons using `useAuth0()` hook
6. Test login flow

## Validation
- [ ] Auth0Provider configured with correct domain/clientId
- [ ] Login redirects to Auth0 Universal Login
- [ ] After login, user info is accessible via useAuth0()
- [ ] Logout clears session and redirects back
