# Lab 02: IAM Roles — EC2, Lambda, and ECS

## Objective

Create IAM roles for AWS services. Instead of storing access keys on servers, roles let services assume temporary credentials automatically. You'll create roles for EC2 instances, Lambda functions, and ECS tasks — the three most common patterns.

## Prerequisites

- Completed Lab 01 (IAM Policies)
- AWS CLI configured with admin access
- Basic understanding of EC2, Lambda, and ECS concepts

## Estimated Time

45–60 minutes

---

## Part 1: Understanding IAM Roles

### Why Roles Instead of Access Keys?

| Approach | Security | Rotation | Use Case |
|---|---|---|---|
| Access keys on server | Poor — keys can leak | Manual | Never do this |
| IAM Role for EC2 | Good — auto-rotated | Automatic | EC2 instances |
| IAM Role for Lambda | Good — auto-rotated | Automatic | Lambda functions |
| IAM Role for ECS | Good — auto-rotated | Automatic | Container tasks |

When you attach a role to an EC2 instance, AWS automatically provides temporary credentials via the instance metadata service. No keys to manage, no secrets to rotate.

### Anatomy of a Role

A role has two parts:
1. **Trust policy** — who/what can assume this role
2. **Permission policy** — what the role can do

```
Trust Policy:         "EC2 service can assume this role"
Permission Policy:    "This role can read from S3 and write to CloudWatch"
```

---

## Part 2: EC2 Instance Role

### Step 1: Create the trust policy

The trust policy tells AWS which service can use this role.

```bash
mkdir -p ~/iam-lab && cd ~/iam-lab

cat > ec2-trust-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
```

> **`Principal.Service`** specifies the AWS service that can assume this role. For EC2, it's `ec2.amazonaws.com`. For Lambda, it would be `lambda.amazonaws.com`.

### Step 2: Create the permission policy

This is what the EC2 instance will be allowed to do:

```bash
cat > ec2-permissions.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ReadAppConfig",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::identity-lab-config",
                "arn:aws:s3:::identity-lab-config/*"
            ]
        },
        {
            "Sid": "WriteAppLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:log-group:/identity-lab/*"
        },
        {
            "Sid": "ReadSecrets",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": "arn:aws:secretsmanager:*:*:secret:identity-lab/*"
        }
    ]
}
EOF
```

### Step 3: Create the role and attach the policy

```bash
# Create the role with the trust policy
aws iam create-role \
    --role-name identity-lab-ec2-role \
    --assume-role-policy-document file://ec2-trust-policy.json \
    --description "Role for identity lab EC2 instances" \
    --tags Key=Project,Value=identity-lab

# Create and attach the permission policy
aws iam put-role-policy \
    --role-name identity-lab-ec2-role \
    --policy-name identity-lab-ec2-permissions \
    --policy-document file://ec2-permissions.json

# Create an instance profile (required to attach a role to EC2)
aws iam create-instance-profile \
    --instance-profile-name identity-lab-ec2-profile

aws iam add-role-to-instance-profile \
    --instance-profile-name identity-lab-ec2-profile \
    --role-name identity-lab-ec2-role
```

> **Instance Profile**: EC2 needs this wrapper around the role. Think of it as a "role holder" that EC2 can reference. Other services (Lambda, ECS) don't need this.

### Step 4: Verify the role

```bash
# View the role
aws iam get-role --role-name identity-lab-ec2-role --query 'Role.{Name:RoleName,Arn:Arn,TrustPolicy:AssumeRolePolicyDocument}'

# List attached policies
aws iam list-role-policies --role-name identity-lab-ec2-role
```

---

## Part 3: Lambda Execution Role

### Step 5: Create a Lambda role

```bash
# Trust policy for Lambda
cat > lambda-trust-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Permission policy
cat > lambda-permissions.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BasicLambdaLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/identity-lab-*:*"
        },
        {
            "Sid": "DynamoDBAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Query",
                "dynamodb:UpdateItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/identity-lab-*"
        },
        {
            "Sid": "KMSDecrypt",
            "Effect": "Allow",
            "Action": ["kms:Decrypt"],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": "secretsmanager.*.amazonaws.com"
                }
            }
        }
    ]
}
EOF

# Create the role
aws iam create-role \
    --role-name identity-lab-lambda-role \
    --assume-role-policy-document file://lambda-trust-policy.json \
    --description "Execution role for identity lab Lambda functions"

aws iam put-role-policy \
    --role-name identity-lab-lambda-role \
    --policy-name identity-lab-lambda-permissions \
    --policy-document file://lambda-permissions.json
```

