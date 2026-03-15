# Lab 03: Cross-Account IAM Access

## Objective

Set up cross-account access so that users or services in one AWS account can securely access resources in another account. This is essential for organizations with multiple AWS accounts (dev, staging, prod). You'll use AssumeRole with ExternalId for secure delegation.

## Prerequisites

- Completed Labs 01-02
- Ideally two AWS accounts (or simulate with one account using different roles)
- AWS CLI configured

## Estimated Time

45–60 minutes

---

## Part 1: Why Cross-Account Access?

### The Multi-Account Pattern

Most organizations use multiple AWS accounts:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dev Account    │    │ Staging Account  │    │  Prod Account   │
│   111111111111   │    │   222222222222   │    │  333333333333   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Security Account    │
                    │   (users live here)   │
                    │     444444444444      │
                    └───────────────────────┘
```

Engineers log into the Security account and "assume roles" into other accounts as needed.

---

## Part 2: Set Up Cross-Account Role

### Step 1: Create the trust policy (in the target account)

This trust policy in Account B says "Account A is allowed to assume this role":

```bash
cd ~/iam-lab

# Replace ACCOUNT_A_ID with the account ID that will assume this role
cat > cross-account-trust.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::ACCOUNT_A_ID:root"
            },
            "Action": "sts:AssumeRole",
            "Condition": {
                "StringEquals": {
                    "sts:ExternalId": "identity-lab-xaccount-2026"
                },
                "Bool": {
                    "aws:MultiFactorAuthPresent": "true"
                }
            }
        }
    ]
}
EOF
```

> **ExternalId**: A shared secret between the two accounts. It prevents the "confused deputy" attack where a malicious third party tricks your service into assuming a role on their behalf. Always use ExternalId for cross-account roles.

> **MFA Required**: For production cross-account access, always require MFA. This ensures a compromised access key alone can't access another account.

### Step 2: Create the role (in the target account)

```bash
# In Account B (the account you want to access)
aws iam create-role \
    --role-name identity-lab-cross-account \
    --assume-role-policy-document file://cross-account-trust.json \
    --description "Cross-account role for identity lab - accessed from Account A" \
    --max-session-duration 3600

# Attach permissions
aws iam attach-role-policy \
    --role-name identity-lab-cross-account \
    --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

### Step 3: Grant AssumeRole in the source account

In Account A, create a policy that lets users assume the role in Account B:

```bash
cat > assume-cross-account-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "sts:AssumeRole",
            "Resource": "arn:aws:iam::ACCOUNT_B_ID:role/identity-lab-cross-account",
            "Condition": {
                "Bool": {
                    "aws:MultiFactorAuthPresent": "true"
                }
            }
        }
    ]
}
EOF

# Attach to a user or group in Account A
aws iam create-policy \
    --policy-name AllowAssumeIdentityLabCrossAccount \
    --policy-document file://assume-cross-account-policy.json
```

### Step 4: Assume the cross-account role

```bash
# From Account A, assume the role in Account B
aws sts assume-role \
    --role-arn arn:aws:iam::ACCOUNT_B_ID:role/identity-lab-cross-account \
    --role-session-name cross-account-test \
    --external-id "identity-lab-xaccount-2026" \
    --serial-number arn:aws:iam::ACCOUNT_A_ID:mfa/your-username \
    --token-code 123456

# Use the returned temporary credentials to access Account B's resources
```

### Step 5: Set up CLI profiles for easy switching

```bash
# Add to ~/.aws/config
cat >> ~/.aws/config << 'EOF'

[profile account-b-readonly]
role_arn = arn:aws:iam::ACCOUNT_B_ID:role/identity-lab-cross-account
source_profile = default
external_id = identity-lab-xaccount-2026
mfa_serial = arn:aws:iam::ACCOUNT_A_ID:mfa/your-username
region = us-east-1
EOF

# Now you can easily switch:
aws s3 ls --profile account-b-readonly
# AWS CLI handles the AssumeRole automatically!
```

---

## Part 3: Session Policies (Limiting Assumed Role)

### Step 6: Use session policies to further restrict

Even if a role has broad permissions, you can restrict what a specific session can do:

```bash
cat > session-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:GetObject", "s3:ListBucket"],
            "Resource": "*"
        }
    ]
}
EOF

# Assume role with session policy — can only do S3 reads
# even if the role allows more
aws sts assume-role \
    --role-arn arn:aws:iam::ACCOUNT_B_ID:role/identity-lab-cross-account \
    --role-session-name restricted-session \
    --external-id "identity-lab-xaccount-2026" \
    --policy file://session-policy.json
```

> **Session policies** are the intersection of the role's permissions and the session policy. The session can only do what BOTH allow. This is useful for granting temporary, scoped access.

---

## Validation Checklist

- [ ] Cross-account role created with trust policy referencing source account
- [ ] ExternalId condition set for confused deputy prevention
- [ ] MFA required in both trust and source policies
- [ ] Successfully assumed the role from the source account
- [ ] CLI profile configured for easy cross-account switching
- [ ] Session policies correctly restrict permissions below role level
- [ ] Verified that access without ExternalId fails

---

## Key Takeaways

1. **Never share access keys** between accounts — use AssumeRole
2. **Always use ExternalId** for cross-account roles (confused deputy prevention)
3. **Require MFA** for cross-account access in production
4. **Session policies** let you scope down permissions per session
5. **CLI profiles** make cross-account work seamless

---

**Next Lab**: [Lab 04: SAML Federation →](./lab-04-saml-federation.md)
