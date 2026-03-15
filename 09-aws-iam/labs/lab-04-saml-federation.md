# Lab 04: SAML Federation with Auth0

## Objective
Configure Auth0 as a SAML Identity Provider for AWS Console access.

## Steps
1. Configure Auth0 SAML addon for AWS
2. Create SAML Identity Provider in AWS IAM
3. Create IAM role with SAML trust policy
4. Map Auth0 roles to AWS IAM roles via SAML attributes
5. Test federated login to AWS Console via Auth0

## Key Configuration
```json
{
  "audience": "https://signin.aws.amazon.com/saml",
  "mappings": {
    "https://aws.amazon.com/SAML/Attributes/Role": "arn:aws:iam::ACCOUNT:role/Auth0-Admin,arn:aws:iam::ACCOUNT:saml-provider/Auth0",
    "https://aws.amazon.com/SAML/Attributes/RoleSessionName": "email"
  }
}
```
