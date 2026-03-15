# Lab 03: Cross-Account Access

## Objective
Set up cross-account IAM role assumption between two AWS accounts.

## Steps
1. Create role in Account B with trust policy for Account A
2. Add external ID condition for security
3. Create policy in Account A allowing AssumeRole
4. Test cross-account access with AWS CLI
5. Implement MFA requirement for cross-account access
