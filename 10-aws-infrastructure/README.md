# Module 10: AWS Infrastructure for Identity Services

## Overview
Deploy identity infrastructure on AWS using CloudFormation: VPCs, RDS PostgreSQL, Lambda authorizers, API Gateway with JWT validation, ECS Fargate, and CloudWatch monitoring.

## CloudFormation Templates
| Template | Description |
|---|---|
| [vpc-identity.yaml](./cloudformation/vpc-identity.yaml) | VPC with public/private subnets |
| [rds-postgresql.yaml](./cloudformation/rds-postgresql.yaml) | RDS PostgreSQL for identity |
| [lambda-authorizer.yaml](./cloudformation/lambda-authorizer.yaml) | Lambda JWT authorizer |
| [api-gateway-auth.yaml](./cloudformation/api-gateway-auth.yaml) | API Gateway with auth |
| [ecs-identity-service.yaml](./cloudformation/ecs-identity-service.yaml) | ECS Fargate service |
| [cloudwatch-monitoring.yaml](./cloudformation/cloudwatch-monitoring.yaml) | Monitoring and alarms |
| [master-stack.yaml](./cloudformation/master-stack.yaml) | Master nested stack |

## Hands-On Labs
| Lab | Description |
|---|---|
| [Lab 01: Deploy VPC](./labs/lab-01-cloudformation-vpc.md) | Deploy identity VPC |
| [Lab 02: Lambda Authorizer](./labs/lab-02-lambda-authorizer.md) | Build JWT authorizer |
| [Lab 03: API Gateway](./labs/lab-03-api-gateway-auth.md) | API Gateway with Auth0 |

**Next Module**: [11 - Docker & Kubernetes ->](../11-docker-kubernetes/)
