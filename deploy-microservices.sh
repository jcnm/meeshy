#!/bin/bash
# Meeshy - Production Deployment Script for Microservices

set -e

echo "🚀 Meeshy Deployment - Microservices Architecture"
echo "================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Function to display step
step() {
    echo -e "${BLUE}📋 Step $1: $2${NC}"
}

# Step 1: Clean up
step 1 "Cleaning up previous deployment"
docker-compose down --remove-orphans --volumes 2>/dev/null || true
docker system prune -f

# Step 2: Install dependencies
step 2 "Installing dependencies"
if command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi

# Step 3: Build images
step 3 "Building Docker images"
docker-compose build --no-cache --parallel

# Step 4: Start services
step 4 "Starting services"
docker-compose up -d

# Step 5: Wait for services
step 5 "Waiting for services to be ready"
echo "Waiting 30 seconds for services to initialize..."
sleep 30

# Step 6: Run health check
step 6 "Running health checks"
./docker-health-check.sh

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📱 Access your services:"
echo "  Frontend: http://localhost:3100"
echo "  Gateway API: http://localhost:3000"
echo "  Translator API: http://localhost:8000"
echo ""
echo "📊 Monitor with:"
echo "  docker-compose -f docker-compose.new.yml logs -f"
echo "  docker-compose -f docker-compose.new.yml ps"
echo ""
echo -e "${YELLOW}Happy messaging! 💬${NC}"
