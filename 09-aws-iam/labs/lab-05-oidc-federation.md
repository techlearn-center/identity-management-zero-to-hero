# Lab 05: OIDC Federation for GitHub Actions

## Objective
Configure OIDC identity provider in AWS for GitHub Actions (no static credentials).

## Steps
1. Create OIDC provider in AWS IAM for GitHub
2. Create IAM role with OIDC trust policy
3. Configure GitHub Actions workflow to assume role
4. Deploy to AWS without access keys

## GitHub Actions Workflow
```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/GitHubActions-Deploy
          aws-region: us-east-1
      - run: aws s3 ls  # Uses temporary credentials
```
