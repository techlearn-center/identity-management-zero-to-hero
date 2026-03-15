# Lab 01: Deploy Identity VPC with CloudFormation

## Objective
Deploy a VPC with public and private subnets for identity services.

## Steps
1. Review the `vpc-identity.yaml` template
2. Deploy: `aws cloudformation deploy --template-file vpc-identity.yaml --stack-name identity-vpc`
3. Verify subnets and routing
4. Test internet access from public subnet
5. Verify private subnet isolation
