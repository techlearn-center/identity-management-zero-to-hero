#!/bin/bash
# Audit IAM permissions for all users and roles
set -euo pipefail

echo "=== IAM Permission Audit ==="
echo "Date: $(date -u)"

echo -e "\n--- Users ---"
aws iam list-users --query 'Users[].UserName' --output table

echo -e "\n--- Users with Console Access ---"
for user in $(aws iam list-users --query 'Users[].UserName' --output text); do
  login=$(aws iam get-login-profile --user-name "$user" 2>/dev/null && echo "YES" || echo "NO")
  mfa=$(aws iam list-mfa-devices --user-name "$user" --query 'MFADevices | length(@)')
  keys=$(aws iam list-access-keys --user-name "$user" --query 'AccessKeyMetadata | length(@)')
  echo "  $user: Console=$login MFA_Devices=$mfa Access_Keys=$keys"
done

echo -e "\n--- Roles ---"
aws iam list-roles --query 'Roles[?starts_with(RoleName, `identity`)].RoleName' --output table

echo -e "\n--- Access Keys older than 90 days ---"
for user in $(aws iam list-users --query 'Users[].UserName' --output text); do
  aws iam list-access-keys --user-name "$user" \
    --query "AccessKeyMetadata[?CreateDate<='$(date -u -d '90 days ago' +%Y-%m-%dT%H:%M:%SZ)'].{User:UserName,Key:AccessKeyId,Created:CreateDate}" \
    --output table 2>/dev/null
done

echo "=== Audit Complete ==="
