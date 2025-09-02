#!/bin/bash

# Build and Push Docker Images Script for Meeshy
# This script builds and pushes images with latest and version tags

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_REGISTRY="isopen"
PROJECT_NAME="meeshy"
VERSION_FILE="shared/version.txt"

# Default values
BUILD_TYPE="all"
PUSH_IMAGES=false
FORCE_BUILD=false
DRY_RUN=false

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
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE       Build type (all, frontend, gateway, translator)"
    echo "  -p, --push            Push images to registry"
    echo "  -f, --force           Force rebuild without cache"
    echo "  -d, --dry-run         Show what would be done without executing"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build all images locally"
    echo "  $0 -t frontend        # Build only frontend image"
    echo "  $0 -p                 # Build and push all images"
    echo "  $0 -t gateway -p      # Build and push only gateway image"
    echo "  $0 -f -p              # Force rebuild and push all images"
    echo ""
    echo "Build Types:"
    echo "  all         - Build all images (default)"
    echo "  frontend    - Build only frontend image"
    echo "  gateway     - Build only gateway image"
    echo "  translator  - Build only translator image"
}

# Function to get version
get_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE"
    else
        echo "1.0.0"
    fi
}

# Function to get git commit hash
get_git_hash() {
    if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
        git rev-parse --short HEAD 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Function to build image
build_image() {
    local service="$1"
    local dockerfile="$2"
    local context="$3"
    local build_args="$4"
    
    local version=$(get_version)
    local git_hash=$(get_git_hash)
    local image_name="${DOCKER_REGISTRY}/${PROJECT_NAME}-${service}"
    
    print_status "Building $service image..."
    
    local build_cmd="docker build"
    
    if [ "$FORCE_BUILD" = true ]; then
        build_cmd="$build_cmd --no-cache"
    fi
    
    if [ -n "$build_args" ]; then
        build_cmd="$build_cmd $build_args"
    fi
    
    build_cmd="$build_cmd -t ${image_name}:latest"
    build_cmd="$build_cmd -t ${image_name}:${version}"
    build_cmd="$build_cmd -t ${image_name}:${version}-alpha"
    build_cmd="$build_cmd -t ${image_name}:${version}-${git_hash}"
    
    if [ -n "$dockerfile" ]; then
        build_cmd="$build_cmd -f $dockerfile"
    fi
    
    build_cmd="$build_cmd $context"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN: $build_cmd"
    else
        print_status "Executing: $build_cmd"
        eval "$build_cmd"
        
        if [ $? -eq 0 ]; then
            print_status "$service image built successfully"
        else
            print_error "Failed to build $service image"
            exit 1
        fi
    fi
}

# Function to push image
push_image() {
    local service="$1"
    local image_name="${DOCKER_REGISTRY}/${PROJECT_NAME}-${service}"
    
    if [ "$PUSH_IMAGES" = false ]; then
        return
    fi
    
    print_status "Pushing $service images..."
    
    local tags=("latest" "$(get_version)" "$(get_version)-alpha" "$(get_version)-$(get_git_hash)")
    
    for tag in "${tags[@]}"; do
        if [ "$DRY_RUN" = true ]; then
            print_status "DRY RUN: docker push ${image_name}:${tag}"
        else
            print_status "Pushing ${image_name}:${tag}"
            docker push "${image_name}:${tag}"
            
            if [ $? -eq 0 ]; then
                print_status "Successfully pushed ${image_name}:${tag}"
            else
                print_error "Failed to push ${image_name}:${tag}"
                exit 1
            fi
        fi
    done
}

# Function to build frontend
build_frontend() {
    print_header "Building Frontend Image"
    
    local build_args="--build-arg NEXT_PUBLIC_API_URL=http://localhost:3000"
    build_args="$build_args --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:3000"
    build_args="$build_args --build-arg NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000"
    
    build_image "frontend" "frontend/Dockerfile" "frontend" "$build_args"
    push_image "frontend"
}

# Function to build gateway
build_gateway() {
    print_header "Building Gateway Image"
    
    local build_args="--build-arg NODE_ENV=production"
    build_args="$build_args --build-arg DATABASE_TYPE=${DATABASE_TYPE:-MONGODB}"
    
    build_image "gateway" "gateway/Dockerfile" "gateway" "$build_args"
    push_image "gateway"
}

# Function to build translator
build_translator() {
    print_header "Building Translator Image"
    
    local build_args="--build-arg PYTHON_VERSION=3.12.11"
    build_args="$build_args --build-arg DATABASE_TYPE=${DATABASE_TYPE:-MONGODB}"
    
    build_image "translator" "translator/Dockerfile" "translator" "$build_args"
    push_image "translator"
}

# Function to build all images
build_all() {
    print_header "Building All Images"
    
    build_frontend
    build_gateway
    build_translator
}

# Function to show summary
show_summary() {
    local version=$(get_version)
    local git_hash=$(get_git_hash)
    
    print_header "Build Summary"
    echo "Project: $PROJECT_NAME"
    echo "Registry: $DOCKER_REGISTRY"
    echo "Version: $version"
    echo "Git Hash: $git_hash"
    echo "Build Type: $BUILD_TYPE"
    echo "Push Images: $PUSH_IMAGES"
    echo "Force Build: $FORCE_BUILD"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        echo "DRY RUN MODE - No actual builds or pushes performed"
    else
        echo "Images built:"
        case "$BUILD_TYPE" in
            all)
                echo "  - ${DOCKER_REGISTRY}/${PROJECT_NAME}-frontend:latest,${version},${version}-alpha,${version}-${git_hash}"
                echo "  - ${DOCKER_REGISTRY}/${PROJECT_NAME}-gateway:latest,${version},${version}-alpha,${version}-${git_hash}"
                echo "  - ${DOCKER_REGISTRY}/${PROJECT_NAME}-translator:latest,${version},${version}-alpha,${version}-${git_hash}"
                ;;
            frontend)
                echo "  - ${DOCKER_REGISTRY}/${PROJECT_NAME}-frontend:latest,${version},${version}-alpha,${version}-${git_hash}"
                ;;
            gateway)
                echo "  - ${DOCKER_REGISTRY}/${PROJECT_NAME}-gateway:latest,${version},${version}-alpha,${version}-${git_hash}"
                ;;
            translator)
                echo "  - ${DOCKER_REGISTRY}/${PROJECT_NAME}-translator:latest,${version},${version}-alpha,${version}-${git_hash}"
                ;;
        esac
        
        if [ "$PUSH_IMAGES" = true ]; then
            echo ""
            echo "Images pushed to registry: $DOCKER_REGISTRY"
        fi
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check if logged in to registry
    if [ "$PUSH_IMAGES" = true ]; then
        if ! docker info | grep -q "Username"; then
            print_warning "Not logged in to Docker registry"
            print_status "Please run: docker login"
            exit 1
        fi
    fi
    
    print_status "Prerequisites check passed"
}

# Main script
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                BUILD_TYPE="$2"
                shift 2
                ;;
            -p|--push)
                PUSH_IMAGES=true
                shift
                ;;
            -f|--force)
                FORCE_BUILD=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate build type
    case "$BUILD_TYPE" in
        all|frontend|gateway|translator)
            ;;
        *)
            print_error "Invalid build type: $BUILD_TYPE"
            print_error "Valid types: all, frontend, gateway, translator"
            exit 1
            ;;
    esac
    
    print_header "Meeshy Docker Image Build and Push"
    print_status "Build Type: $BUILD_TYPE"
    print_status "Push Images: $PUSH_IMAGES"
    print_status "Force Build: $FORCE_BUILD"
    print_status "Dry Run: $DRY_RUN"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Build images based on type
    case "$BUILD_TYPE" in
        all)
            build_all
            ;;
        frontend)
            build_frontend
            ;;
        gateway)
            build_gateway
            ;;
        translator)
            build_translator
            ;;
    esac
    
    # Show summary
    show_summary
    
    print_status "Build and push process completed successfully!"
}

# Run main function
main "$@"
