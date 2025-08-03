#!/usr/bin/env python3
"""
Service de test simple pour vérifier l'installation
"""

from fastapi import FastAPI
import uvicorn
import os

app = FastAPI(title="Meeshy Translation Service - Test")

@app.get("/")
async def root():
    return {"message": "Meeshy Translation Service is running!", "version": "0.1.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "translation"}

@app.get("/ready")
async def ready():
    return {"status": "ready", "dependencies": "loaded"}

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", "8000"))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
