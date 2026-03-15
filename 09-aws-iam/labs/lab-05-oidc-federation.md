# Lab 05: OIDC Federation — GitHub Actions to AWS

## Objective

Set up OpenID Connect (OIDC) federation so GitHub Actions workflows can access AWS without storing long-lived credentials. This is the modern, recommended way to authenticate CI/CD pipelines with AWS.

## Prerequisites

- AWS account with admin access
- A GitHub repository (public or private)
- Basic familiarity with GitHub Actions

## Estimated Time

30–45 minutes

---

## Part 1: Why OIDC Instead of Access Keys?

### The Problem with Access Keys in CI/CD

```
Old way (bad):
  GitHub Secret: AWS_ACCESS_KEY_ID = AKIA...
  GitHub Secret: AWS_SECRET_ACCESS_KEY = wJalr...
  Problems:
    - Keys are long-lived (don't expire)
    - Stored in GitHub (another attack surface)
    - Must be rotated manually
    - One key can access everything the user can
```

### The OIDC Way (good)

```
New way (OIDC):
  GitHub Actions ──→ "I am repo:owner/repo, branch:main, workflow:deploy"
                       (signed JWT from GitHub's OIDC provider)
  AWS ──→ Verifies the JWT signature
  AWS ──→ Checks: "Is this repo/branch allowed to assume this role?"
  AWS ──→ Issues temporary credentials (15 min - 1 hour)
```

No secrets stored anywhere. Credentials are temporary. Access is scoped to specific repos and branches.

---

## Part 2: Configure AWS

### Step 1: Create the OIDC Identity Provider

```bash
# Tell AWS to trust GitHub's OIDC provider
aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
```

> **Thumbprint**: This is the TLS certificate thumbprint of GitHub's OIDC endpoint. AWS uses it to verify that tokens really come from GitHub. As of 2024, AWS auto-validates GitHub's certificate, but the thumbprint is still required in the API call.

### Step 2: Create an IAM role for GitHub Actions

```bash
# Trust policy scoped to your specific repository
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
                    "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
                }
            }
        }
    ]
}
EOF

# Create the role
aws iam create-role \
    --role-name GitHubActions-IdentityLab \
    --assume-role-policy-document file://github-oidc-trust.json \
    --description "Role for GitHub Actions OIDC - identity lab repo"
```

**Understanding the trust conditions:**

| Condition | Purpose |
|---|---|
| `aud: sts.amazonaws.com` | Ensures the token was requested for AWS |
| `sub: repo:YOUR_ORG/YOUR_REPO:*` | Only this repo can assume the role |

### Step 3: Restrict to specific branches (production best practice)

For production, restrict which branches can deploy:

```json
{
    "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main"
    }
}
```

This means only the `main` branch can assume this role. Pull request branches and feature branches cannot.

### Step 4: Attach permissions to the role

```bash
# Example: Allow deploying to ECS and reading ECR
cat > github-deploy-permissions.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ECRLogin",
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload"
            ],
            "Resource": "*"
        },
        {
            "Sid": "ECSUpdate",
            "Effect": "Allow",
            "Action": [
                "ecs:UpdateService",
                "ecs:DescribeServices",
                "ecs:RegisterTaskDefinition",
                "ecs:DescribeTaskDefinition"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:ResourceTag/Project": "identity-lab"
                }
            }
        },
        {
            "Sid": "PassRole",
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/identity-lab-ecs-*"
        }
    ]
}
EOF

aws iam put-role-policy \
    --role-name GitHubActions-IdentityLab \
    --policy-name deploy-permissions \
    --policy-document file://github-deploy-permissions.json
```

---

## Part 3: Configure GitHub Actions

### Step 5: Create the workflow

In your GitHub repository, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

# REQUIRED: This grants the workflow permission to request an OIDC token
permissions:
  id-token: write   # Needed for OIDC
  contents: read     # Needed to checkout code

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-IdentityLab
          aws-region: us-east-1
          # No access keys needed!

      - name: Verify AWS identity
        run: |
          aws sts get-caller-identity
          echo "Successfully authenticated via OIDC!"

      - name: Deploy (example)
        run: |
          echo "Deploying from branch: ${{ github.ref }}"
          # aws ecs update-service ...
```

**Key points:**
- `permissions.id-token: write` — required for the workflow to request an OIDC token
- `role-to-assume` — the ARN of the role we created
- No `aws-access-key-id` or `aws-secret-access-key` — OIDC handles it

### Step 6: Test the workflow

1. Commit and push the workflow file
2. Go to your repo → Actions tab
3. Watch the workflow run
4. The "Verify AWS identity" step should show:
   ```
   {
       "UserId": "AROA...:GitHubActions",
       "Account": "YOUR_ACCOUNT_ID",
       "Arn": "arn:aws:sts::YOUR_ACCOUNT_ID:assumed-role/GitHubActions-IdentityLab/GitHubActions"
   }
   ```

### Step 7: Verify branch restriction works

1. Create a feature branch and push the same workflow
2. The `configure-aws-credentials` step should **fail** if you restricted to `main` only
3. Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

---

## Validation Checklist

- [ ] OIDC provider created in AWS for `token.actions.githubusercontent.com`
- [ ] IAM role created with trust policy scoped to your repo
- [ ] Branch restrictions configured in the trust policy
- [ ] GitHub Actions workflow uses `aws-actions/configure-aws-credentials@v4`
- [ ] `permissions.id-token: write` set in workflow
- [ ] Workflow successfully authenticates and runs AWS commands
- [ ] Non-authorized branches are rejected

---

## Key Takeaways

1. **OIDC eliminates stored secrets** — no access keys in GitHub
2. **Credentials are temporary** — typically 1 hour, auto-expire
3. **Scope trust tightly** — restrict to specific repos, branches, and environments
4. **Works with any OIDC provider** — GitHub, GitLab, Bitbucket, CircleCI all support this
5. **This is the AWS-recommended approach** for all CI/CD integrations

---

**Next Module**: [Module 10: AWS Infrastructure →](../../10-aws-infrastructure/README.md)
