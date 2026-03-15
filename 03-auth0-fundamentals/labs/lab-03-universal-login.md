# Lab 03: Universal Login Customization

## Objectives

By the end of this lab you will be able to:

- Customize the Auth0 Universal Login page with your branding
- Configure colors, logos, fonts, and page backgrounds
- Set up a custom domain for your Auth0 tenant
- Use the Auth0 Branding API to manage styling programmatically
- Customize email templates for verification, password reset, and welcome emails
- Understand the difference between the New and Classic Universal Login experience

## Prerequisites

- Completed [Lab 01: Tenant Setup](lab-01-tenant-setup.md)
- Auth0 tenant with a registered application
- A logo image hosted on a public URL (or use a placeholder)
- (Optional) A custom domain you own for custom domain setup

## Estimated Time

25-35 minutes

---

## Step 1: Choose the Universal Login Experience

Auth0 offers two Universal Login experiences:

### New Universal Login (Recommended)

- Server-side rendered by Auth0
- Customizable via Branding API and dashboard settings
- Better performance and accessibility (WCAG 2.1 AA)
- Supports Page Templates for advanced customization
- Integrated MFA prompts

### Classic Universal Login (Legacy)

- Uses the Lock widget or a fully custom HTML page
- Client-side rendered
- Full HTML/CSS/JS control
- Being phased out in favor of the New experience

### Set Your Experience

1. Go to **Branding > Universal Login** in the Auth0 Dashboard
2. At the top, you will see **Experience** toggle: select **New**
3. Click **Save**

> **Note**: If you have existing customizations in Classic mode, they will not carry over. The New experience uses its own configuration system.

---

## Step 2: Customize Branding via Dashboard

### Logo

1. In **Branding > Universal Login**, scroll to the **Logo** section
2. Enter the URL to your company logo:
   - Recommended size: 150x150 pixels (square) or up to 300px wide
   - Supported formats: PNG, JPG, SVG
   - Must be served over HTTPS
   - Example: `https://your-cdn.com/logo.png`
3. For testing, you can use a placeholder: `https://via.placeholder.com/150x150/0059d6/ffffff?text=IDM`

### Colors

Configure the color scheme:

| Setting | Description | Example Value |
|---|---|---|
| Primary Color | Buttons, links, active elements | `#0059d6` |
| Page Background | Login page background color | `#f0f2f5` |

1. Click the color picker for **Primary Color** and choose your brand color
2. Click the color picker for **Page Background** and set a complementary background
3. Click **Save Changes**

### Test Your Changes

1. Open your test app and click **Log In**
2. The Universal Login page should reflect your new colors and logo
3. Verify the **Log In** button uses your primary color
4. Verify the logo appears at the top of the login box

---

## Step 3: Advanced Branding with the Branding API

For CI/CD and infrastructure-as-code workflows, use the Management API to set branding:

### Get a Management API Token

```bash
export AUTH0_DOMAIN="your-tenant.us.auth0.com"
export AUTH0_M2M_CLIENT_ID="your-m2m-client-id"
export AUTH0_M2M_CLIENT_SECRET="your-m2m-client-secret"

ACCESS_TOKEN=$(curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/oauth/token" \
  --header 'content-type: application/json' \
  --data "{
    \"client_id\": \"${AUTH0_M2M_CLIENT_ID}\",
    \"client_secret\": \"${AUTH0_M2M_CLIENT_SECRET}\",
    \"audience\": \"https://${AUTH0_DOMAIN}/api/v2/\",
    \"grant_type\": \"client_credentials\"
  }" | jq -r '.access_token')
```

### Update Branding

```bash
curl --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/branding" \
  --header "authorization: Bearer ${ACCESS_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "colors": {
      "primary": "#0059d6",
      "page_background": {
        "type": "linear-gradient",
        "start": "#0059d6",
        "end": "#1a1a2e",
        "angle_deg": 135
      }
    },
    "logo_url": "https://your-cdn.com/logo.png",
    "favicon_url": "https://your-cdn.com/favicon.ico",
    "font": {
      "url": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"
    }
  }'
```

### Read Current Branding

```bash
curl --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/branding" \
  --header "authorization: Bearer ${ACCESS_TOKEN}" | jq .
```

---

## Step 4: Customize Universal Login Text

You can customize the text shown on the login page (headings, labels, button text):

### Via Dashboard

