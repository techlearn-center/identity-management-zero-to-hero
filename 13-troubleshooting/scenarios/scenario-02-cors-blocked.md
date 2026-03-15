# Debug Scenario: CORS Blocking Authentication

## Problem
Browser console shows CORS errors when trying to authenticate or call APIs.

## Common Errors
```
Access to fetch at 'https://your-api.com' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

## Investigation
1. Check browser DevTools → Network → failed request → Response Headers
2. Check API CORS configuration
3. Check Auth0 Application → Allowed Web Origins

## Fixes
- Add your frontend URL to API's CORS allowed origins
- Add your frontend URL to Auth0 → Application → Allowed Web Origins
- Ensure preflight (OPTIONS) requests are handled
- Don't use wildcard (*) with credentials
