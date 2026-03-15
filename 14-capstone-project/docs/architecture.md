# Capstone Architecture

## System Components

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript | User interface |
| Backend API | Express.js | Business logic, API |
| Auth Provider | Auth0 | Authentication, authorization |
| Database | PostgreSQL | Identity data, RBAC |
| Cache | Redis | Session cache, rate limiting |
| Infrastructure | AWS (CloudFormation) | Cloud hosting |
| CI/CD | GitHub Actions | Automated deployment |
| Monitoring | CloudWatch + Prometheus | Observability |

## Data Flow

1. User visits React SPA
2. Clicks Login -> Redirected to Auth0 Universal Login
3. Auth0 authenticates user -> Returns tokens
4. React stores tokens, calls Express API with access token
5. Express validates JWT using Auth0 JWKS
6. Express checks RBAC permissions from token
7. Express queries PostgreSQL (with RLS for multi-tenancy)
8. Response returned to React frontend
