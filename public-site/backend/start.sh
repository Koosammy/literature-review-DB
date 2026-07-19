#!/usr/bin/env bash
set -o errexit

PORT="${PORT:-10000}"

echo "Starting public backend on port ${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
