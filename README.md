# Identity Management: Zero to Hero

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Auth0](https://img.shields.io/badge/Auth0-EB5424?logo=auth0&logoColor=white)](https://auth0.com)
[![AWS](https://img.shields.io/badge/AWS-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io)

> A comprehensive, hands-on learning path that takes you from IAM fundamentals to production-ready identity platforms. Designed to make you **job-ready** as an Identity Management Specialist.

---

## Learning Path

```
┌─────────────────────────────────────────────────────────────────────┐
│                    IDENTITY MANAGEMENT: ZERO TO HERO                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 1: FOUNDATIONS (Weeks 1-3)                                   │
│  ┌──────────────┐  ┌──────────────────────┐                        │
│  │ 01 IAM       │──│ 02 Auth Protocols    │                        │
│  │ Fundamentals │  │ OIDC / SAML / OAuth2 │                        │
│  └──────────────┘  └──────────────────────┘                        │
│         │                    │                                       │
│         ▼                    ▼                                       │
│  PHASE 2: AUTH0 MASTERY (Weeks 4-6)                                │
│  ┌──────────────┐  ┌──────────────────────┐                        │
│  │ 03 Auth0     │──│ 04 Auth0 Advanced    │                        │
│  │ Fundamentals │  │ SSO/MFA/Actions      │                        │
│  └──────────────┘  └──────────────────────┘                        │
│         │                    │                                       │
│         ▼                    ▼                                       │
│  PHASE 3: INTEGRATION (Weeks 7-9)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ 05 Identity  │──│ 06 API       │──│ 07 React     │             │
│  │ Testing      │  │ Integration  │  │ Frontend     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│         │                    │                                       │
│         ▼                    ▼                                       │
│  PHASE 4: DATA & CLOUD (Weeks 10-12)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ 08 PostgreSQL│──│ 09 AWS IAM   │──│ 10 AWS Infra │             │
│  │ Identity     │  │ Deep Dive    │  │ CloudFormation│             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│         │                    │                                       │
│         ▼                    ▼                                       │
│  PHASE 5: DEPLOYMENT & OPS (Weeks 13-15)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ 11 Docker &  │──│ 12 CI/CD     │──│ 13 Trouble-  │             │
│  │ Kubernetes   │  │ GitHub Actions│  │ shooting     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│         │                                                           │
│         ▼                                                           │
│  PHASE 6: CAPSTONE (Weeks 16-18)                                   │
│  ┌─────────────────────────────────────────────┐                   │
│  │ 14 CAPSTONE PROJECT                         │                   │
│  │ Full Identity Platform: Auth0 + React +     │                   │
│  │ Express + PostgreSQL + AWS + K8s + CI/CD    │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Prerequisite | Level | Resources |
|---|---|---|
| HTTP/HTTPS basics | Beginner | [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP) |
| JavaScript/Node.js | Intermediate | [Node.js Docs](https://nodejs.org/en/docs/) |
| Python basics | Beginner | [Python Tutorial](https://docs.python.org/3/tutorial/) |
| SQL fundamentals | Beginner | [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) |
| AWS free-tier account | Setup | [AWS Free Tier](https://aws.amazon.com/free/) |
| Auth0 free account | Setup | [Auth0 Signup](https://auth0.com/signup) |
| Docker installed | Setup | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Git & GitHub account | Beginner | [GitHub Docs](https://docs.github.com/) |

---

## Module Overview

### Phase 1: Foundations

| Module | Description | Est. Time | Key Skills |
|---|---|---|---|
| [01 - IAM Fundamentals](./01-iam-fundamentals/) | Core concepts: AuthN vs AuthZ, RBAC, ABAC, Zero Trust, identity lifecycle | 8 hrs | IAM, RBAC, Zero Trust |
| [02 - Authentication Protocols](./02-authentication-protocols/) | Deep dive into OAuth 2.0, OpenID Connect, SAML 2.0, JWT | 12 hrs | OIDC, SAML, OAuth2, JWT |

### Phase 2: Auth0 Mastery

| Module | Description | Est. Time | Key Skills |
|---|---|---|---|
| [03 - Auth0 Fundamentals](./03-auth0-fundamentals/) | Tenant setup, applications, connections, Universal Login, Management API | 10 hrs | Auth0, Identity Provider |
| [04 - Auth0 Advanced](./04-auth0-advanced/) | SSO, MFA, Actions, Organizations, user migration, attack protection | 12 hrs | SSO, MFA, Auth0 Actions |

### Phase 3: Integration

| Module | Description | Est. Time | Key Skills |
|---|---|---|---|
| [05 - Identity Testing](./05-identity-testing/) | Unit, integration, E2E, security, and load testing for identity systems | 10 hrs | Testing, Security Testing |
| [06 - API Integration](./06-api-integration/) | Securing Express.js and FastAPI backends with Auth0 | 10 hrs | API Security, Express, FastAPI |
| [07 - React Frontend](./07-react-frontend/) | Auth0 SPA SDK, protected routes, role-based UI, token management | 8 hrs | ReactJS, SPA Security |

### Phase 4: Data & Cloud

| Module | Description | Est. Time | Key Skills |
|---|---|---|---|
| [08 - PostgreSQL Identity](./08-postgresql-identity/) | Identity schemas, RBAC tables, RLS, audit logging, encryption | 10 hrs | PostgreSQL, SQL, Database |
| [09 - AWS IAM Deep Dive](./09-aws-iam/) | IAM policies, roles, federation (SAML/OIDC), Identity Center, Access Analyzer | 12 hrs | AWS IAM, Federation |
| [10 - AWS Infrastructure](./10-aws-infrastructure/) | CloudFormation, Lambda authorizers, API Gateway, ECS, CloudWatch | 14 hrs | CloudFormation, AWS Services |

### Phase 5: Deployment & Operations

| Module | Description | Est. Time | Key Skills |
|---|---|---|---|
| [11 - Docker & Kubernetes](./11-docker-kubernetes/) | Containerization, K8s deployments, Helm charts, secrets management | 12 hrs | Docker, Kubernetes, Helm |
| [12 - CI/CD GitHub Actions](./12-cicd-github-actions/) | CI/CD pipelines, OIDC federation, release automation, security scanning | 10 hrs | GitHub Actions, CI/CD |
| [13 - Troubleshooting](./13-troubleshooting/) | Debugging OIDC/SAML, runbooks, monitoring, incident response | 8 hrs | Troubleshooting, Monitoring |

### Phase 6: Capstone

| Module | Description | Est. Time | Key Skills |
|---|---|---|---|
| [14 - Capstone Project](./14-capstone-project/) | Build a complete multi-tenant identity platform from scratch | 20 hrs | All Skills Combined |

**Total Estimated Time: ~156 hours (~18 weeks at 8-10 hrs/week)**

---

## Skills Covered → Job Requirements Mapping

| Job Requirement | Modules | Depth |
|---|---|---|
| **Auth0** | 03, 04, 06, 07, 14 | Deep |
| **OIDC (OpenID Connect)** | 02, 03, 04, 09, 13 | Deep |
| **SAML** | 02, 03, 04, 09, 13 | Deep |
| **Testing (Identity/Auth)** | 05, 06 | Deep |
| **IAM Frameworks** | 01, 09 | Deep |
| **Kubernetes** | 11, 14 | Intermediate |
| **Docker** | 11, 12, 14 | Intermediate |
| **ReactJS** | 07, 14 | Intermediate |
| **GitHub / GitHub Actions** | 12, 14 | Intermediate |
| **PostgreSQL / SQL** | 08, 14 | Intermediate |
| **Release Automation** | 12 | Intermediate |
| **AWS EC2 / ECS** | 10, 11, 12 | Intermediate |
| **AWS S3 / VPC / IAM** | 09, 10 | Intermediate |
| **CloudFormation (YAML)** | 10, 14 | Intermediate |
| **CloudWatch** | 10, 13 | Intermediate |
| **API Gateway** | 10, 14 | Intermediate |
| **AWS Lambda** | 10, 14 | Intermediate |
| **AWS Batch** | 10 | Introductory |
| **AWS SageMaker** | 10 | Introductory |
| **Troubleshooting** | 13 | Deep |
| **Documentation** | All | Continuous |

---

## How to Use This Repo

### Sequential Learning (Recommended)
Follow the modules in order — each builds on the previous:

```bash
# Clone the repo
git clone https://github.com/techlearn-center/identity-management-zero-to-hero.git
cd identity-management-zero-to-hero

# Start with Module 01
cd 01-iam-fundamentals
# Read README.md, then work through labs in order
```

### Targeted Learning
Jump to specific modules based on your needs:
- **New to IAM?** → Start at Module 01
- **Know IAM, learning Auth0?** → Start at Module 03
- **Building integrations?** → Modules 06-07
- **Deploying to production?** → Modules 10-12
- **Interview prep?** → Review all module READMEs + do the Capstone

### Each Module Contains
- **README.md** — Concepts, theory, architecture, and reference material
- **labs/** — Hands-on exercises with step-by-step instructions
- **examples/** or **scripts/** — Working code samples and automation scripts
- **config/** or **schemas/** — Configuration files and templates

---

## Repository Structure

```
identity-management-zero-to-hero/
├── README.md                          # This file
├── 01-iam-fundamentals/               # IAM concepts, RBAC, Zero Trust
├── 02-authentication-protocols/       # OAuth2, OIDC, SAML, JWT
├── 03-auth0-fundamentals/             # Auth0 setup, connections, Universal Login
├── 04-auth0-advanced/                 # SSO, MFA, Actions, Organizations
├── 05-identity-testing/               # Unit, integration, E2E, security testing
├── 06-api-integration/                # Express + FastAPI with Auth0
├── 07-react-frontend/                 # React SPA with Auth0
├── 08-postgresql-identity/            # Identity database design
├── 09-aws-iam/                        # AWS IAM policies, roles, federation
├── 10-aws-infrastructure/             # CloudFormation, Lambda, API Gateway
├── 11-docker-kubernetes/              # Containers, K8s, Helm charts
├── 12-cicd-github-actions/            # CI/CD pipelines, release automation
├── 13-troubleshooting/                # Debugging, monitoring, incident response
├── 14-capstone-project/               # Full identity platform project
└── .github/workflows/                 # CI pipeline for this repo
```

---

## Tools & Accounts You'll Need

| Tool | Purpose | Cost |
|---|---|---|
| [Auth0](https://auth0.com/signup) | Identity Provider | Free tier |
| [AWS Account](https://aws.amazon.com/free/) | Cloud infrastructure | Free tier |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Containerization | Free |
| [Node.js 20+](https://nodejs.org/) | JavaScript runtime | Free |
| [Python 3.11+](https://www.python.org/) | Python runtime | Free |
| [PostgreSQL 15+](https://www.postgresql.org/) | Database | Free |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | Kubernetes CLI | Free |
| [Helm](https://helm.sh/) | K8s package manager | Free |
| [AWS CLI v2](https://aws.amazon.com/cli/) | AWS command line | Free |
| [Postman](https://www.postman.com/) | API testing | Free tier |

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-lab`)
3. Commit your changes (`git commit -m 'Add new lab for X'`)
4. Push to the branch (`git push origin feature/new-lab`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Auth0 Documentation](https://auth0.com/docs)
- [AWS IAM Documentation](https://docs.aws.amazon.com/IAM/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OpenID Connect Specification](https://openid.net/connect/)
- [SAML 2.0 Specification](http://docs.oasis-open.org/security/saml/v2.0/)

---

> **Built with purpose** — Every module, lab, and code sample in this repository is designed to build practical, job-ready skills for Identity Management Specialist roles.
