# Lab 02: Social Connections

## Objectives

By the end of this lab you will be able to:

- Enable Google OAuth 2.0 as a social connection
- Enable GitHub OAuth as a social connection
- Configure each provider with production-ready credentials
- Test social login flows in your application
- Understand the difference between Auth0 development keys and your own keys
- Handle account linking when a user signs in with multiple social providers

## Prerequisites

- Completed [Lab 01: Tenant Setup](lab-01-tenant-setup.md)
- Auth0 tenant with a registered SPA application
- Google account (for Google OAuth setup)
- GitHub account (for GitHub OAuth setup)
- Test application running on `http://localhost:3000`

## Estimated Time

30-40 minutes

---

## Step 1: Understanding Auth0 Development Keys

Auth0 provides built-in development keys for Google and Facebook connections. These keys:

- Work immediately with no setup
- Are shared across all Auth0 tenants in dev mode
- Display a "Not verified by Google" warning
- Have limited API access (basic profile + email only)
- **Must not be used in production**

You can see if a connection uses dev keys by checking the connection settings -- it will say "Using Auth0 development keys."

We will start with dev keys for Google, then replace them with your own.

---

## Step 2: Enable Google Login (Development Keys)

1. Navigate to **Authentication > Social** in the Auth0 Dashboard
2. Click **+ Create Connection**
3. Select **Google / Gmail**
4. Leave the **Client ID** and **Client Secret** fields empty (Auth0 will use dev keys)
5. Under **Permissions**, ensure these are checked:
   - `email`
   - `profile`
6. Click **Create**
7. On the **Applications** tab, enable the connection for your `Identity Lab SPA` application
8. Click **Save**

### Test Google Login

1. Open your test app at `http://localhost:3000`
2. Click **Log In**
3. On the Universal Login page, you should now see a **Continue with Google** button
4. Click it and authenticate with your Google account
5. You should be redirected back to your app with your Google profile information

> **Notice**: You will see a Google warning screen saying the app is not verified. This is expected with dev keys.

---

## Step 3: Configure Google OAuth with Your Own Keys

### Create a Google OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **+ Create Credentials > OAuth client ID**
5. If prompted, configure the **OAuth consent screen**:
   - Choose **External** (or Internal for Google Workspace)
   - App name: `Identity Lab`
   - User support email: your email
   - Authorized domains: `auth0.com` (add your custom domain if applicable)
   - Developer contact: your email
   - Click **Save and Continue**
   - Scopes: add `email`, `profile`, `openid`
   - Test users: add your email (required for external apps in testing)
6. Back in Credentials, create the OAuth client:
   - Application type: **Web application**
   - Name: `Auth0 Social Connection`
   - Authorized redirect URIs: `https://{your-tenant}.us.auth0.com/login/callback`
   - Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Update Auth0 Connection

1. In Auth0 Dashboard, go to **Authentication > Social > Google**
2. Enter your **Client ID** and **Client Secret**
3. Under **Permissions**, you can optionally add:
   - `https://www.googleapis.com/auth/calendar.readonly` (for calendar access)
   - `https://www.googleapis.com/auth/contacts.readonly` (for contacts)
4. Click **Save**

### Test with Your Own Keys

1. Open your test app and log in with Google
2. You should no longer see the "Not verified" warning (once your app is published)
3. The consent screen should show your app name and logo

---

## Step 4: Enable GitHub Login

### Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps > New OAuth App**
3. Fill in:
   - **Application name**: `Identity Lab Auth0`
   - **Homepage URL**: `https://{your-tenant}.us.auth0.com`
   - **Authorization callback URL**: `https://{your-tenant}.us.auth0.com/login/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy the **Client Secret**

### Add GitHub Connection in Auth0

1. In Auth0 Dashboard, go to **Authentication > Social**
2. Click **+ Create Connection**
3. Select **GitHub**
4. Enter your GitHub **Client ID** and **Client Secret**
5. Under **Permissions**, select the scopes you need:
   - `read:user` -- basic profile information (recommended)
   - `user:email` -- access to email addresses (recommended)
   - `read:org` -- organization membership (optional, for access control)
   - `repo` -- repository access (only if your app needs it)
6. Under **Attributes**, ensure these are mapped:
   - **Basic Profile**: enabled
   - **Email Address**: enabled
7. Click **Create**
8. On the **Applications** tab, enable it for your `Identity Lab SPA`
9. Click **Save**

### Test GitHub Login

1. Open your test app at `http://localhost:3000`
2. Click **Log In**
3. You should now see **Continue with Google** and **Continue with GitHub** buttons
4. Click **Continue with GitHub**
5. Authorize the application on GitHub
6. You should be redirected back with your GitHub profile information

### Inspect the GitHub User Profile

In the Auth0 Dashboard, go to **User Management > Users** and find your GitHub user. The raw JSON should include:

```json
{
  "identities": [
    {
      "provider": "github",
      "user_id": "12345678",
      "connection": "github",
      "isSocial": true
    }
  ],
  "name": "Your GitHub Name",
  "nickname": "your-github-username",
  "picture": "https://avatars.githubusercontent.com/u/12345678",
  "user_id": "github|12345678",
  "email": "your-email@example.com"
}
```

---

## Step 5: Understanding Account Linking

