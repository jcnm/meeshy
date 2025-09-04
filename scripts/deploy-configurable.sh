#!/bin/bash

# Database Deployment Script for Meeshy
# This script deploys Meeshy with configurable database (MongoDB or PostgreSQL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SERVER_IP=""
DATABASE_TYPE="MONGODB"
DOMAIN="meeshy.me"
CERTBOT_EMAIL="admin@meeshy.me"
DEPLOY_SSL=false
SHOW_HELP=false
ENVIRONMENT="prod"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS] SERVER_IP"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE       Database type: MONGODB or POSTGRESQL (default: MONGODB)"
    echo "  -d, --domain DOMAIN   Domain name for SSL (default: meeshy.me)"
    echo "  -e, --email EMAIL     Email for Let's Encrypt (default: admin@meeshy.me)"
    echo "  -s, --ssl             Deploy with SSL certificates"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 157.230.15.51                    # Deploy with MongoDB (default)"
    echo "  $0 -t POSTGRESQL 157.230.15.51      # Deploy with PostgreSQL"
    echo "  $0 -s -d example.com 157.230.15.51  # Deploy with SSL for example.com"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_TYPE         Database type (MONGODB or POSTGRESQL)"
    echo "  DOMAIN               Domain name for SSL"
    echo "  CERTBOT_EMAIL        Email for Let's Encrypt"
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                DATABASE_TYPE="$2"
                shift 2
                ;;
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -e|--email)
                CERTBOT_EMAIL="$2"
                shift 2
                ;;
            -s|--ssl)
                DEPLOY_SSL=true
                shift
                ;;
            -h|--help)
                SHOW_HELP=true
                shift
                ;;
            -*)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                if [ -z "$SERVER_IP" ]; then
                    SERVER_IP="$1"
                else
                    print_error "Multiple server IPs specified: $SERVER_IP and $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# Function to validate arguments
