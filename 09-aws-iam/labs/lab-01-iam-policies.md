# Lab 01: Writing and Testing IAM Policies

## Objective

Learn to write AWS IAM policies from scratch, understand the policy evaluation logic, and use the IAM Policy Simulator to test your policies before deploying them. By the end, you'll be able to write least-privilege policies confidently.

## Prerequisites

- **AWS Account** — free tier works for everything in this lab
  - Sign up at [aws.amazon.com](https://aws.amazon.com/) if you don't have one
- **AWS CLI v2** installed and configured:
  ```bash
  # Install (macOS)
  brew install awscli
  # Install (Linux)
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip awscliv2.zip && sudo ./aws/install
  # Configure
  aws configure
  # Enter your Access Key ID, Secret, region (us-east-1), output format (json)
  ```
- **IAM user with AdministratorAccess** (for this lab only — we'll create least-privilege users)

## Estimated Time

60–90 minutes

---

## Part 1: IAM Policy Fundamentals

### How AWS IAM Policies Work

Every API call to AWS goes through this evaluation:

```
API Call → Am I authenticated? → Am I allowed?
                                      ↓
                              Check all policies:
                              1. Is there an explicit DENY? → DENIED
                              2. Is there an explicit ALLOW? → ALLOWED
                              3. Neither? → DENIED (implicit deny)
```

**Key rule:** An explicit DENY always wins, even if another policy says ALLOW.

### Policy Structure

Every IAM policy has this structure:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "HumanReadableName",
            "Effect": "Allow",
            "Action": ["service:Action"],
            "Resource": ["arn:aws:service:region:account:resource"],
            "Condition": { }
        }
    ]
}
```

| Field | Required | Purpose |
|---|---|---|
| Version | Yes | Always `"2012-10-17"` (latest policy version) |
| Statement | Yes | Array of permission rules |
| Sid | No | A label for the statement (helps readability) |
| Effect | Yes | `"Allow"` or `"Deny"` |
| Action | Yes | What API calls are permitted |
| Resource | Yes | Which AWS resources this applies to |
| Condition | No | Additional constraints (IP, MFA, time, tags, etc.) |

---

## Part 2: Write Your First Policy

### Step 1: Create a policy that allows read-only S3 access to one bucket

Open your terminal and create the policy file:

```bash
mkdir -p ~/iam-lab && cd ~/iam-lab

