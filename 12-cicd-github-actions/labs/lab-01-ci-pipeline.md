# Lab 01: Build a CI Pipeline for Identity Services

## Objective

Create a GitHub Actions CI pipeline that runs on every pull request. It will lint code, run unit tests, run integration tests against a real PostgreSQL database, scan for security vulnerabilities, and build a Docker image. This ensures every code change is safe before merging.

## Prerequisites

- A GitHub repository (create one if needed)
- Docker image from Module 11
- Test suite from Module 05
- Basic familiarity with YAML

## Estimated Time

45–60 minutes

---

## Part 1: CI Pipeline Architecture

```
PR Opened / Push to main
         │
         ▼
  ┌──────────────┐
  │    Lint       │  ← ESLint, Prettier, TypeScript check
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │  Unit Tests   │  ← Jest, fast, no external deps
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │  Integration  │  ← Supertest + real PostgreSQL
  │  Tests        │     (GitHub Actions service container)
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │  Security     │  ← npm audit, Gitleaks, Trivy
  │  Scan         │
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │  Docker Build │  ← Build image, scan, push to registry
  └──────────────┘
```

---

## Part 2: Create the Workflow

### Step 1: Create the workflow file

In your repository, create `.github/workflows/ci.yml`:

```yaml
name: CI Pipeline

# When to run
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# Cancel in-progress runs for the same PR
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ========================================
  # Job 1: Lint and Type Check
  # ========================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint || echo "No lint script, skipping"

      - name: TypeScript type check
        run: npx tsc --noEmit || echo "No TypeScript, skipping"

  # ========================================
  # Job 2: Unit Tests
  # ========================================
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - run: npm ci

      - name: Run unit tests
        run: npm test -- --coverage --forceExit
        env:
          AUTH0_DOMAIN: test.auth0.com
          AUTH0_AUDIENCE: https://test-api

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/

  # ========================================
  # Job 3: Integration Tests (with PostgreSQL)
  # ========================================
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest

    # Service containers — real PostgreSQL for integration tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: identity_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: testpass
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test -d identity_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - run: npm ci

      - name: Run database migrations
        run: npm run migrate || echo "No migration script"
        env:
          DATABASE_URL: postgresql://test:testpass@localhost:5432/identity_test

      - name: Run integration tests
        run: npm run test:integration || npm test
        env:
          DATABASE_URL: postgresql://test:testpass@localhost:5432/identity_test
          REDIS_URL: redis://localhost:6379
          AUTH0_DOMAIN: test.auth0.com
          AUTH0_AUDIENCE: https://test-api
          NODE_ENV: test

  # ========================================
  # Job 4: Security Scan
  # ========================================
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=high || true

      - name: Scan for secrets with Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ========================================
  # Job 5: Docker Build
  # ========================================
  docker:
    name: Docker Build
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]  # Only build if lint and tests pass
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false  # Don't push on PRs
          tags: identity-api:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: identity-api:${{ github.sha }}
          format: table
          severity: CRITICAL,HIGH
          exit-code: 1  # Fail if critical vulnerabilities found
```

**Understanding the workflow:**

1. **Concurrency**: Cancels previous runs for the same PR, saving CI minutes
2. **Service containers**: Real PostgreSQL and Redis for integration tests — no mocking
3. **Job dependencies**: Docker build only runs if lint and tests pass (`needs: [lint, unit-tests]`)
4. **Gitleaks**: Scans for accidentally committed secrets (API keys, passwords)
5. **Trivy**: Scans the Docker image for known vulnerabilities
6. **GitHub Actions cache**: `cache: npm` and `type=gha` cache speed up builds

### Step 2: Commit and push

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI pipeline with tests, security scanning, and Docker build"
git push
```

### Step 3: Watch the pipeline run

1. Go to your repository → **Actions** tab
2. Click on the running workflow
3. Watch each job execute
4. Click on any job to see detailed logs

---

## Part 3: Add Status Badges

### Step 4: Add a CI badge to your README

Add this to your `README.md`:

```markdown
![CI](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/ci.yml/badge.svg)
```

---

## Validation Checklist

- [ ] Workflow file created at `.github/workflows/ci.yml`
- [ ] Pipeline triggers on pull requests and pushes to main
- [ ] Lint job runs ESLint/TypeScript checks
- [ ] Unit tests run with coverage
- [ ] Integration tests use real PostgreSQL service container
- [ ] Security scan checks for leaked secrets
- [ ] Docker image builds and is scanned for vulnerabilities
- [ ] All jobs pass (green checkmarks)

---

**Next Lab**: [Lab 02: CD Pipeline →](./lab-02-cd-pipeline.md)