---

## Part 4: ECS Task Role

### Step 6: Create an ECS task role

ECS has two types of roles:
- **Task Role** — what the container application can do (S3, DynamoDB, etc.)
- **Task Execution Role** — what ECS needs to run the container (pull images, get secrets)

```bash
# Trust policy for ECS tasks
cat > ecs-trust-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Task role permissions (what the app can do)
cat > ecs-task-permissions.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "RDSIAMAuth",
            "Effect": "Allow",
            "Action": "rds-db:connect",
            "Resource": "arn:aws:rds-db:*:*:dbuser:*/identity_app"
        },
        {
            "Sid": "S3Uploads",
            "Effect": "Allow",
            "Action": ["s3:PutObject", "s3:GetObject"],
            "Resource": "arn:aws:s3:::identity-lab-uploads/*"
        },
        {
            "Sid": "SQSMessages",
            "Effect": "Allow",
            "Action": [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage"
            ],
            "Resource": "arn:aws:sqs:*:*:identity-lab-*"
        }
    ]
}
EOF

# Create task role
aws iam create-role \
    --role-name identity-lab-ecs-task-role \
    --assume-role-policy-document file://ecs-trust-policy.json

aws iam put-role-policy \
    --role-name identity-lab-ecs-task-role \
    --policy-name identity-lab-ecs-task-permissions \
    --policy-document file://ecs-task-permissions.json

# Task execution role (for ECS agent)
aws iam create-role \
    --role-name identity-lab-ecs-execution-role \
    --assume-role-policy-document file://ecs-trust-policy.json

# Attach AWS managed policy for execution role
aws iam attach-role-policy \
    --role-name identity-lab-ecs-execution-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

---

## Part 5: Test Assuming a Role

### Step 7: Assume a role manually with STS

```bash
# Assume the Lambda role (to test what it can do)
CREDENTIALS=$(aws sts assume-role \
    --role-arn arn:aws:iam::YOUR_ACCOUNT_ID:role/identity-lab-lambda-role \
    --role-session-name test-session \
    --query 'Credentials' \
    --output json)

# Extract temporary credentials
export AWS_ACCESS_KEY_ID=$(echo $CREDENTIALS | jq -r '.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $CREDENTIALS | jq -r '.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $CREDENTIALS | jq -r '.SessionToken')

# Verify you're using the role
aws sts get-caller-identity
# Should show: "Arn": "arn:aws:sts::ACCOUNT:assumed-role/identity-lab-lambda-role/test-session"

# Test: Can you read CloudWatch logs? (Should work)
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/identity-lab

# Test: Can you create an EC2 instance? (Should fail)
aws ec2 run-instances --image-id ami-0c55b159cbfafe1f0 --count 1 --instance-type t2.micro
# Expected: An error occurred (UnauthorizedOperation)

# Clean up the temporary credentials
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
```

---

## Part 6: Clean Up

```bash
# Remove all lab roles
for role in identity-lab-ec2-role identity-lab-lambda-role identity-lab-ecs-task-role identity-lab-ecs-execution-role; do
    # Delete inline policies
    aws iam list-role-policies --role-name $role --query 'PolicyNames[]' --output text 2>/dev/null | \
        tr '\t' '\n' | xargs -I {} aws iam delete-role-policy --role-name $role --policy-name {} 2>/dev/null
    # Detach managed policies
    aws iam list-attached-role-policies --role-name $role --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null | \
        tr '\t' '\n' | xargs -I {} aws iam detach-role-policy --role-name $role --policy-arn {} 2>/dev/null
    # Delete the role
    aws iam delete-role --role-name $role 2>/dev/null
done

# Remove instance profile
aws iam remove-role-from-instance-profile --instance-profile-name identity-lab-ec2-profile --role-name identity-lab-ec2-role 2>/dev/null
aws iam delete-instance-profile --instance-profile-name identity-lab-ec2-profile 2>/dev/null
```

---

## Validation Checklist

- [ ] EC2 role created with trust policy for `ec2.amazonaws.com`
- [ ] Instance profile created and role added
- [ ] Lambda role created with logging, DynamoDB, and KMS permissions
- [ ] ECS task role and execution role created separately
- [ ] Successfully assumed a role with `sts assume-role`
- [ ] Temporary credentials work for allowed actions
- [ ] Temporary credentials are denied for non-allowed actions

---

**Next Lab**: [Lab 03: Cross-Account Access →](./lab-03-cross-account.md)
