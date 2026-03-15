# Lab 03: OIDC Federation for GitHub Actions

## Objective

Replace stored AWS access keys with OIDC federation. This lab focuses specifically on understanding and debugging the OIDC flow between GitHub Actions and AWS — building on what you learned in Module 09 Lab 05.

## Prerequisites

- AWS account
- A GitHub repository
- Basic understanding of JWTs from Module 02

## Estimated Time

30–40 minutes

---

## Part 1: How GitHub Actions OIDC Works

### The Token Flow

```
GitHub Actions Runner                GitHub OIDC Provider              AWS STS
───────────────────                  ────────────────────              ───────
1. Workflow starts
2. Request OIDC token ──────────→
3.                                   Generate JWT containing:
                                     - sub: repo:org/repo:ref:refs/heads/main
                                     - aud: sts.amazonaws.com
                                     - iss: token.actions.githubusercontent.com
4. Receive JWT ←─────────────────
5. Call AssumeRoleWithWebIdentity ─────────────────────────────────→
   (JWT + role ARN)
6.                                                                    Validate JWT:
                                                                      - Check signature
                                                                      - Verify issuer
                                                                      - Match subject
                                                                      - Check audience
7. ←─────────────────────────────────────────────────────────────────
   Temporary credentials (15 min - 1 hour)
```

### The JWT Claims

The GitHub OIDC token contains these claims:

| Claim | Example | Used For |
|---|---|---|
| `iss` | `https://token.actions.githubusercontent.com` | AWS verifies the issuer |
| `sub` | `repo:myorg/myrepo:ref:refs/heads/main` | Trust policy condition |
| `aud` | `sts.amazonaws.com` | Must match AWS OIDC config |
| `repository` | `myorg/myrepo` | Scoping access |
| `ref` | `refs/heads/main` | Branch-level restrictions |
| `environment` | `production` | Environment-level restrictions |
| `workflow` | `deploy.yml` | Workflow-level restrictions |

---

## Part 2: Set Up OIDC (Step by Step)

### Step 1: Create the OIDC provider in AWS

```bash
# Check if it already exists
aws iam list-open-id-connect-providers

# Create it if it doesn't exist
aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
```

### Step 2: Create a tightly-scoped trust policy

```bash
cat > github-oidc-trust.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": [
                        "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main",
                        "repo:YOUR_ORG/YOUR_REPO:environment:production",
                        "repo:YOUR_ORG/YOUR_REPO:environment:staging"
                    ]
                }
            }
        }
    ]
}
EOF
```

> **Tightest possible scope:** This trust policy only allows the `main` branch and the `production`/`staging` environments. Feature branches and other repos cannot assume this role.

### Step 3: Create the role

```bash
aws iam create-role \
    --role-name GitHubActions-Deploy \
    --assume-role-policy-document file://github-oidc-trust.json

# Attach deployment permissions
aws iam attach-role-policy \
    --role-name GitHubActions-Deploy \
    --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
```

### Step 4: Create a test workflow

Create `.github/workflows/oidc-test.yml`:

```yaml
name: OIDC Test

on:
  workflow_dispatch:  # Manual trigger for testing

permissions:
  id-token: write
  contents: read

jobs:
  test-oidc:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-Deploy
          aws-region: us-east-1

      - name: Verify identity
        run: |
          echo "=== AWS Identity ==="
          aws sts get-caller-identity

          echo ""
          echo "=== Can list ECS clusters? ==="
          aws ecs list-clusters

          echo ""
          echo "=== Can create IAM users? (should fail) ==="
          aws iam create-user --user-name test-should-fail 2>&1 || echo "Correctly denied!"
```

### Step 5: Run and verify

1. Go to **Actions → OIDC Test → Run workflow**
2. Check the output:
   - `get-caller-identity` shows the assumed role
   - ECS commands should succeed
   - IAM commands should fail (not in the role's permissions)

---

## Part 3: Debugging OIDC Issues

### Common Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Debug steps:**

1. Check the trust policy's `sub` condition matches your repo format exactly
2. Verify `permissions.id-token: write` is set in the workflow
3. Ensure the OIDC provider exists in the correct AWS account
4. Check for typos in the role ARN

### View the actual OIDC token

Add this step to your workflow to see what GitHub sends:

```yaml
- name: Debug OIDC token
  run: |
    TOKEN=$(curl -s -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r '.value')

    # Decode the JWT (don't do this in production!)
    echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

---

## Validation Checklist

- [ ] OIDC provider created in AWS
- [ ] Trust policy restricts to specific repo and branches
- [ ] GitHub Actions workflow uses `id-token: write` permission
- [ ] `configure-aws-credentials` action works with `role-to-assume`
- [ ] AWS commands succeed for allowed actions
- [ ] AWS commands fail for non-allowed actions
- [ ] No AWS access keys stored in GitHub Secrets

---

**Next Module**: [Module 13: Troubleshooting →](../../13-troubleshooting/README.md)
