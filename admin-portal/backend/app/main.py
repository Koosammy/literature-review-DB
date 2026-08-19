from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api import auth, users, projects, dashboard, profile, utils
from app.core.config import settings
from app.database import engine
from app.models import Base

# Create FastAPI app
app = FastAPI(title="Literature Review Database - Admin Portal")

# Static files are deployment assets bundled with the application.
# Runtime uploads are stored exclusively in PostgreSQL.
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)

print("🚀 Starting Literature Review Database - Admin Portal")
print("🗄️ Runtime upload storage: PostgreSQL")
print(f"📁 Static asset directory: {STATIC_DIR}")

# Configure CORS
configured_origins = list(settings.CORS_ORIGINS)
for origin in [settings.ADMIN_SITE_URL, settings.FRONTEND_URL]:
    if origin and origin not in configured_origins:
        configured_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_origin_regex=r"https://research-hub-admin-portal[-a-z0-9]*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers FIRST
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# Backward-compatible auth routes for deployments whose frontend API URL omits `/api`.
app.include_router(auth.router, prefix="/auth", tags=["auth-compat"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(utils.router, prefix="/api/utils", tags=["utils"])

# Backward-compatible API routes for deployments whose frontend API URL omits `/api`.
app.include_router(auth.router, prefix="/auth", tags=["auth-compat"])
app.include_router(users.router, prefix="/users", tags=["users-compat"])
app.include_router(projects.router, prefix="/projects", tags=["projects-compat"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard-compat"])
app.include_router(profile.router, prefix="/profile", tags=["profile-compat"])
app.include_router(utils.router, prefix="/utils", tags=["utils-compat"])

# Fixed validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_messages = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        message = error["msg"]
        error_messages.append(f"{field}: {message}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "; ".join(error_messages),
            "type": "validation_error",
            "errors": [
                {
                    "loc": list(error["loc"]),
                    "msg": error["msg"],
                    "type": error["type"]
                }
                for error in exc.errors()
            ]
        }
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    print(f"\n{'='*60}")
    print(f"🚀 Literature Review Database - Admin Portal v1.0.0")
    print(f"{'='*60}")
    
    print("\n🗄️ Persistent runtime storage: PostgreSQL")
    print("   - project documents: projects.document_data")
    print("   - project images/tables: project_images.image_data")
    print("   - profile photos: users.profile_image_data")

    # Check if React build exists
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        print(f"✅ React build found at {index_path}")
    else:
        print(f"⚠️  React build not found - frontend routes will return 404")
    
    # Debug: Print registered routes
    print(f"\n📍 Registered Routes:")
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            methods = ', '.join(route.methods) if route.methods else 'N/A'
            print(f"   {methods:8} {route.path}")
    print(f"{'='*60}\n")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Literature Review Database - Admin Portal API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# API root endpoint
@app.get("/api")
async def api_root():
    return {
        "message": "Literature Review Database - Admin Portal API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }

# Health check endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "admin-portal-api"}

@app.get("/api/health")
async def api_health_check():
    """Health check endpoint for database-backed runtime storage."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "connected",
        "frontend": (STATIC_DIR / "index.html").exists(),
        "storage": {
            "backend": "database",
            "project_documents": "projects.document_data",
            "project_images": "project_images.image_data",
            "profile_photos": "users.profile_image_data",
            "ephemeral_upload_folders_used": False,
        },
        "paths": {
            "base_dir": str(BASE_DIR),
            "static_dir": str(STATIC_DIR),
        },
    }

# Serve static files (React build) - this should be after API routes
if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    print(f"✅ React static files mounted at /static")

# Serve React app root
@app.get("/app")
async def serve_app_root():
    """Serve the React app root"""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    else:
        return JSONResponse(
            status_code=200,
            content={
                "message": "Literature Review Admin Portal API",
                "docs": "/docs",
                "api": "/api",
                "note": "Frontend not deployed. Please build and deploy the React app."
            }
        )

# Catch-all route for client-side routing - MUST BE LAST
@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    """Serve the React app for all non-API routes"""
    # Skip API routes, uploads, docs, and static files
    if (full_path.startswith("api/") or 
        full_path.startswith("docs") or 
        full_path.startswith("redoc") or
        full_path.startswith("openapi.json") or
        full_path.startswith("static/") or
        full_path.startswith("health")):
        # Let FastAPI handle 404 for these routes
        return JSONResponse(
            status_code=404,
            content={"detail": f"Path '{full_path}' not found"}
        )
    
    # For all other routes, serve the React app (if it exists)
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    else:
        # If no React build, return a helpful message
        return JSONResponse(
            status_code=404,
            content={
                "detail": "Frontend not found",
                "message": "The React app has not been built or deployed.",
                "api_docs": "/docs",
                "api_root": "/api"
            }
        )

# Create tables
Base.metadata.create_all(bind=engine)


def _apply_lightweight_migrations() -> None:
    """Add columns that `create_all` can't add to already-existing tables.

    This project deploys by running `create_all` at import time rather than
    an Alembic migration step, so a new Column on an existing model (e.g.
    User.title) never actually reaches the production table on its own.
    Each statement is idempotent (IF NOT EXISTS) and independently guarded
    so one failure (e.g. insufficient privileges) doesn't block the rest.
    """
    from sqlalchemy import text

    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_set_password BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_data BYTEA",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_content_type VARCHAR(100)",
    ]
    # A separate connection/transaction per statement: on Postgres, one
    # failed statement aborts the rest of its transaction, so sharing one
    # connection across statements would make them not-actually-independent.
    for statement in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception as exc:
            print(f"⚠️ Migration step failed ({statement}): {exc}")


_apply_lightweight_migrations()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8001,
        reload=True,
        log_level="info"
    )
