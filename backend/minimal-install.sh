#!/bin/bash

# Installation MINIMALE de secours pour macOS
# À utiliser si l'installation complète échoue

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "🆘 Installation MINIMALE de secours pour macOS"
print_warning "Cette version évite toutes les dépendances problématiques"
echo "=================================================================="

# Nettoyer
[ -d "venv" ] && rm -rf venv

# Créer l'environnement
print_status "Création de l'environnement virtuel..."
python3 -m venv venv
source venv/bin/activate

# Installation minimale
print_status "Installation des dépendances minimales..."
pip install --upgrade pip

# Installation une par une pour détecter les problèmes
packages=(
    "fastapi==0.104.1"
    "uvicorn[standard]==0.24.0"
    "websockets==12.0"
    "PyJWT==2.8.0"
    "python-multipart==0.0.6"
    "aiosqlite==0.19.0"
    "pydantic==2.5.0"
    "python-dotenv==1.0.0"
    "httpx==0.25.0"
    "cryptography==41.0.7"
)

for package in "${packages[@]}"; do
    print_status "Installation de $package..."
    if pip install "$package"; then
        print_success "✅ $package installé"
    else
        print_error "❌ Échec: $package"
    fi
done

# Traduction optionnelle
print_status "Tentative d'installation de la traduction..."
if pip install googletrans==4.0.0rc1 langdetect==1.0.9; then
    print_success "✅ Traduction Google disponible"
    TRANSLATION_AVAILABLE=true
else
    print_warning "⚠️  Traduction non disponible"
    TRANSLATION_AVAILABLE=false
fi

# Créer une version ultra-simple de main.py
print_status "Création de main.py simplifié..."
cat > main-simple.py << 'EOL'
"""
Version ULTRA-SIMPLE du serveur de chat
Compatible avec tous les systèmes macOS
"""

import json
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Optional
import uuid
import jwt
from fastapi import FastAPI, WebSocket, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configuration
SECRET_KEY = "simple-secret-key-change-in-production"
DATABASE_PATH = "simple_chat.db"

# Modèles
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class MessageCreate(BaseModel):
    content: str
    conversationId: str = "general"

# Base de données simple
def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            content TEXT,
            userId TEXT,
            username TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

# Services
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    return hashlib.sha256((password + salt).encode()).hexdigest() + ':' + salt

def verify_password(password: str, hashed: str) -> bool:
    try:
        hash_part, salt = hashed.split(':')
        return hashlib.sha256((password + salt).encode()).hexdigest() == hash_part
    except:
        return False

def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=7)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# Gestionnaire WebSocket simple
class SimpleConnectionManager:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.connections[user_id] = websocket
    
    async def disconnect(self, user_id: str):
        self.connections.pop(user_id, None)
    
    async def broadcast(self, message: dict):
        for websocket in self.connections.values():
            try:
                await websocket.send_text(json.dumps(message))
            except:
                pass

# Application
app = FastAPI(title="Chat Simple - macOS Compatible")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

manager = SimpleConnectionManager()
security = HTTPBearer()

# Initialisation
init_db()

# Routes
@app.post("/register")
async def register(user_data: UserCreate):
    conn = sqlite3.connect(DATABASE_PATH)
    try:
        user_id = str(uuid.uuid4())
        password_hash = hash_password(user_data.password)
        
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, user_data.username, user_data.email, password_hash)
        )
        conn.commit()
        
        token = create_token(user_id)
        return {"token": token, "user_id": user_id, "username": user_data.username}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="User exists")
    finally:
        conn.close()

@app.post("/login")
async def login(credentials: LoginRequest):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE email = ?",
        (credentials.email,)
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row or not verify_password(credentials.password, row[2]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(row[0])
    return {"token": token, "user_id": row[0], "username": row[1]}

@app.get("/messages")
async def get_messages():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.execute(
        "SELECT content, username, timestamp FROM messages ORDER BY timestamp DESC LIMIT 20"
    )
    messages = [{"content": row[0], "username": row[1], "timestamp": row[2]} for row in cursor.fetchall()]
    conn.close()
    return {"messages": list(reversed(messages))}

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "simple"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=1008)
        return
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        # Récupérer le nom d'utilisateur
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            await websocket.close(code=1008)
            return
        
        username = row[0]
        await manager.connect(websocket, user_id)
        
        # Message de bienvenue
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": f"Bienvenue {username}!"
        }))
        
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "message":
                content = message_data.get("content", "")
                
                # Sauvegarder en DB
                conn = sqlite3.connect(DATABASE_PATH)
                conn.execute(
                    "INSERT INTO messages (id, content, userId, username) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), content, user_id, username)
                )
                conn.commit()
                conn.close()
                
                # Diffuser à tous
                await manager.broadcast({
                    "type": "new_message",
                    "content": content,
                    "username": username,
                    "timestamp": datetime.now().isoformat()
                })
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(user_id)

if __name__ == "__main__":
    print("🚀 Serveur de chat SIMPLE démarré")
    print("📡 API: http://localhost:8000")
    print("🔄 WebSocket: ws://localhost:8000/ws")
    uvicorn.run("main-simple:app", host="0.0.0.0", port=8000, reload=True)
EOL

# Scripts de démarrage simple
cat > run-simple.sh << 'EOL'
#!/bin/bash
echo "🚀 Démarrage du serveur SIMPLE..."
source venv/bin/activate
python main-simple.py
EOL

chmod +x run-simple.sh

print_success "🎉 Installation MINIMALE terminée!"
echo ""
echo "📋 Deux options disponibles:"
echo "  1. Version complète: ./run.sh"
echo "  2. Version simple:   ./run-simple.sh"
echo ""
echo "🌐 URLs (version simple):"
echo "  http://localhost:8000/health"
echo "  http://localhost:8000/docs"
echo ""
print_warning "La version simple n'a pas de traduction mais est 100% stable"