# Module 14: Capstone Project — Build a Complete Identity Platform

## Overview

Build a production-ready, multi-tenant identity platform that demonstrates all skills learned throughout this course. This project ties together Auth0, React, Express, PostgreSQL, AWS, Docker, Kubernetes, and CI/CD.

## Architecture

```
                                    ┌──────────────────────┐
                                    │     Auth0 Tenant     │
                                    │  (Authentication)    │
                                    └──────────┬───────────┘
                                               │
┌──────────────┐     ┌──────────────┐     ┌────┴──────────┐     ┌──────────────┐
│   React SPA  │────▶│ API Gateway  │────▶│  Express API  │────▶│  PostgreSQL  │
│  (Frontend)  │     │ (JWT Auth)   │     │  (Backend)    │     │  (Database)  │
│              │     │              │     │              │     │  + RLS       │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                               │
                                    ┌──────────┴───────────┐
                                    │   CloudWatch/Grafana  │
                                    │    (Monitoring)       │
                                    └──────────────────────┘
```

## Features to Build

### Phase 1: Core Identity (Week 1-2)
- [ ] Auth0 tenant setup with RBAC
- [ ] React frontend with Auth0 login/logout
- [ ] Express API with JWT validation
- [ ] PostgreSQL identity schema

### Phase 2: Multi-Tenancy (Week 3)
- [ ] Auth0 Organizations for B2B
- [ ] Row-Level Security in PostgreSQL
- [ ] Organization management UI

### Phase 3: Security & Testing (Week 4)
- [ ] MFA enrollment
- [ ] Auth0 Actions (enrichment, validation)
- [ ] Unit + integration + E2E tests
- [ ] Security testing

### Phase 4: Infrastructure (Week 5)
- [ ] Docker containers (multi-stage)
- [ ] CloudFormation templates
- [ ] ECS Fargate deployment
- [ ] CloudWatch monitoring

### Phase 5: CI/CD & Production (Week 6)
- [ ] GitHub Actions CI/CD pipeline
- [ ] OIDC federation for AWS
- [ ] Release automation
- [ ] Operational runbooks

## Acceptance Criteria

- Users can register, login, logout with Auth0
- MFA can be enabled per user
- RBAC controls access to features
- Organizations isolate tenant data
- API validates JWT tokens properly
- Database uses Row-Level Security
- Application runs in Docker containers
- Infrastructure defined as CloudFormation
- CI/CD pipeline automates deployment
- Monitoring detects auth failures
- Runbooks cover common issues

## Getting Started

```bash
# Clone and setup
cd 14-capstone-project
cp .env.example .env
# Edit .env with your Auth0 credentials

# Start local development
docker compose up -d

# Run backend
cd backend/express-api && npm install && npm run dev

# Run frontend
cd frontend && npm install && npm run dev
```

## Evaluation

This capstone demonstrates competency in:
- Auth0 configuration and integration
- OIDC/SAML protocol understanding
- Identity testing (unit, integration, E2E, security)
- PostgreSQL identity schema design
- AWS IAM and infrastructure
- Docker and Kubernetes
- CI/CD with GitHub Actions
- Production troubleshooting
