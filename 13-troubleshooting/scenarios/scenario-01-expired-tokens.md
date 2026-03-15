# Debug Scenario: Tokens Expiring Unexpectedly

## Problem
Users report being logged out frequently, API calls failing with 401.

## Investigation
1. Decode a token and check `exp` claim
2. Calculate token lifetime: `exp - iat` (in seconds)
3. Check Auth0 API settings → Token Lifetime
4. Check if refresh token rotation is working

## Root Causes
- Token lifetime too short (default 86400s = 24hrs for access tokens)
- Refresh token not being used for silent renewal
- Clock skew between client and server
- Token cached after user role change (stale permissions)

## Fix
- Adjust token lifetime in Auth0 API settings
- Implement token refresh in frontend
- Add clock tolerance in token validation