When a user logs in with Google using `jane@example.com` and later logs in with GitHub using the same email, Auth0 creates **two separate user accounts** by default:

- `google-oauth2|1234567890`
- `github|87654321`

This is usually not desired. You want a single user profile regardless of how they authenticate.

### Automatic Account Linking

Auth0 does not automatically link accounts. You have several options:

**Option A: Auth0 Action (recommended)**

Create a post-login Action that links accounts with the same verified email:

1. Go to **Actions > Flows > Login**
2. Click **+** to add a custom action
3. Name it `Link Accounts by Email`
4. Add this code:

```javascript
const { ManagementClient } = require('auth0');

exports.onExecutePostLogin = async (event, api) => {
  // Skip if email is not verified
  if (!event.user.email_verified) return;

  // Skip if user already has linked accounts
  if (event.user.identities && event.user.identities.length > 1) return;

  const management = new ManagementClient({
    domain: event.secrets.DOMAIN,
    clientId: event.secrets.CLIENT_ID,
    clientSecret: event.secrets.CLIENT_SECRET,
  });

  // Search for other users with the same email
  const users = await management.usersByEmail.getByEmail({
    email: event.user.email
  });

  // Find accounts to link (exclude current user)
  const accountsToLink = users.filter(
    u => u.user_id !== event.user.user_id && u.email_verified
  );

  for (const account of accountsToLink) {
    const provider = account.identities[0].provider;
    const userId = account.identities[0].user_id;

    await management.users.link(
      { id: event.user.user_id },
      { provider, user_id: userId }
    );
  }
};
```

5. Add the required secrets (DOMAIN, CLIENT_ID, CLIENT_SECRET for an M2M app)
6. Deploy the action
7. Drag it into the Login flow

**Option B: Auth0 Account Linking Extension**

1. Go to **Extensions** in the dashboard
2. Search for "Account Linking"
3. Install the Auth0 Account Link extension
4. This adds a redirect rule that prompts users to link accounts

---

## Step 6: Configure Connection-Level Settings

### Home Realm Discovery

If you want users from a specific email domain to be automatically directed to a particular connection:

1. Go to **Authentication > Social > Google** (or any connection)
2. Under **Login Experience**, you can set domain aliases
3. For enterprise connections, enable **Home Realm Discovery** by specifying email domains

### Restrict Signups by Connection

To disable new signups via a social connection (only allow existing users):

1. Go to the connection settings
2. Disable **Sign Up** if the option is available
3. Alternatively, use a pre-registration Action to block signups based on business logic

### Sync User Profile Attributes

By default, Auth0 syncs the social profile on every login. To control this:

1. Go to your Application Settings
2. Under **Connections**, click the gear icon next to the social connection
3. Configure attribute mapping and sync behavior

---

## Step 7: Add Additional Social Providers (Optional)

Repeat the process for any additional providers your application needs:

| Provider | Callback URL Pattern | Key Notes |
|---|---|---|
| Facebook | `https://{tenant}/login/callback` | Requires App Review for production |
| Apple | `https://{tenant}/login/callback` | Requires Apple Developer account ($99/yr) |
| LinkedIn | `https://{tenant}/login/callback` | Uses OIDC, limited to Sign In with LinkedIn |
| Microsoft | `https://{tenant}/login/callback` | Supports personal + work accounts |
| Twitter/X | `https://{tenant}/login/callback` | OAuth 1.0a, more complex setup |

---

## Validation Checklist

- [ ] Google social connection enabled and functional
- [ ] Google connection configured with your own OAuth credentials (not dev keys)
- [ ] GitHub social connection enabled and functional
- [ ] Both social login buttons appear on the Universal Login page
- [ ] User profiles from social logins appear in User Management
- [ ] You understand the account linking problem and at least one solution
- [ ] Social users have correct profile information (name, email, avatar)

---

## Troubleshooting

### "redirect_uri_mismatch" from Google

**Cause**: The redirect URI in Google Cloud Console does not match what Auth0 sends.

**Fix**: Ensure the authorized redirect URI is exactly `https://{your-tenant}.us.auth0.com/login/callback` (with HTTPS and no trailing slash).

### GitHub Login Shows "Application Suspended"

**Cause**: GitHub rate-limited or suspended the OAuth app.

**Fix**: Check your GitHub OAuth app settings and ensure the callback URL is correct.

### Social Login Returns "access_denied"

**Cause**: The user denied the consent prompt, or the required scopes are not approved.

**Fix**: Check the connection permissions in Auth0. For Google, ensure the OAuth consent screen is configured and the app is in Testing mode with your email added as a test user.

### User Email Is Null After Social Login

**Cause**: The social provider did not return an email (common with GitHub if the user's email is private).

**Fix**: For GitHub, ensure the `user:email` scope is requested. For other providers, check their documentation on email scope requirements.

### Two Separate Accounts for Same Email

**Cause**: Auth0 does not automatically link accounts from different providers.

**Fix**: Implement account linking using an Auth0 Action or the Account Linking Extension (see Step 5).

---

## Clean Up

Keep the social connections enabled for subsequent labs. If you want to remove them:

1. Go to **Authentication > Social**
2. Click the connection you want to remove
3. Click **Delete** at the bottom of the settings page

---

## Next Lab

Proceed to [Lab 03: Universal Login](lab-03-universal-login.md) to customize the look and feel of your login page.
