# Lab 04: Organizations

## Objectives

By the end of this lab you will be able to:

- Create Auth0 Organizations for B2B multi-tenancy
- Add members to organizations with specific roles
- Configure organization-specific connections (bring your own IdP)
- Customize branding per organization
- Send organization invitations via email
- Validate organization membership in your application

## Prerequisites

- Completed Module 03 labs and Lab 01-03 of this module
- Auth0 tenant with applications and users
- Understanding of RBAC from previous labs

## Estimated Time

35-45 minutes

---

## Step 1: Enable Organizations

1. Go to **Applications > Applications** in the Auth0 Dashboard
2. Select your SPA application (`Identity Lab SPA`)
3. Go to the **Organizations** tab
4. Under **Login Flow**, select one of:
   - **Business Users** -- Users must always log in to a specific organization
   - **Both** -- Users can log in with or without an organization
5. Select **Both** for flexibility
6. Click **Save Changes**

---

## Step 2: Create Organizations

### Organization 1: Acme Corporation

1. Go to **Organizations** in the sidebar
2. Click **+ Create Organization**
3. Fill in:
   - **Name**: `acme-corp` (URL-safe identifier)
   - **Display Name**: `Acme Corporation`
4. Click **Create**

### Organization 2: Beta Industries

1. Click **+ Create Organization**
2. Fill in:
   - **Name**: `beta-industries`
   - **Display Name**: `Beta Industries`
3. Click **Create**

### Via Management API

```bash
# Create an organization
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "name": "gamma-tech",
    "display_name": "Gamma Technologies",
    "branding": {
      "colors": {
        "primary": "#FF6B35",
        "page_background": "#FFF5F0"
      },
      "logo_url": "https://via.placeholder.com/150x150/FF6B35/ffffff?text=GT"
    },
    "metadata": {
      "plan": "enterprise",
      "industry": "technology",
      "max_seats": 500
    }
  }' | jq .
```

---

## Step 3: Configure Organization Connections

Each organization can have its own identity sources.

### Enable Database Connection for Acme

1. Go to **Organizations > acme-corp > Connections**
2. Click **+ Enable Connection**
3. Select `Username-Password-Authentication`
4. Configure:
   - **Auto-Membership**: Disabled (users must be explicitly added)
   - **Assign membership on login**: Enable if you want auto-join
5. Click **Enable Connection**

### Enable Social Connection for Beta

1. Go to **Organizations > beta-industries > Connections**
2. Enable `Username-Password-Authentication`
3. Also enable `google-oauth2` if available
4. This allows Beta employees to log in via Google

### Enterprise Connection (Optional)

If you have an enterprise IdP, you can dedicate it to a specific organization:

1. Create a SAML or OIDC connection for the organization's IdP
2. Enable it only for that organization
3. When users from that org log in, they are redirected to their corporate IdP

---

## Step 4: Add Members to Organizations

### Via Dashboard

1. Go to **Organizations > acme-corp > Members**
2. Click **+ Add Members**
3. Search for existing users (e.g., `alice.admin@identity-lab.local`)
4. Select the user and click **Add Member(s)**

### Via Management API

```bash
# Get organization ID
ORG_ID=$(curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations?q=name%3Aacme-corp" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq -r '.[0].id')

# Add a member
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations/${ORG_ID}/members" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{ "members": ["auth0|USER_ID_HERE"] }'
```

### Assign Organization Roles

Organizations have their own role system separate from the global RBAC:

1. Go to **Organizations > acme-corp > Members**
2. Click the three dots next to a member
3. Click **Assign Roles**
4. Select roles (these are your globally defined roles, but scoped to this org)

```bash
# Assign organization roles via API
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations/${ORG_ID}/members/${USER_ID}/roles" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{ "roles": ["ROLE_ID"] }'
```

---

## Step 5: Organization Branding

Each organization can have a custom login page:

### Via Dashboard

1. Go to **Organizations > acme-corp > Branding**
2. Set:
   - **Logo URL**: `https://via.placeholder.com/150x150/0059d6/ffffff?text=ACME`
   - **Primary Color**: `#0059d6`
   - **Background Color**: `#E8F0FE`
3. Click **Save**

### Via API

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations/${ORG_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "branding": {
      "logo_url": "https://via.placeholder.com/150x150/0059d6/ffffff?text=ACME",
      "colors": {
        "primary": "#0059d6",
        "page_background": "#E8F0FE"
      }
    }
  }'
