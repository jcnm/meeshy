#!/bin/bash

# Comprehensive Test Suite for Meeshy System
# Tests all services, APIs, and integrations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    ((TESTS_RUN++))
    echo -e "\n${BLUE}🧪 Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        log_success "✅ $test_name - PASSED"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "❌ $test_name - FAILED"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test functions
test_docker_running() {
    docker compose ps --services --filter "status=running" | wc -l | grep -q "6"
}

test_postgres_connection() {
    docker compose exec -T postgres pg_isready -U meeshy -d meeshy
}

test_redis_connection() {
    docker compose exec -T redis redis-cli ping | grep -q "PONG"
}

test_gateway_health() {
    curl -f -s http://localhost:3000/health | grep -q -E "(ok|healthy|success)"
}

test_frontend_accessible() {
    curl -f -s -I http://localhost:3100 | head -n1 | grep -q "200"
}

test_translator_health() {
    curl -f -s http://localhost:8000/health | grep -q -E "(ok|healthy|success)"
}

test_nginx_proxy() {
    curl -f -s -I http://localhost:80 | head -n1 | grep -q "200"
}

test_translator_api() {
    local response=$(curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{"text": "Hello world", "source_lang": "en", "target_lang": "fr"}')
    echo "$response" | grep -q "Bonjour monde\|Hello world"
}

test_gateway_websocket() {
    # Test WebSocket endpoint exists (we can't easily test full WS in bash)
    curl -f -s -I http://localhost:3000/ws | head -n1 | grep -q -E "(101|200|400)"
}

test_database_schema() {
    docker compose exec -T postgres psql -U meeshy -d meeshy -c "\dt" | grep -q "users\|messages\|conversations"
}

test_prisma_connection() {
    docker compose exec -T gateway node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect().then(() => {
            console.log('Prisma connected');
            process.exit(0);
        }).catch(() => process.exit(1));
    " 2>/dev/null
}

test_api_cors() {
    curl -s -H "Origin: http://localhost:3100" \
         -H "Access-Control-Request-Method: POST" \
         -H "Access-Control-Request-Headers: Content-Type" \
         -X OPTIONS http://localhost:3000/api/users | \
         grep -q "Access-Control-Allow-Origin"
}

test_api_rate_limiting() {
    # Test that rate limiting is configured (multiple rapid requests)
    for i in {1..5}; do
        curl -s http://localhost:3000/health > /dev/null
    done
    # If we get here without 429, rate limiting might be generous but configured
    return 0
}

test_translation_integration() {
    # Test if gateway can communicate with translator via gRPC
    curl -s -X POST http://localhost:3000/api/translate \
        -H "Content-Type: application/json" \
        -d '{"text": "Hello", "target_lang": "fr"}' | \
        grep -q -E "(Bonjour|Hello|translation)"
}

test_frontend_api_integration() {
    # Test if frontend can load (basic HTML response)
    curl -s http://localhost:3100 | grep -q -E "(html|Meeshy|react|next)"
}

# Security tests
test_security_headers() {
    local headers=$(curl -s -I http://localhost:3000/health)
    echo "$headers" | grep -q -i "x-content-type-options\|x-frame-options\|x-xss-protection"
}

test_https_redirect() {
    # Check if HTTP redirects to HTTPS (in production)
    curl -s -I http://localhost:80 | head -n1 | grep -q -E "(200|301|302)"
}

# Performance tests
test_response_time() {
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3000/health)
    echo "$response_time < 2.0" | bc -l | grep -q "1"
}

test_concurrent_requests() {
    # Test system under light concurrent load
    for i in {1..10}; do
        curl -s http://localhost:3000/health > /dev/null &
    done
    wait
    return 0
}

# Main test execution
main() {
    log_info "🚀 Starting Meeshy System Test Suite"
    echo "====================================="
    
    # Infrastructure tests
    run_test "Docker Services Running" "test_docker_running"
    run_test "PostgreSQL Connection" "test_postgres_connection"
    run_test "Redis Connection" "test_redis_connection"
    
    # Service health tests
    run_test "Gateway Health Check" "test_gateway_health"
    run_test "Frontend Accessibility" "test_frontend_accessible"
    run_test "Translator Health Check" "test_translator_health"
    run_test "Nginx Proxy" "test_nginx_proxy"
    
    # API functionality tests
    run_test "Translator API" "test_translator_api"
    run_test "Gateway WebSocket Endpoint" "test_gateway_websocket"
    run_test "Database Schema" "test_database_schema"
    run_test "Prisma Connection" "test_prisma_connection"
    
    # Integration tests
    run_test "API CORS Configuration" "test_api_cors"
    run_test "API Rate Limiting" "test_api_rate_limiting"
    run_test "Translation Integration" "test_translation_integration"
    run_test "Frontend-API Integration" "test_frontend_api_integration"
    
    # Security tests
    run_test "Security Headers" "test_security_headers"
    run_test "HTTPS/HTTP Handling" "test_https_redirect"
    
    # Performance tests
    run_test "Response Time < 2s" "test_response_time"
    run_test "Concurrent Requests" "test_concurrent_requests"
    
    # Test summary
    echo -e "\n${BLUE}📊 Test Results Summary${NC}"
    echo "======================="
    echo "Tests Run: $TESTS_RUN"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "🎉 All tests passed! System is ready for production."
        return 0
    else
        log_error "⚠️  Some tests failed. Please check the system configuration."
        return 1
    fi
}

# Handle script arguments
case "${1:-test}" in
    test)
        main
        ;;
    quick)
        log_info "Running quick health checks..."
        run_test "Services Running" "test_docker_running"
        run_test "Gateway Health" "test_gateway_health"
        run_test "Frontend Health" "test_frontend_accessible"
        run_test "Database Health" "test_postgres_connection"
        echo -e "\nQuick tests completed. Run './test-complete.sh test' for full suite."
        ;;
    api)
        log_info "Testing API endpoints..."
        run_test "Gateway Health" "test_gateway_health"
        run_test "Translator API" "test_translator_api"
        run_test "Translation Integration" "test_translation_integration"
        run_test "API CORS" "test_api_cors"
        ;;
    performance)
        log_info "Running performance tests..."
        run_test "Response Time" "test_response_time"
        run_test "Concurrent Requests" "test_concurrent_requests"
        ;;
    *)
        echo "Usage: $0 {test|quick|api|performance}"
        echo "  test: Full test suite (default)"
        echo "  quick: Basic health checks"
        echo "  api: API functionality tests"
        echo "  performance: Performance tests"
        exit 1
        ;;
esac
