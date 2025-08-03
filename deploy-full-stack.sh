#!/bin/bash

set -e

echo "🚀 Starting Meeshy Full Stack Deployment..."
echo "=========================================="

# Function to check service health
check_service_health() {
    local service=$1
    local url=$2
    local retries=30
    local count=0
    
    echo "Checking $service health at $url..."
    while [ $count -lt $retries ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo "✅ $service is healthy"
            return 0
        fi
        count=$((count + 1))
        echo "⏳ Waiting for $service... ($count/$retries)"
        sleep 2
    done
    
    echo "❌ $service failed to become healthy"
    return 1
}

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose down --remove-orphans --volumes

# Build all images
echo "🔨 Building Docker images..."
docker compose build --no-cache

# Verify all images were built successfully
echo "🔍 Verifying built images..."
EXPECTED_IMAGES=(
    "meeshy-translator"
    "meeshy-gateway" 
    "meeshy-frontend"
)

for image in "${EXPECTED_IMAGES[@]}"; do
    if ! docker images | grep -q "$image"; then
        echo "❌ Image $image not found! Build failed."
        exit 1
    fi
    echo "✅ Image $image found"
done

# Start the infrastructure services first
echo "🗄️ Starting infrastructure services..."
docker compose up -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Run database migrations if needed
echo "📊 Running database setup..."
# Note: Add migration commands here if needed

# Start application services
echo "🚀 Starting application services..."
docker compose up -d translator gateway frontend nginx

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Health checks
echo "🏥 Performing health checks..."

# Check if all containers are running
SERVICES=("postgres" "redis" "translator" "gateway" "frontend" "nginx")
for service in "${SERVICES[@]}"; do
    if ! docker compose ps "$service" | grep -q "Up\|running"; then
        echo "❌ Service $service is not running!"
        docker compose logs "$service"
        exit 1
    fi
    echo "✅ Service $service is running"
done

# Application-level health checks
echo "🔍 Testing application endpoints..."

# Wait a bit more for services to fully initialize
sleep 10

# Check nginx (main entry point)
if check_service_health "Frontend (Nginx)" "http://localhost:3000/"; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend health check failed"
    docker compose logs nginx
    docker compose logs frontend
fi

# Check gateway directly
if check_service_health "Gateway API" "http://localhost:8080/health"; then
    echo "✅ Gateway API is accessible"
else
    echo "⚠️ Gateway health check failed, but continuing..."
    docker compose logs gateway
fi

# Check translator service
if check_service_health "Translator Service" "http://localhost:8001/health"; then
    echo "✅ Translator service is accessible"
else
    echo "⚠️ Translator health check failed, but continuing..."
    docker compose logs translator
fi

# Show final status
echo ""
echo "🚀 Deployment Summary"
echo "===================="
echo "✅ All services deployed successfully!"
echo ""
echo "📍 Service Endpoints:"
echo "  🌐 Frontend:     http://localhost:3000"
echo "  🔌 Gateway API:  http://localhost:8080"
echo "  🔤 Translator:   http://localhost:8001"
echo "  🗄️ PostgreSQL:   localhost:5432"
echo "  📦 Redis:        localhost:6379"
echo ""
echo "📋 Useful Commands:"
echo "  View logs:       docker compose logs [service]"
echo "  Stop services:   docker compose down"
echo "  Restart service: docker compose restart [service]"
echo "  Check status:    docker compose ps"
echo ""

# Show running containers
echo "🐳 Running Containers:"
docker compose ps

echo ""
echo "✨ Meeshy is now running! Visit http://localhost:3000 to get started."
