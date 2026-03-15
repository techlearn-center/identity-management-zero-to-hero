# Lab 03: Calling Protected APIs

## Objective
Call your backend API with Auth0 access tokens from the React frontend.

## Steps
1. Configure `audience` in Auth0Provider to get access tokens
2. Use `getAccessTokenSilently()` to get tokens
3. Attach token to API requests via axios interceptor
4. Handle 401 errors (token expired) with silent refresh

## Validation
- [ ] Access token is obtained silently after login
- [ ] API calls include Bearer token in Authorization header
- [ ] Protected API endpoints return data
- [ ] 401 errors trigger token refresh
