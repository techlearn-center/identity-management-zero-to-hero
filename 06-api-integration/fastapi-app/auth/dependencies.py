"""
Auth0 JWT Validation Dependencies for FastAPI

This module provides FastAPI dependency injection functions for:
- JWT token extraction from Authorization header
- RS256 signature verification against Auth0 JWKS
- Claim validation (issuer, audience, expiration)
- User information extraction

Usage:
    @app.get("/protected")
    async def protected(user: dict = Depends(get_current_user)):
        return {"user": user}
"""

import logging
import os
import time
from typing import Any, Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

logger = logging.getLogger("auth0-fastapi.auth")

# ─── Configuration ───────────────────────────────────────────

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ALGORITHMS = ["RS256"]

# ─── Security Scheme ────────────────────────────────────────

security = HTTPBearer(
    scheme_name="Auth0 JWT",
    description="Enter your Auth0 access token (without the 'Bearer' prefix)",
    auto_error=True,
)

optional_security = HTTPBearer(
    scheme_name="Optional Auth0 JWT",
    auto_error=False,
)

# ─── JWKS Cache ──────────────────────────────────────────────

_jwks_cache: Optional[dict] = None
_jwks_cache_timestamp: float = 0
JWKS_CACHE_TTL = 36000  # 10 hours in seconds


async def get_jwks(force_refresh: bool = False) -> dict:
    """
    Fetch JSON Web Key Set from Auth0's JWKS endpoint.

    Keys are cached for 10 hours. A force refresh can be triggered
    when a token has an unknown kid (key rotation scenario).

    Returns:
        dict: The JWKS response containing public keys

    Raises:
        HTTPException: If JWKS cannot be fetched
    """
    global _jwks_cache, _jwks_cache_timestamp

    current_time = time.time()
    cache_expired = (current_time - _jwks_cache_timestamp) > JWKS_CACHE_TTL

    if _jwks_cache is not None and not cache_expired and not force_refresh:
        return _jwks_cache

    if not AUTH0_DOMAIN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH0_DOMAIN not configured",
        )

    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    logger.info(f"Fetching JWKS from {jwks_url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            _jwks_cache = response.json()
            _jwks_cache_timestamp = current_time
            logger.info(f"JWKS fetched successfully ({len(_jwks_cache.get('keys', []))} keys)")
            return _jwks_cache
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        # If we have a cached version, use it even if expired
        if _jwks_cache is not None:
            logger.warning("Using expired JWKS cache as fallback")
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to fetch authentication keys",
        )


def find_rsa_key(jwks: dict, kid: str) -> dict:
    """
    Find the RSA public key matching the given key ID (kid) in the JWKS.

    Args:
        jwks: The JWKS response from Auth0
        kid: The key ID from the JWT header

    Returns:
        dict: The RSA key parameters needed for verification

    Raises:
        HTTPException: If no matching key is found
    """
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }

    logger.warning(f"No matching key found for kid: {kid}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find appropriate signing key",
    )


# ─── Token Validation ───────────────────────────────────────

async def validate_token(token: str) -> dict:
    """
    Validate a JWT access token from Auth0.

    Performs the following checks:
    1. Decodes the JWT header to extract the key ID (kid)
    2. Fetches the matching public key from JWKS
    3. Verifies the RS256 signature
    4. Validates issuer, audience, and expiration claims

    Args:
        token: The raw JWT string

    Returns:
        dict: The decoded token payload

    Raises:
        HTTPException: If validation fails for any reason
    """
    try:
        # Decode header without verification to get kid
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header could not be decoded",
        )

    # Verify algorithm
    alg = unverified_header.get("alg", "")
    if alg not in ALGORITHMS:
        logger.warning(f"Unexpected token algorithm: {alg}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported algorithm: {alg}",
        )

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing key ID (kid)",
        )

    # Try to find the key in cache first
    jwks = await get_jwks()
    try:
        rsa_key = find_rsa_key(jwks, kid)
    except HTTPException:
        # Key not found - might be key rotation. Force refresh JWKS.
        logger.info(f"Key {kid} not found in cache, refreshing JWKS")
        jwks = await get_jwks(force_refresh=True)
        rsa_key = find_rsa_key(jwks, kid)

    # Verify the token
    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
            options={
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "verify_iat": True,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.JWTClaimsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {str(e)}",
        )
    except JWTError as e:
        logger.warning(f"Token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed",
        )


# ─── FastAPI Dependencies ───────────────────────────────────

async def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that extracts and validates the JWT token.

    Returns the raw token payload (all claims).

    Usage:
        @app.get("/endpoint")
        async def endpoint(payload: dict = Depends(get_token_payload)):
            user_id = payload["sub"]
    """
    return await validate_token(credentials.credentials)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that extracts, validates, and formats user information.

    Returns a clean user dictionary with commonly needed fields.

    Usage:
        @app.get("/profile")
        async def profile(user: dict = Depends(get_current_user)):
            return {"email": user["email"]}
    """
    payload = await validate_token(credentials.credentials)

    # Extract user info from token claims
    # Auth0 uses namespaced custom claims
    namespace = f"https://{AUTH0_DOMAIN}"

    user = {
        "id": payload.get("sub"),
        "email": payload.get(f"{namespace}/email") or payload.get("email"),
        "name": payload.get(f"{namespace}/name") or payload.get("name"),
        "permissions": payload.get("permissions", []),
        "roles": payload.get(f"{namespace}/roles", []),
        "scope": payload.get("scope", "").split() if payload.get("scope") else [],
        "is_m2m": payload.get("gty") == "client-credentials",
        "raw_payload": payload,
    }

    logger.debug(f"Authenticated user: {user['id']} (M2M: {user['is_m2m']})")

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
) -> Optional[dict]:
    """
    FastAPI dependency for optional authentication.

    Returns the user if a valid token is present, or None if no token is provided.
    Does NOT return an error for missing tokens (unlike get_current_user).

    Usage:
        @app.get("/items")
        async def items(user: Optional[dict] = Depends(get_optional_user)):
            if user:
                return {"items": all_items, "user": user["email"]}
            return {"items": public_items}
    """
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_m2m(user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency that requires the token to be an M2M token.

    Usage:
        @app.post("/internal/sync")
        async def sync(user: dict = Depends(require_m2m)):
            pass
    """
    if not user.get("is_m2m"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires machine-to-machine authentication",
        )
    return user


def require_human_user(user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency that rejects M2M tokens.

    Usage:
        @app.get("/profile")
        async def profile(user: dict = Depends(require_human_user)):
            pass
    """
    if user.get("is_m2m"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is not available for M2M tokens",
        )
    return user
