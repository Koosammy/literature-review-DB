from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from app.api import auth, users, projects, dashboard, profile, utils
from app.core.config import settings
from app.database import engine
from app.models import Base

# Create FastAPI app
app = FastAPI(title="Literature Review Database - Admin Portal")

# Get the base directory
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"

# Create directories if they don't exist
UPLOAD_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Create subdirectories for uploads
(UPLOAD_DIR / "profile_images").mkdir(exist_ok=True)
(UPLOAD_DIR / "projects").mkdir(exist_ok=True)

print(f"🚀 Starting Literature Review Database - Admin Portal")
print(f"📁 Base directory: {BASE_DIR}")
print(f"📁 Upload directory: {UPLOAD_DIR}")
print(f"📁 Upload directory exists: {UPLOAD_DIR.exists()}")
print(f"📁 Static directory: {STATIC_DIR}")

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

# IMPORTANT: Add the fallback route for uploads BEFORE mounting static files
@app.get("/api/uploads/{file_path:path}")
async def serve_upload_file(file_path: str):
    """Serve uploaded files"""
    file_full_path = UPLOAD_DIR / file_path
    
    # Log for debugging
    print(f"📁 File request: /api/uploads/{file_path}")
    print(f"   Full path: {file_full_path}")
    print(f"   Exists: {file_full_path.exists()}")
    
    if file_full_path.exists() and file_full_path.is_file():
        # Determine content type
        content_type = "application/octet-stream"
        if file_path.endswith('.png'):
            content_type = "image/png"
        elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
            content_type = "image/jpeg"
        elif file_path.endswith('.gif'):
            content_type = "image/gif"
        elif file_path.endswith('.webp'):
            content_type = "image/webp"
        elif file_path.endswith('.pdf'):
            content_type = "application/pdf"
        
        return FileResponse(
            path=str(file_full_path),
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            }
        )
    
    # If not found, provide detailed error
    parent_dir = file_full_path.parent
    dir_contents = []
    if parent_dir.exists():
        dir_contents = [f.name for f in parent_dir.iterdir() if f.is_file()][:5]
    
    return JSONResponse(
        status_code=404,
        content={
            "error": "File not found",
            "requested_path": file_path,
            "full_path": str(file_full_path),
            "exists": file_full_path.exists(),
            "parent_exists": parent_dir.exists(),
            "sample_files_in_directory": dir_contents
        }
    )

# Try to mount static files, but don't fail if it doesn't work
try:
    app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
    print(f"✅ Mounted static files at /api/uploads")
except Exception as e:
    print(f"⚠️  Could not mount static files: {e}")
    print(f"   Using fallback route instead")

# Alternative route without /api prefix
@app.get("/uploads/{path:path}")
async def serve_upload_alt(path: str):
    """Alternative upload route"""
    return await serve_upload_file(path)

# Debug endpoint
@app.get("/api/debug/uploads")
async def debug_uploads():
    """Debug endpoint to check upload directory structure"""
    structure = {}
    
    if UPLOAD_DIR.exists():
        for root, dirs, files in os.walk(UPLOAD_DIR):
            rel_root = os.path.relpath(root, UPLOAD_DIR)
            structure[rel_root] = {
                "dirs": dirs,
                "files": files[:5]  # Limit to 5 files per directory
            }
    
    return {
        "upload_dir": str(UPLOAD_DIR),
        "exists": UPLOAD_DIR.exists(),
        "structure": structure
    }

# Test specific file
@app.get("/api/debug/test-file/{file_path:path}")
async def test_file(file_path: str):
    """Test if a specific file can be accessed"""
    full_path = UPLOAD_DIR / file_path
    
    return {
        "requested": file_path,
        "full_path": str(full_path),
        "exists": full_path.exists(),
        "is_file": full_path.is_file() if full_path.exists() else False,
        "size": full_path.stat().st_size if full_path.exists() and full_path.is_file() else None,
        "parent_exists": full_path.parent.exists(),
        "parent_contents": [f.name for f in full_path.parent.iterdir()] if full_path.parent.exists() else []
    }

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
    
    # Verify directories
    print(f"\n📁 Directory Status:")
    print(f"   Base: {BASE_DIR}")
    print(f"   - uploads/ {'✅' if UPLOAD_DIR.exists() else '❌'} at {UPLOAD_DIR}")
    print(f"   - uploads/profile_images/ {'✅' if (UPLOAD_DIR / 'profile_images').exists() else '❌'}")
    print(f"   - uploads/projects/ {'✅' if (UPLOAD_DIR / 'projects').exists() else '❌'}")
    print(f"   - static/ {'✅' if STATIC_DIR.exists() else '❌'}")
    
    # Test file serving
    test_file_path = UPLOAD_DIR / "test.txt"
    try:
        test_file_path.write_text("test")
        print(f"   - Write test: ✅")
        test_file_path.unlink()
    except Exception as e:
        print(f"   - Write test: ❌ {e}")
    
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
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "connected",
        "upload_dirs": {
            "uploads": UPLOAD_DIR.exists(),
            "projects": (UPLOAD_DIR / "projects").exists(),
            "profile_images": (UPLOAD_DIR / "profile_images").exists()
        },
        "frontend": (STATIC_DIR / "index.html").exists(),
        "paths": {
            "base_dir": str(BASE_DIR),
            "upload_dir": str(UPLOAD_DIR),
            "static_dir": str(STATIC_DIR)
        }
    }

# Debug endpoint to list files
@app.get("/api/debug/list-uploads")
async def list_uploads():
    """List all files in uploads directory"""
    files = []
    if UPLOAD_DIR.exists():
        for root, dirs, filenames in os.walk(UPLOAD_DIR):
            for filename in filenames:
                rel_path = os.path.relpath(os.path.join(root, filename), UPLOAD_DIR)
                files.append(rel_path)
    return {
        "upload_dir": str(UPLOAD_DIR),
        "exists": UPLOAD_DIR.exists(),
        "files": files,
        "total_files": len(files)
    }

# Test route for static files
@app.get("/test-static")
async def test_static():
    """Test if static files are accessible"""
    test_files = []
    if UPLOAD_DIR.exists():
        for root, dirs, files in os.walk(UPLOAD_DIR):
            for file in files[:5]:  # Limit to first 5 files
                rel_path = os.path.relpath(os.path.join(root, file), UPLOAD_DIR)
                test_files.append({
                    "path": rel_path,
                    "urls": [
                        f"/uploads/{rel_path}",
                        f"/api/uploads/{rel_path}"
                    ]
                })
    
    return {
        "message": "Static file test",
        "upload_dir": str(UPLOAD_DIR),
        "exists": UPLOAD_DIR.exists(),
        "sample_files": test_files,
        "instructions": "Try accessing the URLs listed in sample_files"
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
        full_path.startswith("uploads/") or 
        full_path.startswith("docs") or 
        full_path.startswith("redoc") or
        full_path.startswith("openapi.json") or
        full_path.startswith("static/") or
        full_path.startswith("test-static") or
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8001,
        reload=True,
        log_level="info"
    )
