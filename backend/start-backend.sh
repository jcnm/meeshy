#!/bin/bash
# Script temporaire pour démarrer le backend sans compilation des erreurs frontend

export NODE_PATH="./node_modules"
export TS_NODE_TRANSPILE_ONLY=true
export TS_NODE_SKIP_PROJECT=true

npx ts-node \
  --transpile-only \
  --compiler-options '{"moduleResolution":"node","esModuleInterop":true,"allowSyntheticDefaultImports":true,"experimentalDecorators":true,"emitDecoratorMetadata":true}' \
  src/main.ts
