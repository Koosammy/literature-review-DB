from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import os
import logging
import time
import uuid

from .api import projects, sitemap, diagnostics
from .database import engine
from .models.base import Base

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Literature Review Public API",
    description="Public API for accessing published research projects",
    version="1.0.0"
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    start_time = time.perf_counter()
    logger.info(
        "request_started request_id=%s method=%s path=%s query=%s client=%s user_agent=%s referer=%s",
        request_id,
        request.method,
        request.url.path,
        request.url.query,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        request.headers.get("referer"),
    )
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.exception(
            "request_failed request_id=%s method=%s path=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_finished request_id=%s method=%s path=%s status_code=%s duration_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_exception method=%s path=%s query=%s client=%s",
        request.method,
        request.url.path,
        request.url.query,
        request.client.host if request.client else None,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(sitemap.router, prefix="/api", tags=["sitemap"])
app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["diagnostics"])

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "storage": "database",
        "description": "Images and documents are served from database"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Literature Review Public API",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": {
            "projects": "/api/projects",
            "project_detail": "/api/projects/{slug}",
            "project_image": "/api/projects/{project_id}/images/{image_id}",
            "project_document": "/api/projects/{slug}/download",
            "stats": "/api/projects/stats",
            "sitemap": "/api/sitemap.xml"
        }
    }

# Optional: Add startup event for logging
@app.on_event("startup")
async def startup_event():
    """Log startup information"""
    print("=" * 60)
    print("Literature Review Public API Started")
    print("=" * 60)
    print("Storage: Database (images and documents)")
    print("API Docs: /docs")
    print("=" * 60)

# Optional: Add debug endpoint to check database connection
@app.get("/api/debug/db-check")
async def check_database():
    """Check database connection and table existence"""
    from sqlalchemy import inspect
    from .database import engine
    
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        return {
            "database": "connected",
            "tables": tables,
            "has_projects": "projects" in tables,
            "has_project_images": "project_images" in tables
        }
    except Exception as e:
        return {
            "database": "error",
            "error": str(e)
        }
