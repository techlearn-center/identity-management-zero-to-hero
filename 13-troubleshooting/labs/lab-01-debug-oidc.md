# Lab 01: Debug a Broken OIDC Flow

## Objective
Given a broken OIDC authentication setup, identify and fix the issues.

## Broken Setup (Intentional Bugs)
1. Wrong `issuer` in token validation
2. Missing `audience` parameter in auth request
3. State parameter not being validated
4. Redirect URI mismatch

## Steps
1. Attempt to log in and observe the errors
2. Check browser DevTools for redirect URLs and errors
3. Decode the token and check claims
4. Compare configuration with Auth0 dashboard
5. Fix each issue one at a time
6. Verify the complete flow works
