# Module 02: Authentication Protocols Deep Dive

## Overview

This module provides a comprehensive deep dive into the three most important authentication and authorization protocols in modern identity management: **OAuth 2.0**, **OpenID Connect (OIDC)**, and **SAML 2.0**. You'll understand how they work, when to use each, and how to implement them.

---

## Table of Contents

1. [OAuth 2.0](#oauth-20)
2. [OpenID Connect (OIDC)](#openid-connect-oidc)
3. [SAML 2.0](#saml-20)
4. [JWT Deep Dive](#jwt-deep-dive)
5. [Protocol Comparison](#protocol-comparison)
6. [Security Considerations](#security-considerations)
7. [Hands-On Labs](#hands-on-labs)

---

## OAuth 2.0

### What is OAuth 2.0?

OAuth 2.0 is an **authorization** framework (RFC 6749) that enables third-party applications to obtain limited access to a resource on behalf of a user — without sharing the user's credentials.

**Key Insight**: OAuth 2.0 is about **authorization** (what you can access), NOT **authentication** (who you are).

### OAuth 2.0 Roles

| Role | Description | Example |
|---|---|---|
| **Resource Owner** | The user who owns the data | End user |
| **Client** | The application requesting access | Your web/mobile app |
| **Authorization Server** | Issues access tokens | Auth0, Okta, Azure AD |
| **Resource Server** | Hosts protected resources/APIs | Your API server |

### OAuth 2.0 Grant Types

#### 1. Authorization Code Grant (Recommended for web apps)

The most secure grant type for server-side applications.

```
┌──────────┐                              ┌────────────────┐
│          │──(1) Authorization Request──▶│                │
│          │      (redirect to /authorize) │                │
│          │                              │ Authorization  │
│  Client  │◀─(2) Authorization Code─────│ Server         │
│  (Web    │      (redirect back)         │ (Auth0)        │
│   App)   │                              │                │
│          │──(3) Exchange Code + Secret──▶│                │
│          │      POST /oauth/token        │                │
│          │                              │                │
│          │◀─(4) Access Token + Refresh──│                │
│          │      (JSON response)          │                │
└──────────┘                              └────────────────┘
       │
       │──(5) API Request + Access Token──▶┌────────────────┐
       │      Authorization: Bearer xxx     │ Resource Server│
       │◀─(6) Protected Resource──────────│ (Your API)     │
                                           └────────────────┘
```

**Step-by-step:**

```
1. User clicks "Login" → App redirects to Auth Server:

   GET https://auth.example.com/authorize?
     response_type=code
     &client_id=YOUR_CLIENT_ID
     &redirect_uri=https://app.example.com/callback
     &scope=openid profile email
     &state=random_csrf_token

2. User authenticates and consents → Auth Server redirects back:

   GET https://app.example.com/callback?
     code=AUTHORIZATION_CODE
     &state=random_csrf_token

3. App exchanges code for tokens (server-side, confidential):

   POST https://auth.example.com/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=AUTHORIZATION_CODE
   &client_id=YOUR_CLIENT_ID
   &client_secret=YOUR_CLIENT_SECRET
   &redirect_uri=https://app.example.com/callback

4. Auth Server responds with tokens:

   {
     "access_token": "eyJhbGci...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "v1.MjE4...",
     "id_token": "eyJhbGci..."
   }
```

#### 2. Authorization Code + PKCE (Recommended for SPAs & mobile)

Proof Key for Code Exchange adds security for public clients (no client secret).

```
Client generates:
  code_verifier  = random 43-128 char string
  code_challenge = BASE64URL(SHA256(code_verifier))

Step 1: Authorization Request (includes challenge)
  GET /authorize?
    response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https://app.example.com/callback
    &scope=openid profile
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    &code_challenge_method=S256
    &state=random_state

Step 3: Token Exchange (includes verifier)
  POST /oauth/token
    grant_type=authorization_code
    &code=AUTHORIZATION_CODE
    &client_id=YOUR_CLIENT_ID
    &code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
    &redirect_uri=https://app.example.com/callback

Server verifies: SHA256(code_verifier) == code_challenge ✓
```

#### 3. Client Credentials Grant (Machine-to-Machine)

For server-to-server communication where no user is involved.

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=SERVICE_CLIENT_ID
&client_secret=SERVICE_CLIENT_SECRET
&audience=https://api.example.com

Response:
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

#### 4. Device Authorization Grant (Smart TVs, IoT)

For devices with limited input capabilities.

```
Step 1: Device requests authorization
  POST /oauth/device/code
  → Returns: device_code, user_code, verification_uri

Step 2: User goes to verification_uri on their phone
  → Enters user_code → Authenticates → Approves

Step 3: Device polls for token
  POST /oauth/token
  grant_type=urn:ietf:params:oauth:grant-type:device_code
  &device_code=DEVICE_CODE
  &client_id=CLIENT_ID
```

### Grant Type Decision Matrix

| Scenario | Grant Type | Reason |
|---|---|---|
| Server-side web app | Authorization Code | Has secure backend |
| Single Page App (SPA) | Auth Code + PKCE | No client secret |
| Mobile app | Auth Code + PKCE | No client secret |
| Service-to-service | Client Credentials | No user involved |
| Smart TV / IoT | Device Authorization | Limited input |
| CLI tool | Auth Code + PKCE | User present, no secret |

> **Deprecated**: Implicit Grant and Resource Owner Password Grant are no longer recommended.

---

## OpenID Connect (OIDC)

### What is OIDC?

OpenID Connect is an **authentication** layer built on top of OAuth 2.0. While OAuth 2.0 tells you what you can access, OIDC tells you **who you are**.

```
┌───────────────────────────────────────────────┐
│              OpenID Connect (OIDC)             │
│         "Authentication: Who are you?"         │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │            OAuth 2.0                     │  │
│  │     "Authorization: What can you do?"    │  │
│  │                                         │  │
│  │  ┌───────────────────────────────────┐  │  │
│  │  │          HTTP / TLS               │  │  │
│  │  │     "Transport Security"          │  │  │
│  │  └───────────────────────────────────┘  │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

### What OIDC Adds to OAuth 2.0

| Feature | OAuth 2.0 | OIDC |
|---|---|---|
| Access Token | ✅ | ✅ |
| **ID Token** | ❌ | ✅ |
| **UserInfo Endpoint** | ❌ | ✅ |
| **Discovery Document** | ❌ | ✅ |
| **Standard Scopes** | ❌ | ✅ (openid, profile, email) |
| **Standard Claims** | ❌ | ✅ (sub, name, email, etc.) |

### The ID Token

The ID Token is a JWT containing claims about the authenticated user.

```json
// Header
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "NjVBRjY5MDlCMUIwNzU4RTA2QzZFRTRCQjI2MkZFQjI"
}

// Payload (Claims)
{
  "iss": "https://your-tenant.auth0.com/",
  "sub": "auth0|507f1f77bcf86cd799439011",
  "aud": "YOUR_CLIENT_ID",
  "exp": 1311281970,
  "iat": 1311280970,
  "nonce": "a1b2c3d4e5",
  "at_hash": "HK6E_P6Dh8Y93mRNtsDB1Q",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "email_verified": true,
  "picture": "https://example.com/jane.jpg",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### OIDC Standard Scopes and Claims

| Scope | Claims Returned |
|---|---|
| `openid` | `sub` (required) |
| `profile` | `name`, `family_name`, `given_name`, `middle_name`, `nickname`, `picture`, `updated_at` |
| `email` | `email`, `email_verified` |
| `address` | `address` (JSON object) |
| `phone` | `phone_number`, `phone_number_verified` |

### OIDC Discovery Document

Every OIDC provider publishes a discovery document at `/.well-known/openid-configuration`:

```bash
curl https://your-tenant.auth0.com/.well-known/openid-configuration | jq .
```

```json
{
  "issuer": "https://your-tenant.auth0.com/",
  "authorization_endpoint": "https://your-tenant.auth0.com/authorize",
  "token_endpoint": "https://your-tenant.auth0.com/oauth/token",
  "userinfo_endpoint": "https://your-tenant.auth0.com/userinfo",
  "jwks_uri": "https://your-tenant.auth0.com/.well-known/jwks.json",
  "scopes_supported": ["openid", "profile", "email", "address", "phone"],
  "response_types_supported": ["code", "token", "id_token", "code token", "code id_token"],
  "grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "subject_types_supported": ["public"]
}
```

### OIDC Authentication Flow

```
┌────────┐     ┌────────────┐     ┌──────────────┐     ┌─────────────┐
│ User   │     │ Client App │     │ Auth Server  │     │ UserInfo    │
│        │     │ (RP)       │     │ (OP/IdP)     │     │ Endpoint    │
└───┬────┘     └─────┬──────┘     └──────┬───────┘     └──────┬──────┘
    │                │                   │                    │
    │─(1) Click ────▶│                   │                    │
    │    Login       │                   │                    │
    │                │─(2) /authorize───▶│                    │
    │                │  scope=openid     │                    │
    │                │                   │                    │
    │◀───────────────────(3) Login ──────│                    │
    │                      Page          │                    │
    │                                    │                    │
    │──(4) Credentials ────────────────▶│                    │
    │                                    │                    │
    │                │◀─(5) Auth Code ───│                    │
    │                │   (redirect)      │                    │
    │                │                   │                    │
    │                │──(6) Exchange ───▶│                    │
    │                │   Code for        │                    │
    │                │   Tokens          │                    │
    │                │                   │                    │
    │                │◀─(7) ID Token ────│                    │
    │                │   + Access Token  │                    │
    │                │                   │                    │
    │                │──(8) GET /userinfo─────────────────────▶│
    │                │   Bearer {token}  │                    │
    │                │                   │                    │
    │                │◀─(9) User Claims──────────────────────│
    │                │                   │                    │
    │◀─(10) Logged ──│                   │                    │
    │      In        │                   │                    │
```

---

## SAML 2.0

### What is SAML?

Security Assertion Markup Language (SAML) 2.0 is an XML-based open standard for exchanging authentication and authorization data between an **Identity Provider (IdP)** and a **Service Provider (SP)**.

### SAML Terminology

| Term | Description | OIDC Equivalent |
|---|---|---|
| **Identity Provider (IdP)** | Authenticates the user | OpenID Provider (OP) |
| **Service Provider (SP)** | The application | Relying Party (RP) |
| **Assertion** | XML document with user claims | ID Token (JWT) |
| **Binding** | Transport method (HTTP-POST, HTTP-Redirect) | Response type |
| **Metadata** | XML describing IdP/SP configuration | Discovery document |
| **NameID** | User identifier in assertion | `sub` claim |
| **Attribute Statement** | User attributes in assertion | Claims in ID token |

### SAML SP-Initiated Flow (Most Common)

```
┌────────┐     ┌────────────────┐     ┌──────────────────┐
│ User   │     │ Service        │     │ Identity         │
│        │     │ Provider (SP)  │     │ Provider (IdP)   │
│        │     │ (Your App)     │     │ (Auth0/ADFS)     │
└───┬────┘     └────────┬───────┘     └────────┬─────────┘
    │                   │                      │
    │──(1) Access ─────▶│                      │
    │    app.example.com│                      │
    │                   │                      │
    │                   │──(2) SAML AuthnReq──▶│
    │                   │   (HTTP-Redirect     │
    │◀──────────────────│    or HTTP-POST)     │
    │    Redirect to IdP│                      │
    │                   │                      │
    │──(3) Login at IdP─────────────────────── ▶│
    │                   │                      │
    │                   │                      │──(4) Authenticate
    │                   │                      │       User
    │                   │                      │
    │◀──(5) SAML Response (HTTP-POST)──────────│
    │   Contains signed Assertion              │
    │   with user attributes                   │
    │                   │                      │
    │──(6) POST to SP ─▶│                      │
    │   ACS URL with    │                      │
    │   SAML Response   │                      │
    │                   │                      │
    │                   │──(7) Validate        │
    │                   │   Signature          │
    │                   │   Parse Assertion    │
    │                   │   Create Session     │
    │                   │                      │
    │◀─(8) Logged In ──│                      │
    │   Session cookie  │                      │
```

### SAML Assertion Structure

```xml
<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="_abc123" Version="2.0"
                IssueInstant="2024-01-15T10:30:00Z">

  <!-- Who issued this assertion -->
  <saml:Issuer>https://idp.example.com</saml:Issuer>

  <!-- Digital signature -->
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <!-- Certificate and signature value -->
  </ds:Signature>

  <!-- Conditions (validity, audience) -->
  <saml:Conditions NotBefore="2024-01-15T10:30:00Z"
                   NotOnOrAfter="2024-01-15T10:35:00Z">
    <saml:AudienceRestriction>
      <saml:Audience>https://app.example.com</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>

  <!-- Authentication statement -->
  <saml:AuthnStatement AuthnInstant="2024-01-15T10:30:00Z"
                       SessionIndex="_session_xyz">
    <saml:AuthnContext>
      <saml:AuthnContextClassRef>
        urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
      </saml:AuthnContextClassRef>
    </saml:AuthnContext>
  </saml:AuthnStatement>

  <!-- User attributes -->
  <saml:AttributeStatement>
    <saml:Attribute Name="email">
      <saml:AttributeValue>jane@example.com</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="firstName">
      <saml:AttributeValue>Jane</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="role">
      <saml:AttributeValue>admin</saml:AttributeValue>
    </saml:Attribute>
  </saml:AttributeStatement>

</saml:Assertion>
```

---

## JWT Deep Dive

### JWT Structure

A JSON Web Token consists of three Base64URL-encoded parts separated by dots:

```
Header.Payload.Signature

eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIn0.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### JWT Signing Algorithms

| Algorithm | Type | Key | Use Case |
|---|---|---|---|
| **HS256** | Symmetric | Shared secret | Internal, trusted services |
| **RS256** | Asymmetric | RSA public/private | Most common, recommended |
| **ES256** | Asymmetric | ECDSA | Smaller tokens, modern |
| **PS256** | Asymmetric | RSA-PSS | Enhanced RSA security |

### Token Validation Checklist

When validating a JWT, always verify:

```
1. ✅ Signature     — Verify using issuer's public key (JWKS)
2. ✅ Expiration    — `exp` claim > current time
3. ✅ Not Before    — `nbf` claim <= current time (if present)
4. ✅ Issuer        — `iss` claim matches expected issuer
5. ✅ Audience      — `aud` claim matches your client/API
6. ✅ Algorithm     — `alg` matches expected (never accept "none")
7. ✅ Token Type    — Verify it's an access_token, not id_token for API
```

### Access Token vs ID Token vs Refresh Token

| Property | Access Token | ID Token | Refresh Token |
|---|---|---|---|
| Purpose | Authorize API access | Identify the user | Get new tokens |
| Audience | API (resource server) | Client app | Auth server |
| Format | JWT or opaque | JWT | Opaque string |
| Lifetime | Short (15 min - 1 hr) | Short (1 hr) | Long (days-months) |
| Send to API? | ✅ Yes | ❌ Never | ❌ Never |
| Contains user info? | Maybe (scopes) | ✅ Yes (claims) | ❌ No |
| Stored where? | Memory (SPA) | Memory (SPA) | Secure cookie / backend |

---

## Protocol Comparison

### When to Use Which Protocol

| Criteria | OAuth 2.0 | OIDC | SAML 2.0 |
|---|---|---|---|
| **Primary purpose** | Authorization | Authentication | Authentication + AuthZ |
| **Token format** | JWT or opaque | JWT | XML |
| **Best for** | API access | Modern web/mobile login | Enterprise SSO |
| **Complexity** | Medium | Medium | High |
| **Mobile friendly** | ✅ Yes | ✅ Yes | ⚠️ Difficult |
| **SPA friendly** | ✅ Yes | ✅ Yes | ❌ No |
| **Enterprise adoption** | High | Growing | Very High (legacy) |
| **Standards body** | IETF (RFC 6749) | OpenID Foundation | OASIS |

### Decision Tree

```
Need to authenticate users for a web/mobile app?
├── Modern app (SPA, mobile, microservices)?
│   └── Use OIDC (with OAuth 2.0 for API access)
├── Enterprise SSO with existing SAML IdP?
│   └── Use SAML 2.0
├── Just need API authorization (no user login)?
│   └── Use OAuth 2.0 Client Credentials
└── Machine-to-machine communication?
    └── Use OAuth 2.0 Client Credentials
```

---

## Security Considerations

### Common Vulnerabilities

| Vulnerability | Protocol | Mitigation |
|---|---|---|
| **CSRF attacks** | OAuth 2.0 | Use `state` parameter |
| **Authorization code interception** | OAuth 2.0 | Use PKCE |
| **Token leakage via referer** | OAuth 2.0 | Use POST for token exchange |
| **ID token replay** | OIDC | Validate `nonce` parameter |
| **JWT algorithm confusion** | OIDC | Whitelist allowed algorithms |
| **XML Signature wrapping** | SAML | Use canonical XML, validate carefully |
| **SAML replay attacks** | SAML | Check `NotOnOrAfter`, use `InResponseTo` |
| **Token storage in browser** | All | Use memory or httpOnly cookies |
| **Open redirect** | All | Validate redirect URIs strictly |

### Best Practices

1. **Always use HTTPS** — Never send tokens over HTTP
2. **Use PKCE for public clients** — SPAs and mobile apps
3. **Short-lived access tokens** — 15 minutes maximum
4. **Rotate refresh tokens** — One-time use with rotation
5. **Validate everything** — Every claim, every signature
6. **Use `state` parameter** — Prevent CSRF in OAuth flows
7. **Use `nonce` parameter** — Prevent replay in OIDC
8. **Never expose client secrets** — Only in server-side code
9. **Use RS256 over HS256** — Asymmetric is more secure
10. **Keep JWKS cached but fresh** — Cache with TTL

---

## Hands-On Labs

| Lab | Description | Time |
|---|---|---|
| [Lab 01: OAuth 2.0 Flows](./labs/lab-01-oauth2-flows.md) | Implement all OAuth 2.0 grant types | 3 hrs |
| [Lab 02: OIDC Implementation](./labs/lab-02-oidc-implementation.md) | Build OIDC authentication with a real provider | 2 hrs |
| [Lab 03: SAML Setup](./labs/lab-03-saml-setup.md) | Configure SAML between an IdP and SP | 3 hrs |
| [Lab 04: JWT Deep Dive](./labs/lab-04-jwt-deep-dive.md) | Create, sign, validate, and debug JWTs | 2 hrs |

---

## Further Reading

- [RFC 6749 - OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7519 - JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [OpenID Connect Core Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [SAML 2.0 Technical Overview](http://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

**Next Module**: [03 - Auth0 Fundamentals →](../03-auth0-fundamentals/)
