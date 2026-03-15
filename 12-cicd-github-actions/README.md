# Module 12: CI/CD with GitHub Actions

## Overview
Build CI/CD pipelines for identity services: automated testing, security scanning, Docker builds, and deployment to AWS with OIDC federation (no static credentials).

## Workflows
| Workflow | Description |
|---|---|
| [ci.yaml](./workflows/ci.yaml) | CI: lint, test, security scan |
| [cd-ecs.yaml](./workflows/cd-ecs.yaml) | CD: deploy to ECS |
| [security-scan.yaml](./workflows/security-scan.yaml) | Security scanning |
| [release.yaml](./workflows/release.yaml) | Release automation |

## Hands-On Labs
| Lab | Description |
|---|---|
| [Lab 01: CI Pipeline](./labs/lab-01-ci-pipeline.md) | Build CI pipeline |
| [Lab 02: CD Pipeline](./labs/lab-02-cd-pipeline.md) | Build CD pipeline |
| [Lab 03: OIDC Federation](./labs/lab-03-oidc-federation.md) | GitHub OIDC for AWS |

**Next Module**: [13 - Troubleshooting ->](../13-troubleshooting/)
