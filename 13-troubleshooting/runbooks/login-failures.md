# Runbook: Login Failures

## Decision Tree
```
User cannot log in
├── Gets error page?
│   ├── "Invalid credentials" → Wrong password, check caps lock
│   ├── "Account locked" → Too many failed attempts, wait or admin unlock
│   ├── "Connection error" → Auth0 status, network issues
│   └── "Callback URL mismatch" → Fix Allowed Callback URLs in Auth0
├── Infinite redirect loop?
│   ├── Check session cookies (HttpOnly, SameSite, Secure flags)
│   ├── Check callback URL matches configuration
│   └── Check for third-party cookie blocking
├── Blank page?
│   ├── Check browser console for JavaScript errors
│   ├── Check CORS configuration
│   └── Check Content Security Policy headers
└── Never reaches login page?
    ├── Check Auth0 domain is correct
    ├── Check network connectivity to Auth0
    └── Check DNS resolution
```

## Quick Checks
1. Auth0 status: https://status.auth0.com
2. Check Auth0 Logs for error events
3. Verify application configuration in dashboard
4. Test with incognito/private browsing