```

---

## Step 6: Send Invitations

Organizations support email invitations:

### Via Dashboard

1. Go to **Organizations > acme-corp > Invitations**
2. Click **+ Create Invitation**
3. Fill in:
   - **Invitee Email**: `newuser@example.com`
   - **Connection**: Select the connection for the invitee
   - **Roles**: Optionally assign roles
4. Click **Create Invitation**

### Via API

```bash
# Send an invitation
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations/${ORG_ID}/invitations" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "inviter": { "name": "Admin" },
    "invitee": { "email": "newuser@example.com" },
    "client_id": "YOUR_APP_CLIENT_ID",
    "connection_id": "CONNECTION_ID",
    "roles": ["ROLE_ID"],
    "ttl_sec": 604800,
    "send_invitation_email": true
  }' | jq .
```

The invitee receives an email with a link. Clicking the link takes them to the organization-branded login page where they can create an account or log in.

---

## Step 7: Test Organization Login

### Update Your Application

Modify your test app to support organization login:

```javascript
// Login to a specific organization
async function loginToOrg(orgName) {
  await client.loginWithRedirect({
    authorizationParams: {
      organization: orgName  // e.g., 'org_AcmeCorp123'
    }
  });
}

// Or use the organization ID
async function loginToOrgById(orgId) {
  await client.loginWithRedirect({
    authorizationParams: {
      organization: orgId
    }
  });
}
```

### Test the Flow

1. Open your test app
2. Log in with the organization parameter set to `acme-corp`
3. The login page should show Acme Corporation's branding
4. After login, check the ID token -- it should include:

```json
{
  "org_id": "org_abc123",
  "org_name": "acme-corp"
}
```

### Validate Organization in Your Backend

```javascript
// Node.js/Express middleware
function requireOrganization(requiredOrgId) {
  return (req, res, next) => {
    const token = req.auth; // Decoded JWT

    if (!token.org_id) {
      return res.status(403).json({ error: 'Organization membership required' });
    }

    if (requiredOrgId && token.org_id !== requiredOrgId) {
      return res.status(403).json({ error: 'Wrong organization' });
    }

    req.orgId = token.org_id;
    next();
  };
}

// Usage
app.get('/api/org-data', requireOrganization(), (req, res) => {
  // Fetch data scoped to req.orgId
});
```

---

## Step 8: Organization Metadata

Store custom data on organizations for application logic:

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/organizations/${ORG_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "metadata": {
      "plan": "enterprise",
      "max_seats": 500,
      "features": ["sso", "audit_log", "custom_branding"],
      "billing_email": "billing@acme.com",
      "industry": "technology"
    }
  }'
```

Access metadata in Actions:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  if (event.organization) {
    const namespace = 'https://identity-lab.local/';
    api.accessToken.setCustomClaim(namespace + 'org_plan', event.organization.metadata?.plan);
    api.accessToken.setCustomClaim(namespace + 'org_features', event.organization.metadata?.features);
  }
};
```

---

## Validation Checklist

- [ ] Organizations feature enabled on your application
- [ ] At least two organizations created (Acme Corp, Beta Industries)
- [ ] Connections enabled per organization
- [ ] Members added to organizations
- [ ] Organization-specific roles assigned
- [ ] Organization branding configured
- [ ] Organization login tested (org_id in token)
- [ ] Invitations sent (or API tested)
- [ ] Organization metadata stored and accessible

---

## Troubleshooting

### "Organization not found" Error

**Cause**: Organization name or ID is incorrect, or the organization does not have the application's connection enabled.

**Fix**: Verify the organization name/ID. Ensure at least one connection is enabled for the organization.

### User Cannot Log In to Organization

**Cause**: User is not a member of the organization and auto-membership is disabled.

**Fix**: Add the user as a member via the dashboard or API. Or enable auto-membership on the connection.

### Organization Branding Not Showing

**Cause**: Login is not specifying the organization parameter.

**Fix**: Pass `organization: 'org_id'` in the authorization params when redirecting to login.

### org_id Missing from Token

**Cause**: Application not configured for organization login, or user logged in without specifying an organization.

**Fix**: In the application's Organizations tab, set the login flow to "Business Users" or "Both."

---

## Next Lab

Proceed to [Lab 05: User Migration](lab-05-user-migration.md) to learn how to migrate users from legacy systems to Auth0.
