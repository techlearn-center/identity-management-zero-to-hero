# Lab 02: Build a FastAPI Secured with Auth0

## Objective

Build a complete FastAPI application secured with Auth0 JWT validation, step by step. You will implement JWKS-based token validation, FastAPI dependency injection for authentication, permission checking, and protected routes.

## Prerequisites

- Python 3.10+ installed
- An Auth0 account with API configured (from Lab 01)
- pip or pipenv for package management

## Architecture

```
┌───────────────┐      ┌─────────────────────┐      ┌──────────────┐
│   Client      │      │   FastAPI App        │      │   Auth0      │
│               │─────▶│                      │      │              │
│               │      │  ┌────────────────┐  │      │              │
│               │      │  │ Depends(       │  │ JWKS │  ┌────────┐  │
│               │      │  │  get_current_  │──┼─────▶│  │ JWKS   │  │
│               │      │  │  user)         │  │      │  │ Endpt  │  │
│               │      │  └───────┬────────┘  │      │  └────────┘  │
│               │      │  ┌───────▼────────┐  │      │              │
│               │      │  │ Depends(       │  │      │              │
│               │◀─────│  │  require_      │  │      │              │
│               │      │  │  permission)   │  │      │              │
│               │      │  └───────┬────────┘  │      │              │
│               │      │  ┌───────▼────────┐  │      │              │
│               │      │  │ Route Handler  │  │      │              │
│               │      │  └────────────────┘  │      │              │
└───────────────┘      └─────────────────────┘      └──────────────┘
```

## Step 1: Set Up the Project

```bash
mkdir fastapi-auth0-api && cd fastapi-auth0-api
python -m venv venv
source venv/bin/activate    # Linux/macOS
# venv\Scripts\activate     # Windows

pip install fastapi uvicorn python-jose[cryptography] httpx python-dotenv pydantic
```

Create the project structure:

```
fastapi-auth0-api/
├── .env
├── main.py
├── auth/
│   ├── __init__.py
│   ├── dependencies.py
│   └── permissions.py
└── routes/
    ├── __init__.py
    └── api.py
```

```bash
mkdir auth routes
touch auth/__init__.py routes/__init__.py
```

## Step 2: Create Environment Configuration

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.identity-lab.local
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=DEBUG
```

## Step 3: Build the JWT Validation Dependency

Create `auth/dependencies.py`:

```python
"""
Auth0 JWT validation using FastAPI dependency injection.

The get_current_user dependency:
1. Extracts Bearer token from Authorization header
2. Decodes the JWT header to get the kid
3. Fetches the matching public key from Auth0 JWKS
4. Verifies the RS256 signature
5. Validates issuer, audience, and expiration
6. Returns a clean user dictionary
"""

import os
import time
import logging
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# Configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ALGORITHMS = ["RS256"]

# Security scheme for Swagger UI
security = HTTPBearer()

# JWKS cache
_jwks_cache: Optional[dict] = None
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 36000  # 10 hours


async def get_jwks(force_refresh: bool = False) -> dict:
    """Fetch and cache JWKS from Auth0."""
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < JWKS_CACHE_TTL and not force_refresh:
        return _jwks_cache

    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    logger.info(f"Fetching JWKS from {url}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = now
        return _jwks_cache


def find_rsa_key(jwks: dict, kid: str) -> dict:
    """Find the RSA key matching the given kid in the JWKS."""
    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }
    raise HTTPException(status_code=401, detail="Signing key not found")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that validates the JWT and returns user info.

    Usage:
        @app.get("/protected")
        async def protected(user: dict = Depends(get_current_user)):
            return user
    """
    token = credentials.credentials

    try:
        # Decode header to get kid
        unverified_header = jwt.get_unverified_header(token)

        # Fetch matching key
        jwks = await get_jwks()
        try:
            rsa_key = find_rsa_key(jwks, unverified_header["kid"])
        except HTTPException:
            # Key rotation - force refresh
            jwks = await get_jwks(force_refresh=True)
            rsa_key = find_rsa_key(jwks, unverified_header["kid"])

        # Verify token
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )

        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "permissions": payload.get("permissions", []),
            "roles": payload.get(f"https://{AUTH0_DOMAIN}/roles", []),
            "is_m2m": payload.get("gty") == "client-credentials",
            "raw": payload,
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTClaimsError as e:
        raise HTTPException(status_code=401, detail=f"Invalid claims: {e}")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")
```

## Step 4: Build Permission Checking

Create `auth/permissions.py`:

```python
"""Permission checking via FastAPI dependency injection."""

from fastapi import Depends, HTTPException, status
from auth.dependencies import get_current_user


def require_permission(*required_permissions: str):
    """
    Dependency factory that checks if the user has ALL required permissions.

    Usage:
        @router.get("/data")
        async def get_data(user: dict = Depends(require_permission("read:data"))):
            return data
    """
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        user_perms = user.get("permissions", [])
        missing = [p for p in required_permissions if p not in user_perms]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {missing}",
            )
        return user

    return checker
```

## Step 5: Build the Routes

Create `routes/api.py`:

```python
"""Protected API routes."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.dependencies import get_current_user
from auth.permissions import require_permission

