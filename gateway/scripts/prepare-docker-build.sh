#!/bin/bash
# Script to prepare gateway for Docker build by distributing shared dependencies
# Uses the existing distribute.sh script from shared/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONOREPO_ROOT="$(cd "$GATEWAY_ROOT/.." && pwd)"
SHARED_DIR="$MONOREPO_ROOT/shared"

echo "🔧 Preparing gateway for Docker build..."
echo "   Gateway root: $GATEWAY_ROOT"
echo "   Monorepo root: $MONOREPO_ROOT"
echo "   Shared dir: $SHARED_DIR"

# Build shared types if needed
if [ ! -d "$SHARED_DIR/dist" ]; then
    echo "📦 Building shared types..."
    cd "$SHARED_DIR"
    pnpm run build:types 2>/dev/null || npm run build:types
    cd "$GATEWAY_ROOT"
fi

# Run the distribute script to copy shared/ to gateway/shared/
echo "📦 Running shared distribution script..."
cd "$SHARED_DIR"
./scripts/distribute.sh

# Go back to gateway
cd "$GATEWAY_ROOT"

# Copy shared package.json (needed for pnpm workspace)
echo "📦 Copying shared package.json..."
cp "$SHARED_DIR/package.json" "$GATEWAY_ROOT/shared/package.json"

# Copy pnpm workspace configuration
echo "📦 Copying pnpm workspace configuration..."
cp "$MONOREPO_ROOT/pnpm-workspace.yaml" "$GATEWAY_ROOT/pnpm-workspace.yaml"

# Create minimal pnpm-workspace.yaml for gateway context
cat > "$GATEWAY_ROOT/pnpm-workspace.yaml" << 'EOF'
packages:
  - '.'
  - 'shared'

ignoredBuiltDependencies:
  - '@tensorflow/tfjs-node'
  - core-js
  - onnxruntime-node
  - protobufjs
  - sharp
  - unrs-resolver

onlyBuiltDependencies:
  - '@prisma/client'
  - '@prisma/engines'
  - esbuild
  - prisma
EOF

echo "✅ Gateway is now self-sufficient for Docker build!"
echo "   - shared/ directory distributed via distribute.sh"
echo "   - pnpm-workspace.yaml configured for gateway context"
echo ""
echo "You can now run: docker buildx build -f Dockerfile -t meeshy-gateway ."
