"""
Protected API Routes for Auth0-Secured FastAPI Application

Routes are organized by permission level:
- Public:         No authentication required
- Authenticated:  Valid JWT required
- read:data:      Can view resources
- write:data:     Can create/update resources
- delete:data:    Can delete resources
- admin:all:      Full administrative access
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth.dependencies import (
    get_current_user,
    get_optional_user,
    require_human_user,
    require_m2m,
)
from auth.permissions import (
    require_any_permission,
    require_permission,
    require_role,
    require_scope,
)

logger = logging.getLogger("auth0-fastapi.routes")

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────

class ItemCreate(BaseModel):
    """Request model for creating an item."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)


class ItemUpdate(BaseModel):
    """Request model for updating an item."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)


class ItemResponse(BaseModel):
    """Response model for an item."""
    id: str
    title: str
    description: str
    owner_id: str
    created_at: str
    updated_at: Optional[str] = None


class SyncRequest(BaseModel):
    """Request model for M2M data sync."""
    items: List[ItemCreate]


# ─── In-Memory Data Store ────────────────────────────────────

items_db: list[dict] = [
    {
        "id": "1",
        "title": "Item One",
        "description": "First sample item",
        "owner_id": "auth0|user1",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "id": "2",
        "title": "Item Two",
        "description": "Second sample item",
        "owner_id": "auth0|user2",
        "created_at": "2024-01-02T00:00:00Z",
    },
    {
        "id": "3",
        "title": "Item Three",
        "description": "Third sample item",
        "owner_id": "auth0|user1",
        "created_at": "2024-01-03T00:00:00Z",
    },
]


# ─── Public Endpoints ────────────────────────────────────────

@router.get("/public")
async def public_endpoint():
    """Public endpoint. No authentication required."""
    return {
        "message": "This is a public endpoint. No authentication required.",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/public/items")
async def public_items(user: Optional[dict] = Depends(get_optional_user)):
    """
    Public item listing with optional authentication.
    Authenticated users see additional fields.
    """
    public_fields = ["id", "title", "description"]
    auth_fields = ["id", "title", "description", "owner_id", "created_at"]

    fields = auth_fields if user else public_fields

    return {
        "items": [{k: item[k] for k in fields if k in item} for item in items_db],
        "total": len(items_db),
        "authenticated": user is not None,
    }


# ─── Authenticated Endpoints ────────────────────────────────

@router.get("/private")
async def private_endpoint(user: dict = Depends(get_current_user)):
    """Requires a valid JWT. No specific permissions needed."""
    return {
        "message": "You are authenticated!",
        "user": {
            "id": user["id"],
            "email": user.get("email"),
            "name": user.get("name"),
            "permissions": user["permissions"],
            "roles": user.get("roles", []),
        },
        "is_m2m": user.get("is_m2m", False),
    }


@router.get("/users/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    return {
        "user_id": user["id"],
        "email": user.get("email"),
        "name": user.get("name"),
        "permissions": user["permissions"],
        "roles": user.get("roles", []),
        "scope": user.get("scope", []),
    }


@router.get("/profile")
async def get_profile(user: dict = Depends(require_human_user)):
    """
    Get the authenticated user's profile.
    Only available for human users (not M2M tokens).
    """
    return {
        "id": user["id"],
        "email": user.get("email"),
        "name": user.get("name"),
        "roles": user.get("roles", []),
        "permissions": user["permissions"],
    }


# ─── Permission-Protected Endpoints ─────────────────────────

@router.get("/items")
async def get_items(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    user: dict = Depends(require_permission("read:data")),
):
    """
    List all items. Requires 'read:data' permission.
    Supports pagination via page and limit query parameters.
    """
    offset = (page - 1) * limit
    paginated = items_db[offset : offset + limit]

    return {
        "items": paginated,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": len(items_db),
            "total_pages": max(1, -(-len(items_db) // limit)),  # Ceiling division
        },
    }


@router.get("/items/{item_id}")
async def get_item(
    item_id: str,
    user: dict = Depends(require_permission("read:data")),
):
    """Get a specific item by ID. Requires 'read:data' permission."""
    item = next((i for i in items_db if i["id"] == item_id), None)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )

    return {"item": item}


@router.post("/items", status_code=status.HTTP_201_CREATED)
async def create_item(
    body: ItemCreate,
    user: dict = Depends(require_permission("write:data")),
):
    """Create a new item. Requires 'write:data' permission."""
    new_item = {
        "id": str(len(items_db) + 1),
        "title": body.title,
        "description": body.description,
        "owner_id": user["id"],
        "created_at": datetime.utcnow().isoformat(),
    }

    items_db.append(new_item)
    logger.info(f"Item created by {user['id']}: {new_item['id']}")

    return {
        "message": "Item created successfully",
        "item": new_item,
    }


@router.put("/items/{item_id}")
async def update_item(
    item_id: str,
    body: ItemUpdate,
    user: dict = Depends(require_permission("write:data")),
):
    """
    Update an item. Requires 'write:data' permission.
    Users can only update their own items unless they have 'admin:all'.
    """
    item_index = next(
        (i for i, item in enumerate(items_db) if item["id"] == item_id), None
    )

    if item_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )

    item = items_db[item_index]

    # Check ownership (admin bypass)
    if item["owner_id"] != user["id"] and "admin:all" not in user["permissions"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own items",
        )

    # Apply updates
    if body.title is not None:
        item["title"] = body.title
    if body.description is not None:
        item["description"] = body.description
    item["updated_at"] = datetime.utcnow().isoformat()

    items_db[item_index] = item
    logger.info(f"Item {item_id} updated by {user['id']}")

    return {
        "message": "Item updated successfully",
        "item": item,
    }


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    user: dict = Depends(require_permission("delete:data")),
):
    """Delete an item. Requires 'delete:data' permission."""
    item_index = next(
        (i for i, item in enumerate(items_db) if item["id"] == item_id), None
    )

    if item_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )

    deleted_item = items_db.pop(item_index)
    logger.info(f"Item {item_id} deleted by {user['id']}")

    return {
        "message": "Item deleted successfully",
        "item": deleted_item,
    }


# ─── Admin Endpoints ────────────────────────────────────────

@router.get("/admin/dashboard")
async def admin_dashboard(user: dict = Depends(require_role("admin"))):
    """Admin dashboard. Requires 'admin' role."""
    unique_owners = list(set(item["owner_id"] for item in items_db))

    return {
        "message": "Welcome to the admin dashboard",
        "stats": {
            "total_items": len(items_db),
            "unique_owners": len(unique_owners),
        },
        "admin_user": {
            "id": user["id"],
            "email": user.get("email"),
            "roles": user.get("roles", []),
        },
    }


@router.get("/admin/users")
async def admin_list_users(
    user: dict = Depends(require_permission("admin:all")),
):
    """List all users with item counts. Requires 'admin:all' permission."""
    owner_counts: dict[str, int] = {}
    for item in items_db:
        owner_id = item["owner_id"]
        owner_counts[owner_id] = owner_counts.get(owner_id, 0) + 1

    return {
        "users": [
            {"id": owner_id, "item_count": count}
            for owner_id, count in owner_counts.items()
        ],
        "total": len(owner_counts),
    }


# ─── M2M Endpoints ──────────────────────────────────────────

@router.post("/internal/sync", status_code=status.HTTP_201_CREATED)
async def m2m_sync(
    body: SyncRequest,
    user: dict = Depends(require_m2m),
):
    """
    Sync data from another service.
    Requires M2M token (client_credentials grant type).
    """
    created = []
    for item_data in body.items:
        new_item = {
            "id": str(len(items_db) + len(created) + 1),
            "title": item_data.title,
            "description": item_data.description,
            "owner_id": f"service:{user['id']}",
            "created_at": datetime.utcnow().isoformat(),
            "source": "m2m-sync",
        }
        created.append(new_item)

    items_db.extend(created)
    logger.info(f"M2M sync: {len(created)} items from {user['id']}")

    return {
        "message": f"Synced {len(created)} items",
        "items": created,
    }


@router.get("/internal/health")
async def internal_health(user: dict = Depends(require_m2m)):
    """Internal health check for service mesh. Requires M2M token."""
    return {
        "status": "healthy",
        "service": "auth0-fastapi-api",
        "timestamp": datetime.utcnow().isoformat(),
        "item_count": len(items_db),
    }


# ─── Scope-Protected Endpoints ──────────────────────────────

@router.get("/user/email")
async def get_user_email(user: dict = Depends(require_scope("email"))):
    """Get user email. Requires 'email' scope in token."""
    return {"email": user.get("email")}
