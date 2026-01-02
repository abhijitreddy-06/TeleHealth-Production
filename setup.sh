#!/bin/bash
# Move files to correct structure
mkdir -p public pages
cp -r frontend/public/* public/ 2>/dev/null || true
cp -r frontend/pages/* public/pages/ 2>/dev/null || true
cp -r frontend/views/* views/ 2>/dev/null || true
cp backend/server.js ./
cp backend/.env ./

# Clean up old folders
rm -rf frontend backend

echo "✅ Structure fixed! Ready to deploy."