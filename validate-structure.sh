#!/bin/bash
# Meeshy - Structure Validation and Cleanup Script

set -e

echo "🧹 Meeshy Structure Cleanup & Validation"
echo "========================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📋 Step 1: Cleaning up unnecessary files${NC}"

# Remove old Docker files
find . -name "*.old" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

# Clean node_modules
echo "Cleaning node_modules..."
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# Clean build artifacts  
echo "Cleaning build artifacts..."
find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true

echo -e "${BLUE}📋 Step 2: Validating structure${NC}"

# Check required directories
required_dirs=("shared" "gateway" "translator" "frontend")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $dir/ exists${NC}"
    else
        echo -e "${RED}❌ $dir/ missing${NC}"
        exit 1
    fi
done

# Check required files
required_files=(
    "shared/package.json"
    "gateway/package.json" 
    "translator/requirements.txt"
    "frontend/package.json"
    "docker-compose.new.yml"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        exit 1
    fi
done

# Check Dockerfiles
dockerfiles=("frontend/Dockerfile" "gateway/Dockerfile" "translator/Dockerfile")
for dockerfile in "${dockerfiles[@]}"; do
    if [ -f "$dockerfile" ]; then
        echo -e "${GREEN}✅ $dockerfile exists${NC}"
    else
        echo -e "${RED}❌ $dockerfile missing${NC}"
        exit 1
    fi
done

echo -e "${BLUE}📋 Step 3: Checking models location${NC}"
if [ -d "translator/models" ]; then
    model_count=$(find translator/models -name "*.bin" -o -name "*.json" 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ Models in translator/models/ ($model_count files)${NC}"
else
    echo -e "${YELLOW}⚠️  No models found in translator/models/${NC}"
fi

echo -e "${BLUE}📋 Step 4: Structure summary${NC}"
echo "Final structure:"
tree -L 3 -I 'node_modules|.git|.next|dist|__pycache__|*.log' || ls -la

echo ""
echo -e "${GREEN}🎉 Structure validation completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm run install:all"
echo "2. Test builds: docker-compose -f docker-compose.new.yml build"
echo "3. Deploy: ./deploy-microservices.sh"
