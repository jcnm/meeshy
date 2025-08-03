#!/bin/bash

set -e

echo "🚀 Quick Meeshy Deployment (Minimal Services)"
echo "============================================="

echo "⚠️  Note: This deployment focuses on core services only"
echo "    Frontend and Gateway builds have TypeScript/dependency issues"
echo "    Deploying: PostgreSQL, Redis, Translator services"
echo ""

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose down --remove-orphans --volumes 2>/dev/null || true

# Build only translator (it works successfully)
echo "🔨 Building translator service..."
if docker compose build translator --no-cache; then
    echo "✅ Translator image built successfully"
else
    echo "❌ Translator build failed"
    exit 1
fi

# Start the infrastructure services first
echo "🗄️ Starting infrastructure services..."
docker compose up -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Start translator service
echo "🔤 Starting translator service..."
docker compose up -d translator

# Check service status
echo "🔍 Checking service status..."
sleep 5

echo ""
echo "📊 Service Status Summary:"
echo "========================="

# Check each service
services=("postgres" "redis" "translator")
for service in "${services[@]}"; do
    if docker compose ps "$service" 2>/dev/null | grep -q "Up"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
        echo "   Logs:"
        docker compose logs "$service" 2>/dev/null | tail -5 | sed 's/^/   /'
    fi
done

echo ""
echo "🚀 Core Services Deployed Successfully!"
echo ""
echo "📍 Available Endpoints:"
echo "  🔤 Translator Service: http://localhost:8001"
echo "  🗄️ PostgreSQL:        localhost:5432"
echo "  📦 Redis:             localhost:6379"
echo ""
echo "⚠️  Issues Found:"
echo "  ❌ Frontend build fails: Missing UI components (@/components/ui/badge, card, button)"
echo "  ❌ Gateway build fails: TypeScript import errors and shared/* dependency issues"
echo ""
echo "🔧 To fix frontend issues:"
echo "  1. Install missing shadcn/ui components: pnpm dlx shadcn-ui@latest add card button badge"
echo "  2. Fix import paths in admin components"
echo ""
echo "🔧 To fix gateway issues:"
echo "  1. Fix shared module imports (../../shared/generated vs ../../../shared/generated)"
echo "  2. Update nice-grpc imports and TypeScript configurations"
echo "  3. Resolve zod error handling (error.issues vs error.errors)"
echo ""
echo "📋 Useful Commands:"
echo "  View logs:       docker compose logs [service]"
echo "  Stop services:   docker compose down"
echo "  Restart service: docker compose restart [service]"

# Show running containers
echo ""
echo "🐳 Currently Running:"
docker compose ps

echo ""
echo "✨ Core Meeshy services are now running!"
echo "   Visit http://localhost:8001/health to test the translator API"