1. Go to **Branding > Universal Login > Advanced Options**
2. Under **Login**, you can customize:
   - Page title
   - Description text
   - Button labels

### Via API (Text Customization)

```bash
curl --request PUT \
  --url "https://${AUTH0_DOMAIN}/api/v2/prompts/login/custom-text/en" \
  --header "authorization: Bearer ${ACCESS_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "login": {
      "title": "Welcome to Identity Lab",
      "description": "Sign in to access your account",
      "buttonText": "Continue",
      "federatedConnectionButtonText": "Sign in with ${connectionName}",
      "signupActionLinkText": "Create an account",
      "forgotPasswordText": "Forgot your password?"
    }
  }'
```

### Available Prompts for Text Customization

| Prompt | Description |
|---|---|
| `login` | The main login form |
| `login-id` | Identifier-first login |
| `login-password` | Password entry (after identifier) |
| `signup` | Registration form |
| `signup-id` | Identifier-first signup |
| `signup-password` | Password entry during signup |
| `reset-password` | Password reset request |
| `consent` | OAuth consent screen |
| `mfa` | Multi-factor authentication prompts |
| `mfa-push` | Push notification MFA |
| `mfa-otp` | One-time password MFA |
| `mfa-sms` | SMS-based MFA |
| `organizations` | Organization selector |

---

## Step 5: Page Templates (Advanced)

For full control over the login page layout while keeping the Auth0-rendered login box, use Page Templates:

### Enable Page Templates

1. Go to **Branding > Universal Login**
2. Click **Custom Login Page** (or the **Advanced** tab)
3. Enable the HTML editor

### Example Page Template

```html
<!DOCTYPE html>
<html>
<head>
  {%- auth0:head -%}
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0059d6 0%, #1a1a2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 480px;
      padding: 40px 20px;
    }

    .company-header {
      text-align: center;
      margin-bottom: 32px;
      color: white;
    }

    .company-header h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }

    .company-header p {
      font-size: 14px;
      opacity: 0.8;
      margin: 0;
    }

    .footer {
      margin-top: 24px;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }

    .footer a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="company-header">
      <h1>Identity Lab</h1>
      <p>Secure access to your workspace</p>
    </div>

    {%- auth0:widget -%}

    <div class="footer">
      <p>&copy; 2026 Identity Lab. All rights reserved.</p>
      <p><a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a></p>
    </div>
  </div>
</body>
</html>
```

> **Key placeholders**:
> - `{%- auth0:head -%}` -- includes required Auth0 scripts and styles
> - `{%- auth0:widget -%}` -- renders the login/signup form

### Set Page Template via API

```bash
curl --request PUT \
  --url "https://${AUTH0_DOMAIN}/api/v2/branding/templates/universal-login" \
  --header "authorization: Bearer ${ACCESS_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "template": "<!DOCTYPE html><html><head>{%- auth0:head -%}</head><body>{%- auth0:widget -%}</body></html>"
  }'
```

---

## Step 6: Custom Domain Setup

A custom domain replaces `your-tenant.us.auth0.com` with something like `auth.your-company.com`.

### Benefits

- Branded, trustworthy login experience
- No third-party domain visible to users
- Better cookie handling (same-site cookies with your domain)
- Required for some SSO configurations

### Configuration Steps

1. Go to **Branding > Custom Domains**
2. Click **+ Add Domain**
3. Enter your domain: `auth.your-company.com`
4. Choose a certificate management option:
   - **Auth0-Managed** (recommended): Auth0 provisions and renews the TLS certificate
   - **Self-Managed**: You provide your own certificate and update it before expiry
5. Click **Add Domain**

### DNS Configuration

Auth0 will provide DNS records to add. For Auth0-Managed certificates:

```
Type:  CNAME
Name:  auth.your-company.com
Value: your-tenant.edge.tenants.us.auth0.com
TTL:   300
```

Add this record in your DNS provider (Cloudflare, Route53, GoDaddy, etc.).

### Verify the Domain

1. After adding the DNS record, wait for propagation (usually 5-30 minutes)
2. Click **Verify** in the Auth0 Dashboard
3. Once verified, Auth0 provisions the TLS certificate
4. Status should change to **Ready**

### Update Your Application

After the custom domain is active, update:

1. **Application Settings**: Update the domain in your app's Auth0 configuration
2. **API Identifier**: No change needed (audience is a URI, not a domain)
3. **Social Connection Callbacks**: Update redirect URIs in Google, GitHub, etc. to use the custom domain

