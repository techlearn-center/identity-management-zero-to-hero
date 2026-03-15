# Runbook: JWT Token Validation Failure

## Symptoms
- API returns 401 Unauthorized
- Error: "Invalid token", "jwt expired", "invalid signature"

## Diagnostic Steps

### 1. Decode the token
```bash
# Paste your JWT at jwt.io or use CLI tool
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

### 2. Check expiration
```bash
# Compare exp claim with current time
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq '.exp'
date +%s  # Current Unix timestamp
```

### 3. Verify issuer matches
- Token `iss` must match `https://YOUR_DOMAIN.auth0.com/`
- Check for trailing slash mismatch

### 4. Verify audience matches
- Token `aud` must match your API identifier exactly
- Check for https:// prefix differences

### 5. Check signing key
```bash
# Fetch JWKS and compare kid
curl -s https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json | jq '.keys[].kid'
echo $TOKEN | cut -d. -f1 | base64 -d 2>/dev/null | jq '.kid'
```

## Common Fixes
| Issue | Fix |
|---|---|
| Token expired | Refresh the token or increase token lifetime |
| Wrong audience | Match API identifier in Auth0 dashboard |
| Wrong issuer | Match Auth0 domain in your config |
| Key not found | JWKS cache may be stale — restart service |
| alg mismatch | Ensure RS256 is configured on both sides |
