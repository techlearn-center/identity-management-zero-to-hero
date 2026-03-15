# Lab 03: Zero Trust Architecture Assessment

## Objective

Evaluate an existing application architecture against Zero Trust principles, identify gaps, and design a remediation plan to move from a perimeter-based security model to Zero Trust.

---

## Prerequisites

- Understanding of Zero Trust principles from Module 01 README
- Familiarity with network and application architecture concepts

---

## Scenario

You're assessing **ProjectHub's** existing architecture, which currently uses a traditional perimeter-based security model:

```
CURRENT ARCHITECTURE (Perimeter-Based)
┌─────────────────────────────────────────────────────────┐
│                    CORPORATE NETWORK                     │
│                                                         │
│   ┌─────────┐    ┌─────────┐    ┌──────────────┐       │
│   │ Web App │    │ API     │    │ Database     │       │
│   │ (React) │───▶│ Server  │───▶│ (PostgreSQL) │       │
│   └─────────┘    └─────────┘    └──────────────┘       │
│        │              │                                  │
│        │         ┌────┴────┐                             │
│        │         │ Shared  │                             │
│        └────────▶│ File    │                             │
│                  │ Server  │                             │
│                  └─────────┘                             │
│                                                         │
│   🔥 Single Firewall at perimeter                       │
│   🔑 VPN for remote access                              │
│   📋 Network-based access control only                  │
│   🍪 Long-lived session cookies (24hr)                  │
│   🔐 Shared database credentials                        │
│   📡 HTTP between internal services                     │
└─────────────────────────────────────────────────────────┘
```

---

## Part 1: Zero Trust Maturity Assessment

### Step 1: Score Each Pillar

Evaluate the current architecture against each Zero Trust pillar. Score 1-5:

| Pillar | Current Score | Evidence | Target Score |
|---|---|---|---|
| **1. Identity** | 2/5 | Password-only auth, no MFA, long sessions | 5/5 |
| **2. Devices** | 1/5 | No device validation, any device on VPN | 4/5 |
| **3. Network** | 2/5 | Perimeter firewall only, flat internal network | 4/5 |
| **4. Application** | 2/5 | No per-app auth, trusts network location | 5/5 |
| **5. Data** | 1/5 | No classification, shared DB creds | 4/5 |
| **6. Visibility** | 1/5 | Basic firewall logs only | 4/5 |
| **7. Automation** | 1/5 | Manual provisioning, no automated response | 4/5 |

**Overall Maturity: 10/35 (29%) — Traditional/Initial**

### Step 2: Identify Critical Gaps

Document the most critical gaps:

```markdown
## Critical Gaps

### GAP-001: No Multi-Factor Authentication
- Risk: HIGH
- Impact: Account takeover via compromised passwords
- Current: Password-only authentication
- Target: MFA required for all users (TOTP + WebAuthn)

### GAP-002: Flat Internal Network
- Risk: HIGH
- Impact: Lateral movement after initial compromise
- Current: All services on same network segment
- Target: Micro-segmented network with service mesh

### GAP-003: No Service-to-Service Authentication
- Risk: HIGH
- Impact: Any compromised service can access database
- Current: Shared DB credentials, HTTP between services
- Target: mTLS between services, per-service DB credentials

### GAP-004: No Device Trust Verification
- Risk: MEDIUM
- Impact: Unmanaged/compromised devices accessing resources
- Current: VPN access = trusted device
- Target: Device health checks before granting access

### GAP-005: Long-Lived Sessions
- Risk: MEDIUM
- Impact: Session hijacking window of 24 hours
- Current: 24-hour session cookies
- Target: Short-lived tokens (15min) with refresh rotation

### GAP-006: No Centralized Logging
- Risk: MEDIUM
- Impact: Cannot detect or investigate security incidents
- Current: Basic firewall logs
- Target: Centralized SIEM with auth event correlation

### GAP-007: Shared Database Credentials
- Risk: HIGH
- Impact: All services have full DB access
- Current: Single shared connection string
- Target: Per-service credentials with least privilege
```

---

## Part 2: Design the Zero Trust Architecture

### Step 3: Design the Target Architecture

