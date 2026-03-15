# Module 03: Auth0 Fundamentals

## Overview

This module introduces Auth0, one of the most widely adopted Identity-as-a-Service (IDaaS) platforms. You will learn how Auth0 abstracts the complexity of authentication and authorization, how its architecture works, and how to configure a production-ready tenant from scratch.

By the end of this module you will be able to stand up a fully configured Auth0 environment, integrate it with multiple application types, and manage it programmatically through the Management API and CLI.

---

## Table of Contents

1. [What Is Auth0 and Why It Matters](#what-is-auth0-and-why-it-matters)
2. [Auth0 Architecture](#auth0-architecture)
3. [Setting Up an Auth0 Tenant](#setting-up-an-auth0-tenant)
4. [Application Types](#application-types)
5. [Connections](#connections)
6. [Universal Login](#universal-login)
7. [Auth0 Dashboard Walkthrough](#auth0-dashboard-walkthrough)
8. [Auth0 Management API](#auth0-management-api)
9. [Auth0 CLI Setup](#auth0-cli-setup)
10. [Key Concepts Summary](#key-concepts-summary)

---

## What Is Auth0 and Why It Matters

Auth0 (now part of Okta) is an identity platform that provides authentication and authorization as a service. Instead of building login pages, token management, MFA, social login, and enterprise federation from scratch, Auth0 gives you a battle-tested, standards-compliant identity layer you can integrate in minutes.

### Why Auth0 Over DIY

| Concern | DIY | Auth0 |
|---|---|---|
| **Time to market** | Weeks to months | Hours to days |
| **Security patches** | Your responsibility | Managed by Auth0 |
| **Standards compliance** | Manual implementation of OAuth 2.0, OIDC, SAML | Built-in, certified |
| **Scalability** | Architect yourself | Millions of logins/month out of the box |
| **Social login** | Integrate each provider separately | Toggle on in dashboard |
| **MFA** | Build or integrate third-party | One-click enable |
| **Compliance** | SOC 2, HIPAA, GDPR manual work | Auth0 is SOC 2 Type II, HIPAA BAA-ready |
| **Breached password detection** | Build or buy | Built-in |

### When to Choose Auth0

- You need to ship auth quickly without compromising security
- Your app requires social, enterprise (SAML/LDAP), or passwordless login
- You want a managed service with SLA guarantees
- You need B2B multi-tenancy (Organizations feature)
- Compliance requirements demand an audited identity provider

### When Auth0 May Not Be Right

- You have an extremely high-volume consumer app where per-MAU pricing becomes prohibitive
- You need full control of every aspect of the identity pipeline and have the team to maintain it
- Regulatory requirements mandate that all identity data stay within your own infrastructure with no third-party involvement

---

## Auth0 Architecture

Auth0 is organized around several core primitives. Understanding how they relate to each other is essential before you touch the dashboard.

### Core Primitives

```
                          +-----------------+
                          |    TENANT       |
                          |  (your-app.auth0.com) |
                          +--------+--------+
                                   |
                 +-----------------+-----------------+
                 |                 |                 |
          +------+------+  +------+------+   +------+------+
          | APPLICATIONS |  | CONNECTIONS |   |    APIS     |
          | (clients)    |  | (identity   |   | (resource   |
          |              |  |  sources)   |   |  servers)   |
          +--------------+  +-------------+   +-------------+
```

### Tenant

A tenant is your isolated Auth0 environment. It has its own:

- Domain (e.g., `your-company.us.auth0.com` or a custom domain like `auth.your-company.com`)
- Configuration, keys, and secrets
- User database
- Logs and analytics

**Best practice**: Create separate tenants for `dev`, `staging`, and `production`. Never share a tenant across environments.

### Applications (Clients)

An application in Auth0 represents a piece of software that will authenticate users. Each application gets:

- **Client ID** -- public identifier, safe to embed in frontend code
- **Client Secret** -- private key, NEVER expose to browsers or mobile apps
- **Allowed Callback URLs** -- where Auth0 redirects after login
- **Allowed Logout URLs** -- where Auth0 redirects after logout
- **Allowed Web Origins** -- for CORS in SPA flows

### Connections

Connections are the sources of identity -- where user credentials are stored and validated:

- **Database connections** -- Auth0-hosted user store with bcrypt-hashed passwords
- **Social connections** -- Google, GitHub, Facebook, Apple, LinkedIn, Twitter, etc.
- **Enterprise connections** -- SAML 2.0, OIDC, LDAP/AD, Azure AD, Google Workspace
- **Passwordless** -- Email magic links or SMS codes

### APIs (Resource Servers)

APIs represent the backend services your applications call. Each API has:

- **Identifier (audience)** -- a unique URI, e.g., `https://api.your-company.com`
- **Signing algorithm** -- RS256 (recommended) or HS256
- **Scopes/Permissions** -- fine-grained access control, e.g., `read:users`, `write:orders`
- **Token lifetime** -- how long access tokens are valid

### How They Work Together

1. A user visits your **Application** (SPA, mobile app, etc.)
2. The application redirects to Auth0's **Universal Login** page
3. The user authenticates via a **Connection** (database, Google, SAML, etc.)
4. Auth0 issues tokens (ID token, access token) scoped to your **API**
5. The application uses the access token to call your backend **API**
6. Your API validates the token and checks **permissions/scopes**

---

## Setting Up an Auth0 Tenant

### Step 1: Create an Auth0 Account

1. Navigate to [https://auth0.com/signup](https://auth0.com/signup)
2. Sign up with your email, Google, or GitHub account
3. Choose a **tenant name** (this becomes your subdomain: `your-tenant.us.auth0.com`)
4. Select your **region** (US, EU, AU, JP) -- pick the region closest to your users
5. Choose the **Free** plan to start (up to 7,500 active users, unlimited logins)

> **Tip**: Tenant names cannot be changed after creation. Use a naming convention like `mycompany-dev`, `mycompany-staging`, `mycompany-prod`.

### Step 2: Complete Onboarding

After sign-up, Auth0 presents a setup wizard:

1. Select your role (Developer, Architect, etc.)
2. Choose your primary use case (B2C, B2B, Internal)
3. Pick your technology (React, Node.js, Python, etc.)

You can skip the wizard -- it just tailors the quickstart docs.

### Step 3: Note Your Tenant Details

From the Auth0 Dashboard, go to **Settings** (gear icon in the sidebar):

- **Domain**: `your-tenant.us.auth0.com`
- **Tenant ID**: visible in the URL and API responses
- **Environment tag**: Development, Staging, or Production (affects rate limits)

### Step 4: Create Your First Application

1. Navigate to **Applications > Applications** in the sidebar
2. Click **+ Create Application**
3. Enter a name (e.g., "My Web App")
4. Select the application type (see next section)
5. Click **Create**

Note the **Client ID** and **Client Secret** from the application settings.

### Step 5: Configure Callback URLs

In your application settings, set:

```
Allowed Callback URLs:      http://localhost:3000/callback
Allowed Logout URLs:        http://localhost:3000
Allowed Web Origins:        http://localhost:3000
```

Click **Save Changes**.

### Step 6: Test the Login Flow

Auth0 provides a built-in test for each application:

1. Go to your application settings
2. Scroll to the bottom and click **Test** (or use the Connections tab)
3. Auth0 opens the Universal Login page
4. Create a test account or log in
5. You should see a successful authentication response with tokens

---

## Application Types

Auth0 supports four application types. Choosing the correct one determines which OAuth 2.0 flows are available and how secrets are handled.

### Single Page Application (SPA)

- **Examples**: React, Angular, Vue.js apps running entirely in the browser
- **OAuth flow**: Authorization Code with PKCE (Proof Key for Code Exchange)
- **Client Secret**: Not used (public client -- secrets cannot be stored safely in the browser)
- **Token storage**: In-memory (recommended) or secure cookies; never localStorage
- **SDK**: `@auth0/auth0-react`, `@auth0/auth0-spa-js`

```javascript
// Example: React SPA with Auth0
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  domain="your-tenant.us.auth0.com"
  clientId="YOUR_CLIENT_ID"
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: "https://api.your-company.com",
    scope: "openid profile email read:data"
  }}
>
  <App />
</Auth0Provider>
```

### Regular Web Application

- **Examples**: Node.js/Express, Django, Rails, ASP.NET apps with server-side rendering
- **OAuth flow**: Authorization Code (with secret)
- **Client Secret**: Used server-side (confidential client)
- **Token storage**: Server-side session
- **SDK**: `express-openid-connect`, `authlib` (Python), `omniauth-auth0` (Ruby)

```javascript
// Example: Express.js with Auth0
const { auth } = require('express-openid-connect');

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SESSION_SECRET,
  baseURL: 'http://localhost:3000',
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL: 'https://your-tenant.us.auth0.com'
}));
```

### Native / Mobile Application

- **Examples**: iOS (Swift), Android (Kotlin), React Native, Flutter
- **OAuth flow**: Authorization Code with PKCE
- **Client Secret**: Not used (public client)
- **Token storage**: Secure enclave / Keychain (iOS), Keystore (Android)
- **SDK**: `Auth0.swift`, `Auth0.Android`, `react-native-auth0`

### Machine-to-Machine (M2M)

- **Examples**: Backend services, daemons, CLI tools, cron jobs
- **OAuth flow**: Client Credentials
- **Client Secret**: Used (confidential client, no user interaction)
- **Tokens**: Access tokens only (no ID token since there is no user)

```bash
# Example: M2M token request
curl --request POST \
  --url https://your-tenant.us.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://your-tenant.us.auth0.com/api/v2/",
    "grant_type": "client_credentials"
  }'
```

---

## Connections

Connections define where and how Auth0 authenticates users.

### Database Connections

Auth0's default connection type. Users sign up with email + password, and Auth0 stores credentials in its cloud database.

**Configuration options**:
- Password policy (length, complexity, history)
- Custom database (use your own database as the identity store)
- Import users from external systems (automatic migration)
- Disable sign-ups (invite-only mode)
- Required username (in addition to email)

**Password policy example**:
```json
{
  "min_length": 12,
  "require_uppercase": true,
  "require_lowercase": true,
  "require_numbers": true,
  "require_symbols": true,
  "password_history": {
    "enable": true,
    "size": 5
  },
  "password_no_personal_info": true,
  "password_dictionary": {
    "enable": true
  }
}
```

### Social Connections

Enable social identity providers with minimal configuration:

| Provider | Setup Effort | Notes |
|---|---|---|
| Google | Low | Use Auth0 dev keys for testing, your own for production |
| GitHub | Low | Great for developer-facing apps |
| Facebook | Medium | Requires Facebook App Review for production |
| Apple | Medium | Requires Apple Developer account, specific callback config |
| LinkedIn | Medium | Uses OpenID Connect |
| Microsoft | Low | Works with personal and work accounts |
| Twitter/X | Medium | Uses OAuth 1.0a under the hood |

> **Important**: Auth0 provides development keys for Google and Facebook that work out of the box for testing. For production, you MUST register your own OAuth app with each provider and enter your own Client ID and Secret.

### Enterprise Connections

For B2B and enterprise scenarios:

- **SAML 2.0** -- Connect to any SAML IdP (Okta, ADFS, OneLogin, Ping)
- **OpenID Connect** -- Connect to any OIDC-compliant IdP
- **Azure AD / Entra ID** -- Direct integration with Microsoft identity
- **Google Workspace** -- Restrict login to a specific Google Workspace domain
- **LDAP / Active Directory** -- Requires Auth0 AD/LDAP Connector agent installed on-premises

**SAML connection setup summary**:
1. Get the SAML metadata URL or XML from the IdP
2. In Auth0 Dashboard, go to **Authentication > Enterprise > SAML**
3. Click **Create Connection**
4. Enter the IdP metadata or manually configure sign-in URL and X.509 certificate
5. Map SAML attributes to Auth0 user profile fields
6. Enable the connection for your application

---

## Universal Login

Universal Login is Auth0's recommended authentication experience. Instead of embedding login forms in your app, you redirect users to an Auth0-hosted login page.

### Why Universal Login

- **Security**: Login page is on Auth0's domain, isolating credentials from your app
- **Single point of maintenance**: Change the login experience once, it updates everywhere
- **SSO**: Automatic single sign-on across all apps on the same tenant
- **Compliance**: Auth0 handles CAPTCHA, breached password checks, MFA prompts

### New Universal Login vs. Classic

| Feature | New (recommended) | Classic (legacy) |
|---|---|---|
| Customization | Branding API, Page Templates | Lock widget or custom HTML |
| Rendering | Server-side rendered by Auth0 | Client-side rendered |
| Performance | Faster | Slower |
| Accessibility | WCAG 2.1 AA | Limited |
| MFA | Integrated | Separate step |

### Customizing Universal Login

**Via Dashboard**:
1. Go to **Branding > Universal Login**
2. Choose between **New** and **Classic** experience
3. Customize:
   - **Logo**: Upload your company logo
   - **Primary color**: Buttons and links color
   - **Page background**: Color or image
   - **Font**: Select from available web fonts

**Via Management API**:
```bash
curl --request PATCH \
  --url https://your-tenant.us.auth0.com/api/v2/branding \
  --header 'authorization: Bearer MGMT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{
    "colors": {
      "primary": "#0059d6",
      "page_background": "#f0f2f5"
    },
    "logo_url": "https://your-company.com/logo.png",
    "favicon_url": "https://your-company.com/favicon.ico"
  }'
```

### Custom Domains

For a seamless branded experience, configure a custom domain:

1. Go to **Branding > Custom Domains**
2. Enter your domain (e.g., `auth.your-company.com`)
3. Choose verification method:
   - **Auth0-managed certificates** (recommended) -- add a CNAME record
   - **Self-managed certificates** -- provide your own TLS cert
4. Add the DNS records Auth0 provides
5. Click **Verify** once DNS propagation is complete

---

## Auth0 Dashboard Walkthrough

The Auth0 Dashboard is your primary management interface. Here is a tour of the key sections:

### Getting Started
- Quickstart guides for your selected technology
- Interactive setup checklist

### Applications
- **Applications**: List of all registered clients (SPAs, web apps, native, M2M)
- **APIs**: Resource servers that your apps request access to
- **SSO Integrations**: Pre-built integrations for SaaS products (Slack, Salesforce, Zoom)

### Authentication
- **Database**: Manage database connections and password policies
- **Social**: Enable/disable social identity providers
- **Enterprise**: Configure SAML, OIDC, LDAP, Azure AD connections
- **Passwordless**: Enable email or SMS passwordless login

### User Management
- **Users**: Search, create, edit, block, delete users
- **Roles**: Define roles (e.g., Admin, Editor, Viewer)
- **Permissions**: Fine-grained permissions assigned to roles or directly to users

### Branding
- **Universal Login**: Customize login page appearance
- **Custom Domains**: Configure branded auth domain
- **Email Templates**: Customize verification, welcome, password reset emails

### Security
- **Attack Protection**: Bot detection, brute-force protection, breached passwords
- **Multi-factor Auth**: Configure MFA policies and factors
- **Monitoring**: Real-time log stream and anomaly detection

### Actions
- **Flows**: Visual pipeline editor for login, registration, and other events
- **Library**: Pre-built and custom action code
- **Triggers**: post-login, pre-user-registration, post-user-registration, etc.

### Monitoring
- **Logs**: Searchable audit trail of every authentication event
- **Log Streams**: Forward logs to external systems (Datadog, Splunk, AWS EventBridge)

---

## Auth0 Management API

The Management API lets you programmatically manage every aspect of your Auth0 tenant. It is a RESTful API protected by OAuth 2.0.

### Getting a Management API Token

**Option 1: Dashboard (for testing)**
1. Go to **Applications > APIs > Auth0 Management API > Test**
2. Select your M2M application
3. Copy the generated token

**Option 2: Client Credentials Grant (for automation)**
```bash
curl --request POST \
  --url https://your-tenant.us.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://your-tenant.us.auth0.com/api/v2/",
    "grant_type": "client_credentials"
  }'
```

### Common API Operations

**List users**:
```bash
curl --request GET \
  --url 'https://your-tenant.us.auth0.com/api/v2/users?q=email:"jane@example.com"' \
  --header 'authorization: Bearer MGMT_API_TOKEN'
```

**Create a user**:
```bash
curl --request POST \
  --url https://your-tenant.us.auth0.com/api/v2/users \
  --header 'authorization: Bearer MGMT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{
    "email": "jane@example.com",
    "password": "SecureP@ssw0rd!",
    "connection": "Username-Password-Authentication",
    "email_verified": true,
    "app_metadata": { "role": "admin" }
  }'
```

**Assign roles to a user**:
```bash
curl --request POST \
  --url https://your-tenant.us.auth0.com/api/v2/users/USER_ID/roles \
  --header 'authorization: Bearer MGMT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{ "roles": ["ROLE_ID_1", "ROLE_ID_2"] }'
```

### Management API Scopes

When creating your M2M application, grant only the scopes you need:

| Scope | Description |
|---|---|
| `read:users` | List and search users |
| `create:users` | Create new users |
| `update:users` | Update user profiles |
| `delete:users` | Delete users |
| `read:roles` | List roles |
| `create:roles` | Create roles |
| `read:connections` | List connections |
| `read:client_grants` | List client grants |
| `read:logs` | Read tenant logs |

---

## Auth0 CLI Setup

The Auth0 CLI (`auth0`) provides a command-line interface for managing your tenant.

### Installation

**macOS (Homebrew)**:
```bash
brew tap auth0/auth0-cli
brew install auth0
```

**Linux (cURL)**:
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
```

**Windows (Scoop)**:
```powershell
scoop bucket add auth0 https://github.com/auth0/scoop-auth0-cli.git
scoop install auth0
```

### Authentication

```bash
# Login to your tenant (opens browser for device authorization)
auth0 login

# Verify connection
auth0 tenants list
```

### Common CLI Commands

```bash
# List applications
auth0 apps list

# Create an application
auth0 apps create --name "My New App" --type spa

# List users
auth0 users search

# Create a user
auth0 users create --email "test@example.com" --connection "Username-Password-Authentication"

# View logs
auth0 logs tail

# List APIs
auth0 apis list

# Export tenant configuration
auth0 tenants use your-tenant.us.auth0.com

# Test a login flow
auth0 test login
```

### CLI in CI/CD

For non-interactive environments, use M2M credentials:

```bash
export AUTH0_DOMAIN="your-tenant.us.auth0.com"
export AUTH0_CLIENT_ID="M2M_CLIENT_ID"
export AUTH0_CLIENT_SECRET="M2M_CLIENT_SECRET"

auth0 login --client-id "$AUTH0_CLIENT_ID" --client-secret "$AUTH0_CLIENT_SECRET" --domain "$AUTH0_DOMAIN"
```

---

## Key Concepts Summary

| Concept | Definition |
|---|---|
| **Tenant** | Isolated Auth0 environment with its own domain and config |
| **Application** | A client (SPA, web app, native, M2M) registered in Auth0 |
| **Connection** | An identity source (database, social, enterprise) |
| **API** | A resource server that accepts Auth0 access tokens |
| **Universal Login** | Auth0-hosted login page for secure, centralized authentication |
| **Client ID** | Public identifier for an application |
| **Client Secret** | Private key for confidential clients (never expose in browsers) |
| **Management API** | RESTful API for programmatic tenant management |
| **PKCE** | Proof Key for Code Exchange -- secures OAuth flow for public clients |
| **Audience** | The API identifier included in token requests to scope access tokens |

---

## Next Steps

- Complete the labs in this module to build hands-on experience
- Move to [Module 04: Auth0 Advanced](../04-auth0-advanced/README.md) for SSO, MFA, Actions, and Organizations
- Review the scripts in `scripts/` for automation examples
- Explore the sample tenant config in `config/auth0-tenant-config.json`
