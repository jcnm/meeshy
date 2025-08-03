#!/bin/bash
# Meeshy - Production Health Check Script for Microservices

set -e

echo "🏥 Meeshy Health Check - Microservices Architecture"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check function
check_service() {
    local service_name=$1
    local url=$2
    local timeout=${3:-10}
    
    echo -n "Checking $service_name... "
    
    if curl -f -s --max-time $timeout "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
        return 0
    else
        echo -e "${RED}❌ UNHEALTHY${NC}"
        return 1
    fi
}

# Check database
echo -n "Checking PostgreSQL... "
if docker exec meeshy-postgres pg_isready -U meeshy -d meeshy > /dev/null 2>&1; then
    echo -e "${GREEN}✅ HEALTHY${NC}"
else
    echo -e "${RED}❌ UNHEALTHY${NC}"
    exit 1
fi

# Check Redis
echo -n "Checking Redis... "
if docker exec meeshy-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ HEALTHY${NC}"
else
    echo -e "${RED}❌ UNHEALTHY${NC}"
    exit 1
fi

# Check services
check_service "Translator Service" "http://localhost:8000/health" 15
check_service "Gateway Service" "http://localhost:3000/health" 10
check_service "Frontend Service" "http://localhost:3100" 10

echo ""
echo -e "${GREEN}🎉 All services are healthy!${NC}"
echo ""

# Additional checks
echo "📊 Service Status Summary:"
echo "========================="
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Resource Usage:"
echo "=================="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
echo -e "${GREEN}✅ Health check completed successfully!${NC}"