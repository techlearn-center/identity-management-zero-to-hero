# Lab 02: Build a CD Pipeline — Deploy to AWS ECS

## Objective

Create a Continuous Deployment pipeline that automatically deploys your identity service to AWS ECS Fargate when code is merged to main. Includes staging/production environments, approval gates, smoke tests, and rollback.

## Prerequisites

- Completed Lab 01 (CI pipeline)
- AWS account with ECS, ECR, and IAM configured
- OIDC federation from Module 09 Lab 05 (recommended) or AWS access keys

## Estimated Time

60–75 minutes

---

## Part 1: CD Pipeline Architecture

```
Merge to main
      │
      ▼
┌───────────┐    ┌──────────────┐    ┌───────────────┐
│ Build &   │───→│ Deploy to    │───→│ Smoke Tests   │
│ Push Image│    │ Staging      │    │ (Staging)     │
└───────────┘    └──────────────┘    └───────┬───────┘
                                              │
                                     ┌────────▼────────┐
                                     │ Manual Approval  │
                                     │ (GitHub Issue)   │
                                     └────────┬────────┘
                                              │
                                     ┌────────▼────────┐    ┌──────────────┐
                                     │ Deploy to       │───→│ Smoke Tests  │
                                     │ Production      │    │ (Production) │
                                     └─────────────────┘    └──────────────┘
```

---

## Part 2: Set Up AWS Resources

### Step 1: Create an ECR repository

```bash
aws ecr create-repository \
    --repository-name identity-lab/api \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256
```

### Step 2: Note the repository URI

```bash
ECR_URI=$(aws ecr describe-repositories \
    --repository-names identity-lab/api \
    --query 'repositories[0].repositoryUri' \
    --output text)
echo "ECR URI: $ECR_URI"
```

---

## Part 3: Create the CD Workflow

### Step 3: Create the workflow file

Create `.github/workflows/cd.yml`:

```yaml
name: CD Pipeline

on:
  push:
    branches: [main]

permissions:
  id-token: write    # OIDC authentication
  contents: read

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: identity-lab/api
  ECS_CLUSTER: identity-lab
  ECS_SERVICE_STAGING: identity-api-staging
  ECS_SERVICE_PROD: identity-api-prod
  TASK_DEFINITION: identity-api

jobs:
  # ========================================
  # Job 1: Build and Push Docker Image
  # ========================================
  build:
    name: Build & Push Image
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.build.outputs.image }}
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-IdentityLab
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        id: build
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          IMAGE="$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
          docker build -t $IMAGE .
          docker push $IMAGE
          echo "image=$IMAGE" >> $GITHUB_OUTPUT

  # ========================================
  # Job 2: Deploy to Staging
  # ========================================
  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-IdentityLab
          aws-region: ${{ env.AWS_REGION }}

      - name: Update ECS service
        run: |
          # Get current task definition
          TASK_DEF=$(aws ecs describe-task-definition \
            --task-definition $TASK_DEFINITION \
            --query 'taskDefinition' --output json)

          # Update the image in the task definition
          NEW_TASK_DEF=$(echo $TASK_DEF | jq \
            --arg IMAGE "${{ needs.build.outputs.image }}" \
            '.containerDefinitions[0].image = $IMAGE |
             del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

          # Register new task definition
          NEW_TASK_ARN=$(aws ecs register-task-definition \
            --cli-input-json "$NEW_TASK_DEF" \
            --query 'taskDefinition.taskDefinitionArn' --output text)

          # Update the service
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE_STAGING \
            --task-definition $NEW_TASK_ARN \
            --force-new-deployment

          # Wait for deployment to stabilize
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE_STAGING

      - name: Smoke test staging
        run: |
          STAGING_URL="https://staging-api.identity-lab.example.com"

          # Health check
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/health")
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed! Status: $STATUS"
            exit 1
          fi

          # Public endpoint
          RESPONSE=$(curl -s "$STAGING_URL/api/public")
          echo "Public endpoint response: $RESPONSE"

          echo "Staging smoke tests passed!"

  # ========================================
  # Job 3: Deploy to Production (with approval)
  # ========================================
  deploy-production:
    name: Deploy to Production
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-IdentityLab
          aws-region: ${{ env.AWS_REGION }}

      - name: Update ECS service (production)
        run: |
          TASK_DEF=$(aws ecs describe-task-definition \
            --task-definition $TASK_DEFINITION \
            --query 'taskDefinition' --output json)

          NEW_TASK_DEF=$(echo $TASK_DEF | jq \
            --arg IMAGE "${{ needs.build.outputs.image }}" \
            '.containerDefinitions[0].image = $IMAGE |
             del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

          NEW_TASK_ARN=$(aws ecs register-task-definition \
            --cli-input-json "$NEW_TASK_DEF" \
            --query 'taskDefinition.taskDefinitionArn' --output text)

          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE_PROD \
            --task-definition $NEW_TASK_ARN \
            --force-new-deployment

          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE_PROD

      - name: Smoke test production
        run: |
          PROD_URL="https://api.identity-lab.example.com"
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health")
          if [ "$STATUS" != "200" ]; then
            echo "PRODUCTION HEALTH CHECK FAILED! Rolling back..."
            exit 1
          fi
          echo "Production smoke tests passed!"
```

### Step 4: Set up GitHub Environments

1. Go to your repo → **Settings → Environments**
2. Create `staging` environment (no protection rules needed)
3. Create `production` environment:
   - Check **Required reviewers**
   - Add yourself as a reviewer
   - Optionally: Add a wait timer (e.g., 5 minutes)

This means production deployments will pause and wait for manual approval.

---

## Validation Checklist

- [ ] ECR repository created
- [ ] CD workflow triggers on push to main
- [ ] Docker image built and pushed to ECR with commit SHA tag
- [ ] Staging deployment updates ECS service
- [ ] Staging smoke tests pass
- [ ] Production deployment requires manual approval
- [ ] Production smoke tests pass after deployment
- [ ] OIDC used for AWS authentication (no stored keys)

---

**Next Lab**: [Lab 03: OIDC Federation for CI/CD →](./lab-03-oidc-federation.md)
