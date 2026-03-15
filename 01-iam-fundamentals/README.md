# Module 01: IAM Fundamentals

## Overview

Identity and Access Management (IAM) is the foundation of modern security. This module covers the core concepts, frameworks, and principles that every identity professional must master before diving into specific tools and protocols.

---

## Table of Contents

1. [What is IAM?](#what-is-iam)
2. [Authentication vs Authorization](#authentication-vs-authorization)
3. [Identity Lifecycle](#identity-lifecycle)
4. [Access Control Models](#access-control-models)
5. [IAM Architecture Patterns](#iam-architecture-patterns)
6. [Identity Protocols Overview](#identity-protocols-overview)
7. [Zero Trust Architecture](#zero-trust-architecture)
8. [IAM Security Principles](#iam-security-principles)
9. [Hands-On Labs](#hands-on-labs)

---

## What is IAM?

**Identity and Access Management (IAM)** is a framework of policies, processes, and technologies that ensures the right individuals have appropriate access to technology resources at the right time and for the right reasons.

### The Three Pillars of IAM

```
┌─────────────────────────────────────────────────────┐
│                   IAM FRAMEWORK                      │
├─────────────────┬──────────────────┬────────────────┤
│   IDENTITY      │   ACCESS         │   GOVERNANCE   │
│                 │                  │                │
│ • Who are you?  │ • What can you   │ • Who approved │
│ • Prove it      │   access?        │   this?        │
│ • User store    │ • Under what     │ • Audit trail  │
│ • Directory     │   conditions?    │ • Compliance   │
│ • Federation    │ • For how long?  │ • Recertify    │
└─────────────────┴──────────────────┴────────────────┘
```

### Why IAM Matters

- **Security**: Prevent unauthorized access and data breaches
- **Compliance**: Meet regulatory requirements (SOC 2, GDPR, HIPAA, PCI-DSS)
- **Productivity**: Enable seamless access to resources
- **Cost Reduction**: Automate provisioning and reduce IT overhead
- **User Experience**: Single Sign-On and self-service capabilities

### IAM in Numbers (Real-World Impact)

| Statistic | Source |
|---|---|
| 80% of data breaches involve compromised credentials | Verizon DBIR |
| $4.45M average cost of a data breach | IBM Cost of Data Breach Report |
| 61% of breaches involve credential data | Verizon DBIR |
| Organizations with mature IAM save 50% on breach costs | Ponemon Institute |

---

## Authentication vs Authorization

These two concepts are the foundation of all IAM systems:

### Authentication (AuthN) — "Who are you?"

Authentication is the process of verifying a user's identity.

**Authentication Factors:**

| Factor | Type | Examples |
|---|---|---|
| Something you **know** | Knowledge | Password, PIN, security questions |
| Something you **have** | Possession | Phone, hardware key, smart card |
| Something you **are** | Inherence | Fingerprint, face scan, iris scan |
| Somewhere you **are** | Location | IP address, GPS, network |
| Something you **do** | Behavior | Typing pattern, gait, mouse movement |

**Multi-Factor Authentication (MFA):** Combining two or more factors for stronger security.

```
Single Factor:    Password only
                  ⚠️ Weakest - easily compromised

Two-Factor (2FA): Password + SMS code
                  ⚡ Better - but SMS can be intercepted

MFA:              Password + Authenticator App + Biometric
                  ✅ Strongest - multiple independent factors
```

### Authorization (AuthZ) — "What can you do?"

Authorization determines what actions an authenticated user is allowed to perform.

```
User "alice@company.com" authenticated ✓

Authorization check:
├── Can read documents?     → ✅ YES (role: employee)
├── Can edit documents?     → ✅ YES (role: editor)
├── Can delete documents?   → ❌ NO  (requires: admin)
├── Can manage users?       → ❌ NO  (requires: admin)
└── Can view billing?       → ❌ NO  (requires: finance)
```

### Key Differences

| Aspect | Authentication | Authorization |
|---|---|---|
| Question | "Who are you?" | "What can you do?" |
| Order | First | Second (after AuthN) |
| Visible to user? | Yes (login form) | Often invisible |
| Changeable by user? | Yes (password change) | No (admin-controlled) |
| Protocols | OIDC, SAML, Kerberos | OAuth 2.0, XACML |
| Data | Credentials, tokens | Permissions, policies |

---

## Identity Lifecycle

The identity lifecycle covers every stage from when a user joins an organization to when they leave:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  CREATE   │───▶│ PROVISION│───▶│  MANAGE   │───▶│  REVIEW  │───▶│ DEPROVISION│
│          │    │          │    │          │    │          │    │           │
│ Onboard  │    │ Grant    │    │ Update   │    │ Certify  │    │ Offboard  │
│ Register │    │ Access   │    │ Roles    │    │ Access   │    │ Revoke    │
│ Verify   │    │ Enroll   │    │ Transfer │    │ Audit    │    │ Archive   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └───────────┘
```

### Stage 1: Identity Creation (Onboarding)
- User registration or HR-initiated account creation
- Identity proofing and verification
- Assigning unique identifiers
- Initial credential setup

### Stage 2: Provisioning
- Granting access to applications and systems
- Role and group assignment
- License allocation
- MFA enrollment

### Stage 3: Identity Management
- Role changes (promotions, transfers)
- Password resets and credential rotation
- Profile updates
- Temporary access grants

### Stage 4: Access Review (Governance)
- Periodic access certifications
- Detecting unused or excessive privileges
- Compliance auditing
- Segregation of duties (SoD) checks

### Stage 5: Deprovisioning (Offboarding)
- Immediate access revocation
- Session termination
- License reclamation
- Data retention per compliance requirements
- Archive vs. delete decisions

---

## Access Control Models

### 1. Role-Based Access Control (RBAC)

The most widely used model. Permissions are assigned to roles, and users are assigned to roles.

```
Users ──▶ Roles ──▶ Permissions ──▶ Resources

Example:
┌─────────┐    ┌──────────┐    ┌─────────────────┐
│  Alice   │───▶│  Editor  │───▶│ read:documents  │
│  Bob     │───▶│  Viewer  │    │ write:documents │
│  Charlie │───▶│  Admin   │    │ delete:documents│
└─────────┘    └──────────┘    │ manage:users    │
                               └─────────────────┘
```

**Pros:** Simple, widely supported, audit-friendly
**Cons:** Role explosion, coarse-grained, static

### 2. Attribute-Based Access Control (ABAC)

Decisions based on attributes of the user, resource, action, and environment.

```
Policy: ALLOW if
  user.department == "engineering" AND
  resource.classification != "top-secret" AND
  action == "read" AND
  environment.time BETWEEN "09:00" AND "18:00" AND
  environment.location == "office-network"
```

**Pros:** Fine-grained, flexible, context-aware
**Cons:** Complex to implement, harder to audit

### 3. Policy-Based Access Control (PBAC)

Centralized policies define access rules, often using standards like XACML.

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User  │────▶│  Policy  │────▶│ Decision │────▶│ Resource │
│Request │     │Enforcement│     │  Point   │     │ (Allow/  │
│        │     │  Point   │     │ (PDP)    │     │  Deny)   │
└────────┘     │ (PEP)    │     └──────────┘     └──────────┘
               └──────────┘          │
                                     ▼
                              ┌──────────┐
                              │  Policy  │
                              │  Store   │
                              └──────────┘
```

**Pros:** Centralized governance, standards-based
**Cons:** Performance overhead, complexity

### 4. Comparison Matrix

| Feature | RBAC | ABAC | PBAC |
|---|---|---|---|
| Complexity | Low | High | Medium |
| Granularity | Coarse | Fine | Fine |
| Scalability | Medium | High | High |
| Context-aware | No | Yes | Yes |
| Audit ease | Easy | Hard | Medium |
| Implementation cost | Low | High | Medium |
| Best for | Most apps | Complex rules | Enterprise |

---

## IAM Architecture Patterns

### Pattern 1: Centralized IAM

All identity services managed by a single platform (e.g., Auth0, Okta).

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│  App A   │ │  App B   │ │  App C   │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     ▼            ▼            ▼
┌─────────────────────────────────────┐
│        Central Identity Provider     │
│     (Auth0 / Okta / Azure AD)       │
│                                     │
│  ┌────────┐ ┌──────┐ ┌──────────┐  │
│  │User    │ │SSO   │ │Directory │  │
│  │Store   │ │Engine│ │Connector │  │
│  └────────┘ └──────┘ └──────────┘  │
└─────────────────────────────────────┘
```

### Pattern 2: Federated Identity

Multiple identity providers connected through trust relationships.

```
┌──────────────┐     ┌──────────────┐
│  Corporate   │     │   Partner    │
│  IdP (SAML)  │     │  IdP (OIDC)  │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────────────┐
│         Service Provider (SP)        │
│     Federation / Trust Broker        │
└─────────────────────────────────────┘
```

### Pattern 3: Microservices Identity

Token-based authentication with API Gateway pattern.

```
Client ──▶ API Gateway ──▶ Auth Service ──▶ Identity Provider
               │
               ├──▶ Service A (validates JWT)
               ├──▶ Service B (validates JWT)
               └──▶ Service C (validates JWT)
```

---

## Identity Protocols Overview

| Protocol | Purpose | Use Case | Token Type |
|---|---|---|---|
| **OAuth 2.0** | Authorization | API access delegation | Access Token |
| **OpenID Connect** | Authentication | User login (web/mobile) | ID Token (JWT) |
| **SAML 2.0** | Authentication + Authorization | Enterprise SSO | XML Assertion |
| **LDAP** | Directory access | User/group lookup | N/A (bind) |
| **Kerberos** | Authentication | Windows/AD environments | Ticket |
| **FIDO2/WebAuthn** | Authentication | Passwordless login | Attestation |
| **SCIM** | User provisioning | Automated user sync | N/A (REST) |

> **Deep Dive**: Module 02 covers OAuth 2.0, OIDC, and SAML in extensive detail with hands-on labs.

---

## Zero Trust Architecture

### Core Principles

**"Never trust, always verify"** — Zero Trust assumes no user or system should be inherently trusted, regardless of location.

```
Traditional (Perimeter-based):
┌───────────────────────────────────┐
│  TRUSTED NETWORK                  │
│  ┌─────┐ ┌─────┐ ┌─────┐        │
│  │App A│ │App B│ │App C│        │
│  └─────┘ └─────┘ └─────┘        │  ← Everything inside is trusted
│                                   │
│  🔥 Firewall (perimeter only)     │
└───────────────────────────────────┘

Zero Trust:
┌──────────────────────────────────────┐
│  NOTHING IS TRUSTED                   │
│  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │App A │  │App B │  │App C │       │
│  │🔒    │  │🔒    │  │🔒    │       │
│  └──┬───┘  └──┬───┘  └──┬───┘       │
│     │         │         │            │
│  ┌──▼─────────▼─────────▼──┐        │
│  │   Policy Decision Point  │        │
│  │  (verify every request)  │        │
│  └──────────────────────────┘        │
└──────────────────────────────────────┘
```

### Zero Trust Pillars (NIST SP 800-207)

1. **Identity Verification**: Strong authentication for every access request
2. **Device Trust**: Verify device health and compliance
3. **Network Segmentation**: Micro-segmentation, no flat networks
4. **Application Security**: Per-application access policies
5. **Data Protection**: Classify and protect data at rest/in transit
6. **Visibility & Analytics**: Log everything, detect anomalies
7. **Automation & Orchestration**: Automate policy enforcement

### Implementation Checklist

- [ ] Implement strong MFA for all users
- [ ] Enforce least-privilege access
- [ ] Segment network into micro-perimeters
- [ ] Encrypt all data in transit (mTLS)
- [ ] Monitor and log all access attempts
- [ ] Implement device trust verification
- [ ] Use short-lived tokens and certificates
- [ ] Automate access reviews
- [ ] Deploy continuous monitoring

---

## IAM Security Principles

### 1. Least Privilege
Grant only the minimum permissions needed to perform a task.

### 2. Separation of Duties (SoD)
No single person should control all aspects of a critical process.

### 3. Defense in Depth
Layer multiple security controls so failure of one doesn't compromise everything.

### 4. Fail Secure
When systems fail, they should deny access rather than grant it.

### 5. Complete Mediation
Every access to every resource must be checked against access control policies.

### 6. Accountability
Every action should be traceable to a specific identity through audit logs.

---

## Hands-On Labs

| Lab | Description | Time |
|---|---|---|
| [Lab 01: RBAC Model Design](./labs/lab-01-rbac-model.md) | Design an RBAC model for a SaaS application | 2 hrs |
| [Lab 02: Identity Lifecycle](./labs/lab-02-identity-lifecycle.md) | Implement provisioning and deprovisioning workflows | 2 hrs |
| [Lab 03: Zero Trust Assessment](./labs/lab-03-zero-trust-assessment.md) | Evaluate an architecture against Zero Trust principles | 2 hrs |

---

## Key Takeaways

1. IAM is not just about passwords — it encompasses the entire identity lifecycle
2. Choose the right access control model (RBAC for most, ABAC for complex scenarios)
3. Zero Trust is the modern standard — verify everything, trust nothing
4. Strong authentication (MFA) prevents 99.9% of account compromise attacks
5. Automation is key — manual provisioning doesn't scale

---

## Further Reading

- [NIST SP 800-63: Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Gartner IAM Best Practices](https://www.gartner.com/en/information-technology/glossary/identity-and-access-management-iam)

---

**Next Module**: [02 - Authentication Protocols →](../02-authentication-protocols/)