validate_arguments() {
    if [ "$SHOW_HELP" = true ]; then
        show_help
        exit 0
    fi
    
    if [ -z "$SERVER_IP" ]; then
        print_error "Server IP is required"
        show_help
        exit 1
    fi
    
    # Validate database type
    case "$DATABASE_TYPE" in
        MONGODB|POSTGRESQL)
            ;;
        *)
            print_error "Invalid database type: $DATABASE_TYPE"
            print_error "Valid types: MONGODB, POSTGRESQL"
            exit 1
            ;;
    esac
    
    # Validate domain
    if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        print_error "Invalid domain name: $DOMAIN"
        exit 1
    fi
    
    # Validate email
    if [[ ! "$CERTBOT_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        print_error "Invalid email address: $CERTBOT_EMAIL"
        exit 1
    fi
}

# Function to configure database for production
configure_database_prod() {
    print_status "Configuring $DATABASE_TYPE for production deployment"
    
    if [ -f "scripts/configure-database.sh" ]; then
        ./scripts/configure-database.sh -t "$DATABASE_TYPE" -e prod
    else
        print_error "Database configuration script not found"
        exit 1
    fi
}

# Function to test SSH connection
test_ssh_connection() {
    print_status "Testing SSH connection to $SERVER_IP..."
    
    if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@"$SERVER_IP" "echo 'SSH connection successful'" >/dev/null 2>&1; then
        print_error "Failed to connect to $SERVER_IP via SSH"
        print_error "Please ensure:"
        print_error "  1. The server is accessible"
        print_error "  2. SSH key is configured"
        print_error "  3. Firewall allows SSH connections"
        exit 1
    fi
    
    print_status "SSH connection successful"
}

# Function to deploy to server
deploy_to_server() {
    print_status "Deploying to server $SERVER_IP..."
    
    # Create deployment directory on server
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "mkdir -p /opt/meeshy"
    
    # Copy configuration files
    print_status "Copying configuration files..."
    scp -o StrictHostKeyChecking=no docker-compose.prod.yml root@"$SERVER_IP":/opt/meeshy/docker-compose.yml
    scp -o StrictHostKeyChecking=no .env.database root@"$SERVER_IP":/opt/meeshy/.env
    
    # Copy shared files individually to avoid directory issues
    print_status "Copying shared files..."
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "mkdir -p /opt/meeshy/shared"
    scp -o StrictHostKeyChecking=no shared/init-database.sh root@"$SERVER_IP":/opt/meeshy/shared/
    scp -o StrictHostKeyChecking=no shared/init-mongo.js root@"$SERVER_IP":/opt/meeshy/shared/
    scp -o StrictHostKeyChecking=no shared/init-postgresql.sql root@"$SERVER_IP":/opt/meeshy/shared/
    scp -o StrictHostKeyChecking=no shared/schema.prisma root@"$SERVER_IP":/opt/meeshy/shared/
    scp -o StrictHostKeyChecking=no shared/schema.postgresql.prisma root@"$SERVER_IP":/opt/meeshy/shared/
    scp -o StrictHostKeyChecking=no shared/version.txt root@"$SERVER_IP":/opt/meeshy/shared/
    
    # Note: Les scripts d'entrée MongoDB sont maintenant intégrés dans l'image Docker
    print_status "Scripts d'entrée MongoDB intégrés dans l'image Docker"
    
    # Copy nginx configuration
    print_status "Copying nginx configuration..."
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "mkdir -p /opt/meeshy/docker/nginx"
    scp -o StrictHostKeyChecking=no docker/nginx/prod.conf root@"$SERVER_IP":/opt/meeshy/docker/nginx/
    scp -o StrictHostKeyChecking=no docker/nginx/nginx.conf root@"$SERVER_IP":/opt/meeshy/docker/nginx/
    
    # Copy scripts
    print_status "Copying deployment scripts..."
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "mkdir -p /opt/meeshy/scripts"
    scp -o StrictHostKeyChecking=no scripts/manage-ssl.sh root@"$SERVER_IP":/opt/meeshy/scripts/
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "chmod +x /opt/meeshy/scripts/manage-ssl.sh"
    
    print_status "Files copied successfully"
}

# Function to start services
start_services() {
    print_status "Starting services on server..."
    
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "cd /opt/meeshy && docker-compose down || true"
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "cd /opt/meeshy && docker-compose up -d"
    
    print_status "Services started, waiting for health checks..."
    sleep 30
    
    # Check service status
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "cd /opt/meeshy && docker-compose ps"
}

# Function to deploy SSL
deploy_ssl() {
    if [ "$DEPLOY_SSL" = false ]; then
        return
    fi
    
    print_status "Deploying SSL certificates for domain: $DOMAIN"
    
    ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "cd /opt/meeshy && ./scripts/manage-ssl.sh prod $DOMAIN $CERTBOT_EMAIL"
    
    print_status "SSL deployment completed"
}

# Function to show deployment summary
show_deployment_summary() {
    print_header "$DATABASE_TYPE Production Deployment Summary"
    echo "Server IP: $SERVER_IP"
    echo "Environment: Production"
    echo "Database: $DATABASE_TYPE"
    echo "Domain: $DOMAIN"
    echo "SSL Deployed: $DEPLOY_SSL"
    echo ""
    
    echo "Services deployed:"
    echo "  - Database: $DATABASE_TYPE"
    echo "  - Redis: Cache service"
    echo "  - Translator: ML translation service (production image)"
    echo "  - Gateway: API gateway (production image)"
    echo "  - Frontend: Next.js application (production image)"
    echo "  - Nginx: Reverse proxy with SSL"
    echo "  - Certbot: Let's Encrypt certificates"
    echo ""
    
    if [ "$DEPLOY_SSL" = true ]; then
        echo "SSL Configuration:"
        echo "  - Domain: $DOMAIN"
        echo "  - Email: $CERTBOT_EMAIL"
        echo "  - Certificates: Let's Encrypt"
        echo ""
    fi
    
    echo "Access URLs:"
    echo "  - Frontend: http://$SERVER_IP:3100"
    echo "  - API Gateway: http://$SERVER_IP:3000"
    echo "  - Translator: http://$SERVER_IP:8000"
    echo "  - Nginx: http://$SERVER_IP"
    
    if [ "$DEPLOY_SSL" = true ]; then
        echo "  - HTTPS: https://$DOMAIN"
    fi
    
    echo ""
    echo "Docker Compose Files:"
    echo "  - Local: docker-compose.dev.yml (development)"
    echo "  - Server: docker-compose.prod.yml (production)"
    echo ""
    
    echo "Next steps:"
    echo "  1. Wait for all services to be healthy"
    echo "  2. Test the application endpoints"
    echo "  3. Configure your domain DNS to point to $SERVER_IP"
    if [ "$DEPLOY_SSL" = true ]; then
        echo "  4. SSL certificates will auto-renew"
    fi
}

# Main script
main() {
    print_header "Meeshy $DATABASE_TYPE Production Deployment"
    
    # Parse and validate arguments
    parse_arguments "$@"
    validate_arguments
    
    # Show deployment configuration
    print_status "Deployment Configuration:"
    echo "  Server IP: $SERVER_IP"
    echo "  Environment: Production"
    echo "  Database: $DATABASE_TYPE"
    echo "  Domain: $DOMAIN"
    echo "  SSL: $DEPLOY_SSL"
    echo ""
    
    # Configure database for production
    configure_database_prod
    
    # Test SSH connection
    test_ssh_connection
    
    # Deploy to server
    deploy_to_server
    
    # Start services
    start_services
    
    # Deploy SSL if requested
    deploy_ssl
    
    # Show summary
    show_deployment_summary
    
    print_status "$DATABASE_TYPE production deployment completed successfully!"
}

# Run main function
main "$@"