```
TARGET ARCHITECTURE (Zero Trust)
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ┌──────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │ Client   │────▶│ API Gateway  │────▶│ Auth Service │       │
│   │ (React)  │     │ (JWT Valid.) │     │ (Auth0)      │       │
│   └──────────┘     └──────┬───────┘     └──────────────┘       │
│                           │                                      │
│                    ┌──────┴──────┐                               │
│                    │ Service Mesh│ (mTLS / Istio)                │
│                    │             │                               │
│              ┌─────┴────┐  ┌────┴─────┐  ┌─────────────┐       │
│              │ API Svc  │  │ Worker   │  │ File Svc    │       │
│              │ 🔒 mTLS  │  │ 🔒 mTLS │  │ 🔒 mTLS    │       │
│              └─────┬────┘  └────┬─────┘  └──────┬──────┘       │
│                    │            │               │               │
│              ┌─────┴────┐  ┌───┴───────┐  ┌────┴──────┐       │
│              │ DB       │  │ Cache     │  │ Object    │       │
│              │ (RLS)    │  │ (Redis)   │  │ Storage   │       │
│              │ 🔐 unique│  │ 🔐 unique │  │ 🔐 signed │       │
│              │ creds    │  │ creds     │  │ URLs      │       │
│              └──────────┘  └───────────┘  └───────────┘       │
│                                                                  │
│   ✅ MFA for all users          ✅ mTLS between services        │
│   ✅ Short-lived tokens (15m)   ✅ Per-service credentials      │
│   ✅ Device trust checks        ✅ Centralized logging (SIEM)   │
│   ✅ Network micro-segmentation ✅ Automated incident response  │
│   ✅ Row-Level Security on DB   ✅ Continuous verification      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Create the Remediation Plan

### Step 4: Prioritized Implementation Roadmap

#### Phase 1: Quick Wins (Weeks 1-4)

| # | Action | Gap | Effort |
|---|---|---|---|
| 1 | Enable MFA for all users via Auth0 | GAP-001 | Low |
| 2 | Reduce session lifetime to 1hr, token to 15min | GAP-005 | Low |
| 3 | Enable Auth0 anomaly detection | GAP-006 | Low |
| 4 | Rotate and separate DB credentials per service | GAP-007 | Medium |
| 5 | Enable HTTPS between all internal services | GAP-003 | Medium |

#### Phase 2: Foundation (Weeks 5-12)

| # | Action | Gap | Effort |
|---|---|---|---|
| 6 | Deploy centralized logging (ELK/CloudWatch) | GAP-006 | Medium |
| 7 | Implement API Gateway with JWT validation | GAP-004 | Medium |
| 8 | Add per-service IAM roles (least privilege) | GAP-007 | Medium |
| 9 | Implement network segmentation (VPC subnets) | GAP-002 | High |
| 10 | Deploy Row-Level Security on PostgreSQL | GAP-007 | Medium |

#### Phase 3: Advanced (Weeks 13-20)

| # | Action | Gap | Effort |
|---|---|---|---|
| 11 | Deploy service mesh (Istio) with mTLS | GAP-003 | High |
| 12 | Implement device trust (MDM integration) | GAP-004 | High |
| 13 | Set up automated access reviews | GAP-006 | Medium |
| 14 | Implement automated incident response | GAP-006 | High |
| 15 | Continuous compliance monitoring | GAP-006 | Medium |

### Step 5: Define Success Metrics

| Metric | Current | Target | How to Measure |
|---|---|---|---|
| MFA adoption | 0% | 100% | Auth0 dashboard |
| Mean session duration | 24 hrs | 15 min (token) | Token config |
| Services with unique creds | 0/4 | 4/4 | Credential audit |
| Internal TLS coverage | 0% | 100% | Service mesh metrics |
| Mean time to detect (MTTD) | Unknown | < 1 hour | SIEM alerts |
| Access review completion | None | 100% quarterly | Review system |

---

## Part 4: Implementation Verification

### Step 6: Verification Tests

For each remediation action, define a verification test:

```bash
# Test 1: MFA is enforced
# Attempt login without MFA - should be blocked
curl -X POST https://your-app.auth0.com/oauth/token \
  -d '{"username":"test@example.com","password":"test123","grant_type":"password"}' \
  # Expected: Error requiring MFA challenge

# Test 2: Short-lived tokens
# Decode JWT and verify expiry
echo $ACCESS_TOKEN | cut -d. -f2 | base64 -d | jq '.exp - .iat'
# Expected: 900 (15 minutes)

# Test 3: Service credentials are unique
# Each service should have its own DB connection
psql -c "SELECT usename, application_name FROM pg_stat_activity WHERE datname='projecthub';"
# Expected: Different usernames for each service

# Test 4: Internal TLS
# Verify services communicate over TLS
openssl s_client -connect api-service:443 -servername api-service
# Expected: Valid certificate chain

# Test 5: Network segmentation
# Database should not be reachable from web tier
nc -zv database-host 5432  # From web server
# Expected: Connection refused
```

---

## Validation Checklist

- [ ] Completed maturity assessment with scores for all 7 pillars
- [ ] Identified and documented all critical gaps with risk ratings
- [ ] Designed target Zero Trust architecture diagram
- [ ] Created phased remediation plan with priorities
- [ ] Defined measurable success metrics
- [ ] Created verification tests for each remediation

---

## Deliverables

After completing this lab, you should have:

1. **Zero Trust Maturity Assessment** — Scored evaluation of current state
2. **Gap Analysis Document** — Detailed gaps with risk ratings
3. **Target Architecture Diagram** — Zero Trust design
4. **Remediation Roadmap** — Phased plan with timelines
5. **Verification Plan** — Tests to validate each improvement

---

**Next Module**: [02 - Authentication Protocols →](../../02-authentication-protocols/)