router = APIRouter()


class ItemCreate(BaseModel):
    name: str
    description: str = ""


# In-memory store
items = [
    {"id": 1, "name": "Item 1", "owner": "auth0|user1"},
    {"id": 2, "name": "Item 2", "owner": "auth0|user2"},
]


@router.get("/users/me")
async def get_profile(user: dict = Depends(get_current_user)):
    """Any authenticated user can access their profile."""
    return {
        "user_id": user["id"],
        "email": user.get("email"),
        "permissions": user["permissions"],
        "is_m2m": user["is_m2m"],
    }


@router.get("/data")
async def get_data(user: dict = Depends(require_permission("read:data"))):
    """Requires read:data permission."""
    return {"data": items, "total": len(items)}


@router.post("/data", status_code=201)
async def create_data(
    body: ItemCreate,
    user: dict = Depends(require_permission("write:data")),
):
    """Requires write:data permission."""
    new_item = {
        "id": len(items) + 1,
        "name": body.name,
        "description": body.description,
        "owner": user["id"],
        "created_at": datetime.utcnow().isoformat(),
    }
    items.append(new_item)
    return new_item


@router.delete("/data/{item_id}")
async def delete_data(
    item_id: int,
    user: dict = Depends(require_permission("admin:all")),
):
    """Requires admin:all permission."""
    global items
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    items = [i for i in items if i["id"] != item_id]
    return {"deleted": item_id, "deleted_by": user["id"]}
```

## Step 6: Build the Main Application

Create `main.py`:

```python
"""FastAPI application with Auth0 JWT validation."""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.api import router as api_router

load_dotenv()

app = FastAPI(
    title="Auth0 FastAPI API",
    description="FastAPI secured with Auth0 JWT validation and RBAC",
    version="1.0.0",
)

# CORS
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/public")
async def public():
    return {"message": "No authentication required"}


app.include_router(api_router, prefix="/api")
```

## Step 7: Run the Application

```bash
uvicorn main:app --reload --port 3001
```

Visit `http://localhost:3001/docs` to see the Swagger UI with authentication support.

## Step 8: Test the API

```bash
# Set your token
export TOKEN="eyJhbGciOiJSUzI1NiIs..."

# Health check (public)
curl http://localhost:3001/api/health

# Public endpoint
curl http://localhost:3001/api/public

# Protected profile (requires token)
curl http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Read data (requires read:data)
curl http://localhost:3001/api/data \
  -H "Authorization: Bearer $TOKEN"

# Create data (requires write:data)
curl -X POST http://localhost:3001/api/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Item", "description": "Created via API"}'

# Delete data (requires admin:all)
curl -X DELETE http://localhost:3001/api/data/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Step 9: Test with Swagger UI

1. Open `http://localhost:3001/docs`
2. Click the **Authorize** button (lock icon)
3. Enter your Auth0 access token (without "Bearer" prefix)
4. Click **Authorize**
5. Now you can test all endpoints directly from the browser

## Key Differences from Express

| Aspect | Express | FastAPI |
|--------|---------|---------|
| Auth middleware | Global middleware via `app.use()` | Dependency injection via `Depends()` |
| Permission check | Middleware function chain | Dependency factory function |
| Request context | `req.auth` (mutated request) | Return value from dependency |
| Async | Callback-based or `async/await` | Native `async/await` |
| Auto-docs | Manual (Swagger setup needed) | Built-in Swagger UI at `/docs` |
| Validation | Manual or express-validator | Pydantic models (automatic) |

## Validation Checklist

- [ ] Health endpoint accessible without auth
- [ ] Public endpoint accessible without auth
- [ ] Protected endpoints require valid JWT
- [ ] Expired tokens return 401
- [ ] Invalid tokens return 401
- [ ] `read:data` permission grants GET access
- [ ] `write:data` permission grants POST access
- [ ] Missing `admin:all` returns 403 on DELETE
- [ ] JWKS keys are cached (check logs for fetch frequency)
- [ ] Swagger UI shows lock icon on protected endpoints
- [ ] Token can be set via Swagger Authorize button

## Troubleshooting

**"Token validation failed: Signature verification failed"**
The token was signed with a different key than what JWKS returned. Ensure your `AUTH0_DOMAIN` is correct.

**"Token has expired"**
Get a fresh token from Auth0. Access tokens typically expire in 24 hours.

**"Invalid claims: Invalid audience"**
Your `AUTH0_AUDIENCE` does not match the `aud` claim in the token. Check the API identifier in Auth0.

**ModuleNotFoundError**
Ensure you activated your virtual environment: `source venv/bin/activate`

## Next Steps

Proceed to [Lab 03: M2M Authentication](./lab-03-m2m-authentication.md) to set up service-to-service authentication.
