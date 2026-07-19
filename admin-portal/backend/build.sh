#!/usr/bin/env bash
set -o errexit

echo "=== Starting Admin Portal Build ==="
echo "Timestamp: $(date)"

echo "1. Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "2. Checking database connection..."
python -c "
from app.database import engine
from sqlalchemy import text
try:
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database connection failed: {e}')
    exit(1)
"

echo "3. Running database migrations..."
alembic upgrade head

python -c "
from app.database import engine
from app.models import Base
print('Creating any missing database tables...')
Base.metadata.create_all(bind=engine)
print('✓ Database tables ready')
"

echo "4. Testing database storage..."
python -c "
from app.core.config import settings
print(f'Storage backend: {settings.STORAGE_BACKEND}')
print(f'Max file size: {settings.MAX_FILE_SIZE / 1024 / 1024:.1f}MB')
print(f'Allowed file types: {settings.ALLOWED_FILE_TYPES}')

try:
    from app.services.database_storage import database_storage
    health = database_storage.health_check()
    print(f'✓ Database storage service: {health[\"status\"]}')
except Exception as e:
    print(f'⚠️  Database storage test failed: {e}')
"

echo "5. Creating/verifying admin user..."
if [ -f create_admin.py ]; then
    python create_admin.py || echo "Admin user might already exist"
else
    echo "Warning: create_admin.py not found, skipping admin creation"
fi

echo "=== Admin Portal Build Completed Successfully ==="
