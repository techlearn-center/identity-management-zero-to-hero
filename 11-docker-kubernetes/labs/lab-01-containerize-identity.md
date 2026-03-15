# Lab 01: Containerize Identity Service

## Objective
Build production Docker images for the identity API using multi-stage builds.

## Steps
1. Review Dockerfile.express multi-stage build
2. Build: `docker build -f Dockerfile.express -t identity-api:latest .`
3. Run: `docker run -p 3001:3001 --env-file .env identity-api:latest`
4. Test health endpoint
5. Run full stack with docker-compose
6. Verify non-root user, health checks, image size
