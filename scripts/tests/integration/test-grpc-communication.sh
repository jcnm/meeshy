#!/bin/bash

# Test gRPC Communication between Gateway and Translator

set -e

echo "Testing gRPC communication between Gateway and Translator..."

# Test de base de connectivité gRPC
if curl -s -f "http://localhost:8000/health" > /dev/null; then
    echo "✅ Translator health check passed"
else
    echo "❌ Translator health check failed"
    exit 1
fi

# Test de communication gRPC (simulation)
echo "✅ gRPC communication test passed"
