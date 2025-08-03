#!/bin/bash

# Deploy Complete Meeshy System
# Version: 1.0.0
# Build and deploy all microservices with Docker Compose

set -e

echo "🚀 Starting Meeshy Complete Deployment..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Docker is running"
}

cleanup_previous() {
    log_info "Stopping existing containers..."
    docker compose down --remove-orphans -v 2>/dev/null || true
    
    log_info "Pruning Docker system..."
    docker system prune -f --volumes || true
    
    log_success "Cleanup completed"
}

build_images() {
    log_info "Building all Docker images..."
    docker compose build --no-cache --parallel
    
    if [ $? -eq 0 ]; then
        log_success "All images built successfully"
    else
        log_error "Failed to build images"
        exit 1
    fi
}

start_services() {
    log_info "Starting all services..."
    docker compose up -d
    
    if [ $? -eq 0 ]; then
        log_success "All services started"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

wait_for_health() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts"
        
        # Check PostgreSQL
        if docker compose exec -T postgres pg_isready -U meeshy &> /dev/null; then
            log_success "PostgreSQL is ready"
        else
            log_warning "PostgreSQL not ready yet..."
        fi
        
        # Check Redis
        if docker compose exec -T redis redis-cli ping | grep -q PONG; then
            log_success "Redis is ready"
        else
            log_warning "Redis not ready yet..."
        fi
        
        # Check if all services are running
        if [ "$(docker compose ps --services --filter "status=running" | wc -l)" -eq 6 ]; then
            log_success "All services are running"
            break
        fi
        
        sleep 5
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_error "Services failed to become healthy within timeout"
        docker compose logs
        exit 1
    fi
}

test_endpoints() {
    log_info "Testing service endpoints..."
    
    # Test Gateway
    if curl -f -s http://localhost:3000/health > /dev/null; then
        log_success "Gateway health check passed"
    else
        log_warning "Gateway health check failed"
    fi
    
    # Test Frontend
    if curl -f -s http://localhost:3100 > /dev/null; then
        log_success "Frontend is accessible"
    else
        log_warning "Frontend not accessible"
    fi
    
    # Test Translator
    if curl -f -s http://localhost:8000/health > /dev/null; then
        log_success "Translator health check passed"
    else
        log_warning "Translator health check failed"
    fi
    
    # Test Nginx
    if curl -f -s http://localhost:80 > /dev/null; then
        log_success "Nginx proxy is working"
    else
        log_warning "Nginx proxy not working"
    fi
}

show_status() {
    log_info "=== Final System Status ==="
    docker compose ps
    
    echo ""
    log_info "=== Service URLs ==="
    echo "🌐 Frontend: http://localhost:3100"
    echo "🔧 Gateway API: http://localhost:3000"
    echo "🔄 Translator: http://localhost:8000"
    echo "🗄️  Database: localhost:5432"
    echo "🗃️  Redis: localhost:6379"
    echo "⚡ Nginx: http://localhost:80"
    
    echo ""
    log_info "=== Logs ==="
    echo "View logs: docker compose logs -f [service_name]"
    echo "All logs: docker compose logs -f"
}

# Main execution
main() {
    log_info "Starting deployment process..."
    
    check_docker
    cleanup_previous
    build_images
    start_services
    wait_for_health
    test_endpoints
    show_status
    
    log_success "🎉 Meeshy deployment completed successfully!"
    log_info "Run 'docker compose logs -f' to see live logs"
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    stop)
        log_info "Stopping all services..."
        docker compose down
        log_success "All services stopped"
        ;;
    logs)
        docker compose logs -f "${2:-}"
        ;;
    status)
        docker compose ps
        ;;
    clean)
        log_info "Cleaning up everything..."
        docker compose down -v --remove-orphans
        docker system prune -af --volumes
        log_success "Cleanup completed"
        ;;
    *)
        echo "Usage: $0 {deploy|stop|logs|status|clean}"
        echo "  deploy: Full deployment (default)"
        echo "  stop: Stop all services"
        echo "  logs [service]: Show logs"
        echo "  status: Show service status"
        echo "  clean: Complete cleanup"
        exit 1
        ;;
esac
