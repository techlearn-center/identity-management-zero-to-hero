# Runbook: SSO Not Working

## Symptoms
- Users must log in separately for each application
- SSO session not shared between apps

## Diagnostic Steps

### 1. Check SSO Configuration
- All apps must be on the same Auth0 tenant
- All apps must use the same Auth0 domain
- Universal Login must be used (not embedded login)

### 2. Check Cookie Domain
- SSO cookies are set on the Auth0 domain
- Custom domains must be configured correctly
- Third-party cookie restrictions may block SSO

### 3. Check Session Lifetime
- Auth0 session may have expired
- Dashboard → Settings → Session lifetime
- Recommended: 24 hours for SSO

### 4. Test SSO Flow
1. Log in to App A
2. Navigate to App B
3. App B should automatically log in (silent auth)
4. If prompted to log in again → SSO is not working
