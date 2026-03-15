# Lab 01: Write and Test IAM Policies

## Objective
Create IAM policies following least-privilege, test with IAM Policy Simulator.

## Steps
1. Write a policy granting S3 read-only access to specific bucket
2. Write a policy with conditions (IP restriction, MFA required)
3. Test policies using AWS IAM Policy Simulator
4. Understand policy evaluation logic (explicit deny > allow)
5. Use IAM Access Analyzer to validate

## Validation
- [ ] Policy grants only required permissions
- [ ] Conditions restrict access appropriately
- [ ] Policy Simulator confirms expected behavior
