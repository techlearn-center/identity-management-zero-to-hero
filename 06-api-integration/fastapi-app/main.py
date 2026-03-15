"""
FastAPI Application Secured with Auth0 JWT Validation

Features:
- RS256 JWT validation against Auth0 JWKS endpoint
- Role-based access control (RBAC) via permissions in JWT
- Protected and public routes
- CORS configuration
- Rate limiting
- Structured logging
- Comprehensive error handling
- M2M token support

Usage:
    uvicorn main:app --reload --port 3001
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth.dependencies import get_jwks
from routes.api import router as api_router

# Load environment variables
load_dotenv()

# ─── Configuration ───────────────────────────────────────────

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# ─── Logging Setup ───────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("auth0-fastapi")


# ─── Application Lifecycle ───────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup: Pre-fetch JWKS keys
    logger.info("Starting Auth0 FastAPI API")
    logger.info(f"Auth0 Domain: {AUTH0_DOMAIN}")
    logger.info(f"Auth0 Audience: {AUTH0_AUDIENCE}")
    logger.info(f"Allowed Origins: {ALLOWED_ORIGINS}")

    if AUTH0_DOMAIN:
        try:
            await get_jwks()
            logger.info("JWKS keys pre-fetched successfully")
        except Exception as e:
            logger.warning(f"Failed to pre-fetch JWKS keys: {e}")
    else:
        logger.warning("AUTH0_DOMAIN not set. JWT validation will fail.")

    yield

    # Shutdown
    logger.info("Shutting down Auth0 FastAPI API")


# ─── FastAPI Application ────────────────────────────────────

app = FastAPI(
    title="Auth0 FastAPI API",
    description="FastAPI application secured with Auth0 JWT validation and RBAC",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS Middleware ─────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=86400,  # Cache preflight for 24 hours
)


# ─── Request Logging Middleware ──────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests with timing."""
    start_time = datetime.utcnow()

    response = await call_next(request)

    duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

    # Skip health check logging
    if request.url.path != "/api/health":
        logger.info(
            f"{request.method} {request.url.path} "
            f"- {response.status_code} "
            f"- {duration_ms:.1f}ms "
            f"- {request.client.host if request.client else 'unknown'}"
        )

    return response


# ─── Security Headers Middleware ─────────────────────────────

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    # Remove server header
    if "server" in response.headers:
        del response.headers["server"]

    return response


# ─── Global Exception Handlers ──────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent response format."""
    error_map = {
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        422: "validation_error",
        429: "rate_limited",
    }

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": error_map.get(exc.status_code, "error"),
            "message": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "An internal error occurred",
        },
    )


# ─── Health Check ────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint. No authentication required."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "auth0_domain": AUTH0_DOMAIN or "not configured",
    }


# ─── Register API Routes ────────────────────────────────────

app.include_router(api_router, prefix="/api", tags=["API"])


# ─── Root Endpoint ───────────────────────────────────────────

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Auth0 FastAPI API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