```javascript
// Before
const AUTH0_DOMAIN = 'your-tenant.us.auth0.com';

// After
const AUTH0_DOMAIN = 'auth.your-company.com';
```

---

## Step 7: Customize Email Templates

Auth0 sends transactional emails for verification, password reset, and more.

### Available Email Templates

| Template | Trigger |
|---|---|
| Verification Email | User signs up (email needs verification) |
| Verification Email (using Link) | Alternative verification with magic link |
| Welcome Email | After email is verified |
| Change Password | User requests password reset |
| Blocked Account | Account blocked due to suspicious activity |
| Password Breach Alert | Password found in breached database |
| MFA Enrollment | User enrolls in MFA |
| Passwordless Email | User requests passwordless login |

### Customize a Template

1. Go to **Branding > Email Templates**
2. Select **Verification Email (using Link)**
3. Customize:
   - **From**: `noreply@your-company.com` (requires email provider setup)
   - **Subject**: `Verify your Identity Lab account`
   - **Redirect To**: `http://localhost:3000/verified`
   - **URL Lifetime**: `432000` seconds (5 days)
4. Edit the HTML body:

```html
<html>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f2f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto;">
    <tr>
      <td style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #1a1a2e; margin: 0 0 16px;">Verify Your Email</h1>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
          Hi {{ user.name || user.email }},
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
          Thanks for signing up for Identity Lab. Please click the button below to verify your email address.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
          <tr>
            <td style="background: #0059d6; border-radius: 4px; padding: 14px 28px;">
              <a href="{{ url }}" style="color: white; text-decoration: none; font-size: 16px; font-weight: 600;">
                Verify Email Address
              </a>
            </td>
          </tr>
        </table>
        <p style="color: #999; font-size: 13px;">
          If you did not create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">&copy; 2026 Identity Lab</p>
      </td>
    </tr>
  </table>
</body>
</html>
```

5. Click **Save**

### Configure Custom Email Provider (Optional)

By default, Auth0 uses its own SMTP server (limited to 10 emails/minute). For production:

1. Go to **Branding > Email Provider**
2. Choose your provider:
   - **SMTP**: Any SMTP server (SendGrid, Mailgun, SES, etc.)
   - **Mandrill**: Mailchimp's transactional email
   - **Amazon SES**: Direct integration
   - **SendGrid**: Direct integration
   - **SparkPost**: Direct integration
   - **MS365**: Microsoft 365 integration
3. Enter credentials and test

---

## Validation Checklist

- [ ] Universal Login set to New experience
- [ ] Logo, primary color, and page background customized
- [ ] Login page reflects branding changes
- [ ] Text customization applied (button labels, headings)
- [ ] Page template created (if using advanced customization)
- [ ] Custom domain configured and verified (or understood the process)
- [ ] At least one email template customized
- [ ] Branding API tested for programmatic configuration

---

## Troubleshooting

### Branding Changes Not Appearing

**Cause**: Browser cache or CDN cache serving the old version.

**Fix**: Hard refresh the login page (Ctrl+Shift+R or Cmd+Shift+R). Clear browser cache. Wait 2-3 minutes for CDN propagation.

### Logo Not Displaying

**Cause**: Logo URL is not accessible from Auth0's servers or is not HTTPS.

**Fix**: Ensure the logo URL is publicly accessible, uses HTTPS, and returns a valid image. Test by opening the URL directly in a browser.

### Custom Domain Stuck on "Pending Verification"

**Cause**: DNS records not yet propagated or incorrectly configured.

**Fix**: Use `dig auth.your-company.com CNAME` to verify the DNS record is correct. Wait up to 48 hours for propagation (though usually 5-30 minutes).

### Page Template Rendering Issues

**Cause**: Missing `{%- auth0:head -%}` or `{%- auth0:widget -%}` placeholders.

**Fix**: Ensure both required placeholders are present in your template. The head placeholder must be inside `<head>` and the widget placeholder inside `<body>`.

### Email Templates Not Sending

**Cause**: Default Auth0 email provider has rate limits (10/minute).

**Fix**: Configure a custom email provider (SendGrid, SES, etc.) for production use.

---

## Next Lab

Proceed to [Lab 04: Management API](lab-04-management-api.md) to learn how to manage users, roles, and permissions programmatically.