cat > s3-readonly-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ListSpecificBucket",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": "arn:aws:s3:::identity-lab-data-*"
        },
        {
            "Sid": "ReadObjectsInBucket",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectVersion"
            ],
            "Resource": "arn:aws:s3:::identity-lab-data-*/*"
        }
    ]
}
EOF
```

**Why two statements?**
- `s3:ListBucket` operates on the **bucket** (no `/*` suffix)
- `s3:GetObject` operates on **objects inside** the bucket (needs `/*` suffix)
- This is a common mistake — if you use `/*` for ListBucket, it won't work

### Step 2: Validate the policy syntax

```bash
aws iam create-policy \
    --policy-name identity-lab-s3-readonly \
    --policy-document file://s3-readonly-policy.json \
    --description "Read-only access to identity lab S3 buckets" \
    --tags Key=Project,Value=identity-lab
```

If successful, note the **Policy ARN** from the output. It looks like:
```
arn:aws:iam::123456789012:policy/identity-lab-s3-readonly
```

### Step 3: Create a test IAM user

```bash
# Create a user
aws iam create-user --user-name identity-lab-tester

# Attach the policy
aws iam attach-user-policy \
    --user-name identity-lab-tester \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/identity-lab-s3-readonly

# Create access keys for testing
aws iam create-access-key --user-name identity-lab-tester
```

Save the `AccessKeyId` and `SecretAccessKey` from the output.

### Step 4: Test the policy

```bash
# Configure a profile for the test user
aws configure --profile lab-tester
# Enter the access key and secret from Step 3

# This should SUCCEED (listing a bucket that matches the pattern)
aws s3 ls s3://identity-lab-data-dev --profile lab-tester

# This should FAIL (writing is not allowed)
echo "test" | aws s3 cp - s3://identity-lab-data-dev/test.txt --profile lab-tester
# Expected error: An error occurred (AccessDenied)

# This should FAIL (different bucket name doesn't match pattern)
aws s3 ls s3://my-other-bucket --profile lab-tester
# Expected error: An error occurred (AccessDenied)
```

---

## Part 3: Use the IAM Policy Simulator

### Step 5: Test policies without creating real resources

The Policy Simulator lets you test "what if" scenarios:

```bash
# Test: Can identity-lab-tester do s3:GetObject on our bucket?
aws iam simulate-principal-policy \
    --policy-source-arn arn:aws:iam::YOUR_ACCOUNT_ID:user/identity-lab-tester \
    --action-names s3:GetObject \
    --resource-arns "arn:aws:s3:::identity-lab-data-dev/config.json" \
    --output table
```

Expected output:
```
EvalActionName | EvalDecision | EvalResourceName
s3:GetObject   | allowed      | arn:aws:s3:::identity-lab-data-dev/config.json
```

```bash
# Test: Can they delete objects?
aws iam simulate-principal-policy \
    --policy-source-arn arn:aws:iam::YOUR_ACCOUNT_ID:user/identity-lab-tester \
    --action-names s3:DeleteObject \
    --resource-arns "arn:aws:s3:::identity-lab-data-dev/config.json" \
    --output table
```

Expected: `implicitDeny`

You can also use the visual simulator at: **IAM Console → Policy Simulator** (left sidebar)

---

## Part 4: Policies with Conditions

### Step 6: Write a policy with IP and MFA conditions

```bash
cat > conditional-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowFromOfficeWithMFA",
            "Effect": "Allow",
            "Action": [
                "ec2:Describe*",
                "rds:Describe*",
                "s3:List*"
            ],
            "Resource": "*",
            "Condition": {
                "IpAddress": {
                    "aws:SourceIp": ["203.0.113.0/24", "198.51.100.0/24"]
                },
                "Bool": {
                    "aws:MultiFactorAuthPresent": "true"
                }
            }
        },
        {
            "Sid": "DenyDeleteWithoutMFA",
            "Effect": "Deny",
            "Action": [
                "s3:DeleteObject",
                "ec2:TerminateInstances",
                "rds:DeleteDBInstance"
            ],
            "Resource": "*",
            "Condition": {
                "BoolIfExists": {
                    "aws:MultiFactorAuthPresent": "false"
                }
            }
        }
    ]
}
EOF
```

**Understanding the conditions:**
- `IpAddress` — only allow from specified CIDR ranges (office IPs)
- `Bool: aws:MultiFactorAuthPresent` — require MFA for these actions
- `BoolIfExists` — blocks actions when MFA is absent or explicitly false
- The DENY statement uses `BoolIfExists` to also catch cases where the MFA key doesn't exist

### Step 7: Test conditions with the simulator

```bash
aws iam simulate-custom-policy \
    --policy-input-list file://conditional-policy.json \
    --action-names ec2:DescribeInstances \
    --context-entries \
        "ContextKeyName=aws:SourceIp,ContextKeyValues=203.0.113.50,ContextKeyType=ip" \
        "ContextKeyName=aws:MultiFactorAuthPresent,ContextKeyValues=true,ContextKeyType=boolean" \
    --output table
```

Try changing the IP or MFA value to see how the decision changes.

---

## Part 5: Common Policy Patterns

### Step 8: Write these real-world policies (exercises)

**Exercise 1: Self-service — users can manage only their own IAM credentials**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowManageOwnCredentials",
            "Effect": "Allow",
            "Action": [
                "iam:ChangePassword",
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey",
                "iam:GetUser",
                "iam:ListAccessKeys",
                "iam:UpdateAccessKey",
                "iam:GetAccessKeyLastUsed"
            ],
            "Resource": "arn:aws:iam::*:user/${aws:username}"
        },
        {
            "Sid": "AllowManageOwnMFA",
            "Effect": "Allow",
            "Action": [
                "iam:CreateVirtualMFADevice",
                "iam:EnableMFADevice",
                "iam:ResyncMFADevice",
                "iam:DeactivateMFADevice",
                "iam:DeleteVirtualMFADevice"
            ],
            "Resource": [
                "arn:aws:iam::*:user/${aws:username}",
                "arn:aws:iam::*:mfa/${aws:username}"
            ]
        }
    ]
}
```

> **`${aws:username}`** is a policy variable that resolves to the current IAM user's name. This makes the policy work for any user without hardcoding names.

**Exercise 2: Tag-based access control**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowEC2ByEnvironmentTag",
            "Effect": "Allow",
            "Action": ["ec2:StartInstances", "ec2:StopInstances"],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "ec2:ResourceTag/Environment": "${aws:PrincipalTag/Environment}"
                }
            }
        }
    ]
}
```

> This allows users to start/stop only EC2 instances tagged with the same `Environment` value as their own IAM tag. A dev-tagged user can only manage dev-tagged instances.

---

## Part 6: Clean Up

### Step 9: Remove lab resources

```bash
# Detach the policy from the test user
aws iam detach-user-policy \
    --user-name identity-lab-tester \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/identity-lab-s3-readonly

# Delete access keys
aws iam list-access-keys --user-name identity-lab-tester \
    --query 'AccessKeyMetadata[].AccessKeyId' --output text | \
    xargs -I {} aws iam delete-access-key --user-name identity-lab-tester --access-key-id {}

# Delete the user
aws iam delete-user --user-name identity-lab-tester

# Delete the policy
aws iam delete-policy --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/identity-lab-s3-readonly
```

---

## Validation Checklist

- [ ] Created an S3 read-only policy with correct bucket and object ARNs
- [ ] Policy validated and created in AWS
- [ ] Test user created and policy attached
- [ ] Allowed actions succeed, denied actions fail
- [ ] Policy Simulator confirms expected decisions
- [ ] Conditional policy correctly evaluates IP and MFA conditions
- [ ] Understood policy variables (`${aws:username}`, `${aws:PrincipalTag}`)
- [ ] Lab resources cleaned up

---

## Key Takeaways

1. **Least privilege**: Start with zero permissions, add only what's needed
2. **Two ARN formats for S3**: Bucket-level (`arn:aws:s3:::bucket`) vs object-level (`arn:aws:s3:::bucket/*`)
3. **Explicit DENY always wins** over any ALLOW
4. **Test before deploying** using the IAM Policy Simulator
5. **Use conditions** for defense-in-depth (IP, MFA, tags, time)
6. **Use policy variables** instead of hardcoding user/resource names

---

**Next Lab**: [Lab 02: IAM Roles →](./lab-02-iam-roles.md)
