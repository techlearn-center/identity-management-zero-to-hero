# Runbook: Identity Security Incident Response

## Severity Classification
- **P1 Critical**: Active credential compromise, data breach
- **P2 High**: Suspected unauthorized access, anomalous activity
- **P3 Medium**: Failed attack detected, vulnerability discovered

## Immediate Actions (P1)

### 1. Contain (First 15 minutes)
- [ ] Rotate all compromised credentials
- [ ] Revoke all sessions for affected users
- [ ] Block suspicious IP addresses
- [ ] Enable enhanced logging

### 2. Assess (First hour)
- [ ] Identify scope of compromise
- [ ] Check Auth0 logs for unauthorized access
- [ ] Review audit logs for data access
- [ ] Identify attack vector

### 3. Remediate
- [ ] Force password reset for affected users
- [ ] Revoke and rotate API keys/secrets
- [ ] Patch vulnerabilities
- [ ] Enable MFA if not already required

### 4. Recover
- [ ] Restore from known-good state if needed
- [ ] Monitor for recurring attacks
- [ ] Update detection rules

### 5. Post-Incident
- [ ] Write incident report
- [ ] Update runbooks based on lessons learned
- [ ] Implement preventive measures
