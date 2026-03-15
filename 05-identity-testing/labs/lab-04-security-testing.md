# Lab 04: Security Testing for Authentication

## Objective
Test your authentication implementation against common security vulnerabilities from the OWASP Top 10.

## Tests to Perform

### 1. Brute Force Protection
```bash
# Attempt 20 rapid logins with wrong password
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong'$i'"}'
  echo ""
done
# After ~10 attempts, should return 429 (rate limited)
```

### 2. SQL Injection in Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com' OR 1=1--","password":"anything"}'
# Should return 401, NOT 200
```

### 3. Token in URL (Leakage)
- Check that tokens are never passed as URL query parameters
- Verify no tokens appear in server logs
- Check Referer headers don't leak tokens

### 4. CORS Configuration
```bash
curl -s -H "Origin: https://evil.com" \
  http://localhost:3000/api/users/me \
  -D - | grep -i "access-control"
# Should NOT include Access-Control-Allow-Origin: https://evil.com
```

### 5. Cookie Security Flags
```bash
curl -s -D - http://localhost:3000/login 2>&1 | grep -i "set-cookie"
# Should include: HttpOnly; Secure; SameSite=Lax (or Strict)
```

### 6. Open Redirect
```bash
curl -s -o /dev/null -w "%{redirect_url}" \
  "http://localhost:3000/login?redirect=https://evil.com"
# Should NOT redirect to evil.com
```

## Validation Checklist
- [ ] Brute force protection triggers after max attempts
- [ ] SQL injection in login form is blocked
- [ ] Tokens never appear in URLs or logs
- [ ] CORS restricts to allowed origins only
- [ ] Cookies have HttpOnly, Secure, SameSite flags
- [ ] Open redirects are prevented
