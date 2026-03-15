"""
Permission Checking Utilities for FastAPI Routes

Provides decorators and dependency factories for checking:
- Individual permissions (e.g., "read:data")
- Multiple permissions (ALL required or ANY required)
- Roles
- Resource ownership

Usage with dependency injection:
    @router.get("/data")
    async def get_data(user: dict = Depends(require_permission("read:data"))):
        return {"data": [...]}

Usage with decorator:
    @router.get("/data")
    @require_permissions("read:data", "read:users")
    async def get_data(current_user: dict):
        return {"data": [...]}
"""

import logging
from functools import wraps
from typing import Any, Callable, List, Optional

from fastapi import Depends, HTTPException, status

from auth.dependencies import get_current_user

logger = logging.getLogger("auth0-fastapi.permissions")


# ─── Dependency-Based Permission Checking ────────────────────

def require_permission(*required_permissions: str) -> Callable:
    """
    FastAPI dependency factory that checks if the user has ALL required permissions.

    Args:
        *required_permissions: Permission strings that must ALL be present in the token

    Returns:
        A dependency function that returns the user dict if authorized

    Raises:
        HTTPException 403 if the user lacks any required permission

    Example:
        @router.get("/items")
        async def get_items(user: dict = Depends(require_permission("read:data"))):
            return items

        @router.delete("/items/{id}")
        async def delete_item(
            id: str,
            user: dict = Depends(require_permission("delete:data", "admin:all"))
        ):
            return {"deleted": id}
    """
    async def _check_permissions(user: dict = Depends(get_current_user)) -> dict:
        user_permissions = user.get("permissions", [])

        missing = [p for p in required_permissions if p not in user_permissions]

        if missing:
            logger.warning(
                f"Permission denied for user {user.get('id')}: "
                f"missing {missing}, has {user_permissions}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_permissions",
                    "message": "You do not have the required permissions",
                    "required": list(required_permissions),
                    "missing": missing,
                },
            )

        logger.debug(f"Permission check passed for {user.get('id')}: {required_permissions}")
        return user

    return _check_permissions


def require_any_permission(*required_permissions: str) -> Callable:
    """
    FastAPI dependency factory that checks if the user has ANY of the required permissions.

    Args:
        *required_permissions: At least ONE of these must be present

    Returns:
        A dependency function that returns the user dict if authorized

    Example:
        @router.get("/content")
        async def get_content(
            user: dict = Depends(require_any_permission("read:content", "admin:all"))
        ):
            return content
    """
    async def _check_any_permission(user: dict = Depends(get_current_user)) -> dict:
        user_permissions = user.get("permissions", [])

        has_any = any(p in user_permissions for p in required_permissions)

        if not has_any:
            logger.warning(
                f"Permission denied for user {user.get('id')}: "
                f"needs one of {required_permissions}, has {user_permissions}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_permissions",
                    "message": "You do not have any of the required permissions",
                    "required_any": list(required_permissions),
                },
            )

        return user

    return _check_any_permission


def require_role(*required_roles: str) -> Callable:
    """
    FastAPI dependency factory that checks if the user has ANY of the required roles.

    Args:
        *required_roles: At least ONE role must match

    Returns:
        A dependency function that returns the user dict if authorized

    Example:
        @router.get("/admin/dashboard")
        async def admin_dashboard(user: dict = Depends(require_role("admin"))):
            return dashboard_data
    """
    async def _check_role(user: dict = Depends(get_current_user)) -> dict:
        user_roles = user.get("roles", [])

        has_role = any(r in user_roles for r in required_roles)

        if not has_role:
            logger.warning(
                f"Role check failed for user {user.get('id')}: "
                f"needs one of {required_roles}, has {user_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_role",
                    "message": "You do not have the required role",
                },
            )

        return user

    return _check_role


def require_scope(*required_scopes: str) -> Callable:
    """
    FastAPI dependency factory that checks if the token has ALL required scopes.

    Args:
        *required_scopes: Scopes that must ALL be present

    Returns:
        A dependency function that returns the user dict if authorized

    Example:
        @router.get("/user/email")
        async def get_email(user: dict = Depends(require_scope("email", "profile"))):
            return {"email": user["email"]}
    """
    async def _check_scope(user: dict = Depends(get_current_user)) -> dict:
        token_scopes = user.get("scope", [])

        missing = [s for s in required_scopes if s not in token_scopes]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_scope",
                    "message": "The token does not have the required scopes",
                    "required_scopes": list(required_scopes),
                    "missing_scopes": missing,
                },
            )

        return user

    return _check_scope


# ─── Decorator-Based Permission Checking ─────────────────────

def require_permissions(*required_permissions: str):
    """
    Decorator for checking permissions on route handler functions.

    The decorated function MUST have a `current_user` parameter
    (typically injected via Depends(get_current_user)).

    Args:
        *required_permissions: Permissions that must ALL be present

    Example:
        @router.get("/admin/stats")
        @require_permissions("read:data", "admin:all")
        async def admin_stats(current_user: dict = Depends(get_current_user)):
            return stats
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get("current_user")
            if current_user is None:
                # Try to find it in args by looking for a dict with 'permissions'
                for arg in args:
                    if isinstance(arg, dict) and "permissions" in arg:
                        current_user = arg
                        break

            if current_user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            user_permissions = current_user.get("permissions", [])
            missing = [p for p in required_permissions if p not in user_permissions]

            if missing:
                logger.warning(
                    f"Permission denied: missing {missing}, "
                    f"user has {user_permissions}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "insufficient_permissions",
                        "message": "You do not have the required permissions",
                        "required": list(required_permissions),
                        "missing": missing,
                    },
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# ─── Resource Ownership Checking ─────────────────────────────

def require_ownership(
    get_resource_owner_id: Callable,
    admin_permission: str = "admin:all",
) -> Callable:
    """
    FastAPI dependency factory for resource-level authorization.

    Checks if the authenticated user owns the resource OR has admin permissions.

    Args:
        get_resource_owner_id: Async callable that takes the request and returns
                               the owner's user ID
        admin_permission: Permission that bypasses the ownership check

    Returns:
        A dependency function

    Example:
        async def get_doc_owner(doc_id: str) -> str:
            doc = await db.get_document(doc_id)
            return doc.owner_id

        @router.put("/documents/{doc_id}")
        async def update_doc(
            doc_id: str,
            user: dict = Depends(require_ownership(get_doc_owner))
        ):
            pass
    """
    async def _check_ownership(user: dict = Depends(get_current_user)) -> dict:
        # Admin bypass
        if admin_permission in user.get("permissions", []):
            logger.debug(f"Admin bypass for user {user.get('id')}")
            return user

        try:
            owner_id = await get_resource_owner_id()
        except Exception as e:
            logger.error(f"Error fetching resource owner: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not verify resource ownership",
            )

        if owner_id is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found",
            )

        if owner_id != user.get("id"):
            logger.warning(
                f"Ownership check failed: user {user.get('id')} "
                f"tried to access resource owned by {owner_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )

        return user

    return _check_ownership
