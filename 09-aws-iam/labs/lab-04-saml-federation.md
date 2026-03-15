# Lab 04: SAML Federation with AWS

## Objective

Configure Auth0 as a SAML Identity Provider (IdP) for AWS, allowing users to log into the AWS Console through Auth0. This eliminates the need for IAM users — employees authenticate via Auth0 and receive temporary AWS credentials based on their Auth0 roles.

## Prerequisites

- Auth0 tenant from Module 03
- AWS account with admin access
- Understanding of SAML from Module 02

## Estimated Time

60–75 minutes

---

## Part 1: How SAML Federation Works with AWS

```
User                 Auth0 (IdP)              AWS (SP)
────                 ───────────              ────────
1. Visit AWS login
2. Redirect to Auth0 ──→
3. Auth0 login page
4. User authenticates
5.                   ←── SAML Assertion
   Contains:              (signed XML with
   - User identity         attributes mapping
   - AWS Role ARN          to AWS roles)
   - Session duration
6. POST assertion to AWS ────────────────────→
7.                                            Validate assertion
8.                                            Create temporary creds
9. ←──────────────────────────────────────── AWS Console access
```

---

## Part 2: Configure Auth0 as a SAML IdP

### Step 1: Create an Auth0 application for AWS

1. Log into Auth0 Dashboard
2. Go to **Applications → Applications → Create Application**
3. Name: `AWS Console SSO`
4. Type: **Regular Web Application**
5. Click **Create**
6. Go to the **Addons** tab
7. Enable **SAML2 Web App**

### Step 2: Configure the SAML addon

In the SAML2 addon settings:

**Application Callback URL:**
```
https://signin.aws.amazon.com/saml
```

**Settings JSON:**
```json
{
  "audience": "urn:amazon:webservices",
  "mappings": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
  },
  "createUpnClaim": false,
  "passthroughClaimsWithNoMapping": false,
  "mapUnknownClaimsAsIs": false,
  "mapIdentities": false,
  "nameIdentifierFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  "nameIdentifierProbes": [
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
  ]
}
```

Click **Save**.

### Step 3: Download the SAML metadata

Still in the SAML2 addon:
1. Scroll down to find **Identity Provider Metadata**
2. Click the download link or copy the URL
3. Save as `auth0-saml-metadata.xml`

> This metadata file contains Auth0's signing certificate and SSO endpoint URL — AWS needs this to trust Auth0.

### Step 4: Create an Auth0 Action to add AWS role mapping

Go to **Actions → Library → Build Custom**:
- Name: `AWS SAML Role Mapping`
- Trigger: **Login / Post Login**

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Only add claims for the AWS SSO application
  if (event.client.name !== "AWS Console SSO") return;

  const AWS_ACCOUNT_ID = "YOUR_AWS_ACCOUNT_ID";
  const SAML_PROVIDER = "Auth0";

  // Map Auth0 roles to AWS IAM roles
  const roleMapping = {
    "admin": `arn:aws:iam::${AWS_ACCOUNT_ID}:role/Auth0-Admin`,
    "developer": `arn:aws:iam::${AWS_ACCOUNT_ID}:role/Auth0-Developer`,
    "readonly": `arn:aws:iam::${AWS_ACCOUNT_ID}:role/Auth0-ReadOnly`,
  };

  const userRoles = event.authorization?.roles || [];
  const awsRoles = [];

  for (const role of userRoles) {
    if (roleMapping[role]) {
      // AWS expects: role_arn,provider_arn format
      awsRoles.push(
        `${roleMapping[role]},arn:aws:iam::${AWS_ACCOUNT_ID}:saml-provider/${SAML_PROVIDER}`
      );
    }
  }

  if (awsRoles.length > 0) {
    // Set the SAML attributes AWS expects
    api.samlResponse.setAttribute(
      "https://aws.amazon.com/SAML/Attributes/Role",
      awsRoles
    );
    api.samlResponse.setAttribute(
      "https://aws.amazon.com/SAML/Attributes/RoleSessionName",
      event.user.email
    );
    api.samlResponse.setAttribute(
      "https://aws.amazon.com/SAML/Attributes/SessionDuration",
      "3600"
    );
  }
};
```

Deploy and add to the Post Login trigger flow.

---

## Part 3: Configure AWS

### Step 5: Create the SAML Identity Provider in AWS

```bash
# Upload Auth0's metadata to AWS
aws iam create-saml-provider \
    --saml-metadata-document file://auth0-saml-metadata.xml \
    --name Auth0
```

### Step 6: Create IAM roles that federated users can assume

```bash
# Trust policy for SAML-federated users
cat > saml-trust-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:saml-provider/Auth0"
            },
            "Action": "sts:AssumeRoleWithSAML",
            "Condition": {
                "StringEquals": {
                    "SAML:aud": "https://signin.aws.amazon.com/saml"
                }
            }
        }
    ]
}
EOF

# Create Admin role
aws iam create-role \
    --role-name Auth0-Admin \
    --assume-role-policy-document file://saml-trust-policy.json
aws iam attach-role-policy \
    --role-name Auth0-Admin \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Create Developer role
aws iam create-role \
    --role-name Auth0-Developer \
    --assume-role-policy-document file://saml-trust-policy.json
aws iam attach-role-policy \
    --role-name Auth0-Developer \
    --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Create ReadOnly role
aws iam create-role \
    --role-name Auth0-ReadOnly \
    --assume-role-policy-document file://saml-trust-policy.json
aws iam attach-role-policy \
    --role-name Auth0-ReadOnly \
    --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

---

## Part 4: Test the Federation

### Step 7: Test SAML login

1. In Auth0, go to your `AWS Console SSO` application
2. Copy the **Identity Provider Login URL** from the SAML addon (looks like `https://your-tenant.auth0.com/samlp/CLIENT_ID`)
3. Open this URL in a browser
4. Log in with an Auth0 user that has a mapped role
5. After authentication, Auth0 sends a SAML assertion to AWS
6. AWS validates it and logs you into the console with the mapped role

### Step 8: Verify the session

Once in the AWS Console:
1. Click your name in the top-right corner
2. You should see the role name (e.g., `Auth0-Developer`)
3. The session is temporary (1 hour as configured)

---

## Validation Checklist

- [ ] Auth0 SAML2 addon configured for AWS
- [ ] SAML metadata downloaded and uploaded to AWS
- [ ] AWS SAML provider created
- [ ] IAM roles created with SAML trust policies
- [ ] Auth0 Action maps roles to AWS IAM roles
- [ ] SAML login redirects to Auth0 and back to AWS Console
- [ ] Correct AWS role assumed based on Auth0 role

---

**Next Lab**: [Lab 05: OIDC Federation →](./lab-05-oidc-federation.md)
