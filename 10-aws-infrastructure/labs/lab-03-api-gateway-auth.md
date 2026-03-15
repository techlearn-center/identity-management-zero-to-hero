# Lab 03: API Gateway with JWT Authorization

## Objective

Connect the Lambda JWT authorizer from Lab 02 to an API Gateway REST API. Create public and protected endpoints, and verify that unauthenticated requests are blocked while authenticated requests pass through.

## Prerequisites

- Completed Lab 02 (Lambda JWT Authorizer deployed)
- AWS CLI configured

## Estimated Time

30–45 minutes

---

## Part 1: Create the API Gateway

### Step 1: Create the REST API

```bash
# Create the API
API_ID=$(aws apigateway create-rest-api \
    --name "Identity Lab API" \
    --description "API with Auth0 JWT authorization" \
    --query 'id' --output text)

echo "API ID: $API_ID"

# Get the root resource ID
ROOT_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --query 'items[?path==`/`].id' --output text)
```

### Step 2: Create the authorizer

```bash
aws apigateway create-authorizer \
    --rest-api-id $API_ID \
    --name "Auth0-JWT" \
    --type TOKEN \
    --authorizer-uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:identity-lab-jwt-authorizer/invocations" \
    --identity-source "method.request.header.Authorization" \
    --authorizer-result-ttl-in-seconds 300
```

> **TTL 300 seconds**: API Gateway caches the authorizer result for 5 minutes. This means subsequent requests with the same token won't invoke the Lambda again — improving performance.

### Step 3: Create a public endpoint

```bash
# Create /public resource
PUBLIC_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part "public" \
    --query 'id' --output text)

# Add GET method (no authorization)
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PUBLIC_ID \
    --http-method GET \
    --authorization-type NONE

# Mock integration (returns static response)
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PUBLIC_ID \
    --http-method GET \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'

aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $PUBLIC_ID \
    --http-method GET \
    --status-code 200

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $PUBLIC_ID \
    --http-method GET \
    --status-code 200 \
    --response-templates '{"application/json": "{\"message\": \"This is a public endpoint. No authentication required.\"}"}'
```

### Step 4: Create a protected endpoint

```bash
# Create /protected resource
PROTECTED_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part "protected" \
    --query 'id' --output text)

# Get the authorizer ID
AUTH_ID=$(aws apigateway get-authorizers \
    --rest-api-id $API_ID \
    --query 'items[?name==`Auth0-JWT`].id' --output text)

# Add GET method WITH authorization
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROTECTED_ID \
    --http-method GET \
    --authorization-type CUSTOM \
    --authorizer-id $AUTH_ID

# Mock integration
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROTECTED_ID \
    --http-method GET \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'

aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $PROTECTED_ID \
    --http-method GET \
    --status-code 200

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $PROTECTED_ID \
    --http-method GET \
    --status-code 200 \
    --response-templates '{"application/json": "{\"message\": \"You are authenticated! This is protected data.\", \"user\": \"$context.authorizer.sub\"}"}'
```

### Step 5: Deploy the API

```bash
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod

API_URL="https://${API_ID}.execute-api.us-east-1.amazonaws.com/prod"
echo "API URL: $API_URL"
```

---

## Part 2: Test the API

### Step 6: Test public endpoint

```bash
curl -s "$API_URL/public" | jq .
# Expected: {"message": "This is a public endpoint. No authentication required."}
```

### Step 7: Test protected endpoint without token

```bash
curl -s "$API_URL/protected"
# Expected: {"message": "Unauthorized"} with 401 status
```

### Step 8: Test protected endpoint with valid token

Get a test token from Auth0 Dashboard → APIs → your API → Test tab.

```bash
TOKEN="eyJhbGciOiJS..."  # Your Auth0 access token

curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/protected" | jq .
# Expected: {"message": "You are authenticated! This is protected data.", "user": "auth0|abc123"}
```

### Step 9: Test with expired/invalid token

```bash
curl -s -H "Authorization: Bearer invalid-token" "$API_URL/protected"
# Expected: {"message": "Unauthorized"} with 403 status
```

---

## Part 3: Clean Up

```bash
# Delete the API
aws apigateway delete-rest-api --rest-api-id $API_ID

# Delete the Lambda
aws lambda delete-function --function-name identity-lab-jwt-authorizer
```

---

## Validation Checklist

- [ ] REST API created in API Gateway
- [ ] Custom authorizer configured with Lambda function
- [ ] Public endpoint accessible without token
- [ ] Protected endpoint returns 401 without token
- [ ] Protected endpoint returns data with valid token
- [ ] Invalid token returns 403
- [ ] User info from token available in response

---

**Next Module**: [Module 11: Docker & Kubernetes →](../../11-docker-kubernetes/README.md)
