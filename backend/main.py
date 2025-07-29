"""
Chat WebSocket Backend avec traduction automatique - Version macOS optimisée
Compatible avec ou sans sentencepiece
"""

import asyncio
import json
import logging
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
from contextlib import asynccontextmanager

# Dépendances externes
import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Imports conditionnels pour la traduction
TRANSLATION_METHOD = "none"
try:
    from transformers import MarianMTModel, MarianTokenizer
    import torch
    TRANSLATION_METHOD = "transformers"
    print("✅ Transformers disponible")
except ImportError:
    try:
        from googletrans import Translator
        from langdetect import detect
        TRANSLATION_METHOD = "googletrans"
        print("⚠️  Utilisation de Google Translate comme fallback")
    except ImportError:
        print("❌ Aucun service de traduction disponible")

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== CONFIGURATION =====
SECRET_KEY = "your-super-secret-jwt-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
DATABASE_PATH = "chat_app.db"

# ===== ENUMS ET TYPES =====
class UserRole(str, Enum):
    BIGBOSS = "BIGBOSS"
    ADMIN = "ADMIN"
    MODO = "MODO"
    AUDIT = "AUDIT"
    ANALYST = "ANALYST"
    USER = "USER"

class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"

class ParticipantRole(str, Enum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"

# ===== MODÈLES PYDANTIC =====
class UserBase(BaseModel):
    username: str
    firstName: str
    lastName: str
    displayName: Optional[str] = None
    email: str
    phoneNumber: Optional[str] = None
    avatar: Optional[str] = None
    systemLanguage: str = "fr"
    regionalLanguage: str = "fr"
    autoTranslateEnabled: bool = True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    isOnline: bool
    lastSeen: Optional[datetime] = None
    createdAt: datetime
    lastActiveAt: datetime
    role: UserRole
    isActive: bool = True

class LoginRequest(BaseModel):
    email: str
    password: str

class CreateMessageDto(BaseModel):
    conversationId: str
    content: str
    replyToId: Optional[str] = None

class CreateConversationDto(BaseModel):
    type: ConversationType
    title: Optional[str] = None
    participantIds: List[str]

class MessageResponse(BaseModel):
    id: str
    content: str
    senderId: str
    senderName: str
    senderAvatar: Optional[str] = None
    originalLanguage: str
    translatedContent: Optional[str] = None
    targetLanguage: Optional[str] = None
    isEdited: bool = False
    editedAt: Optional[datetime] = None
    isDeleted: bool = False
    conversationId: str
    replyTo: Optional[Dict[str, Any]] = None
    createdAt: datetime
    updatedAt: datetime

# ===== SERVICE DE TRADUCTION ADAPTATIF =====
class TranslationService:
    def __init__(self):
        self.method = TRANSLATION_METHOD
        
        if self.method == "transformers":
            self.init_transformers()
        elif self.method == "googletrans":
            self.init_googletrans()
        else:
            logger.warning("Aucun service de traduction disponible")
    
    def init_transformers(self):
        """Initialise Transformers si disponible"""
        try:
            self.models = {}
            self.tokenizers = {}
            self.device = torch.device("cpu")  # CPU uniquement pour la compatibilité
            
            # Modèles simplifiés pour éviter sentencepiece
            self.language_pairs = {
                ('fr', 'en'): 'Helsinki-NLP/opus-mt-fr-en',
                ('en', 'fr'): 'Helsinki-NLP/opus-mt-en-fr',
            }
            logger.info("Service de traduction Transformers initialisé")
        except Exception as e:
            logger.error(f"Erreur initialisation Transformers: {e}")
            self.method = "googletrans"
            self.init_googletrans()
    
    def init_googletrans(self):
        """Initialise Google Translate comme fallback"""
        try:
            self.translator = Translator()
            logger.info("Service de traduction Google Translate initialisé")
        except Exception as e:
            logger.error(f"Erreur initialisation Google Translate: {e}")
            self.method = "none"
    
    async def detect_language(self, text: str) -> str:
        """Détecte la langue d'un texte"""
        if self.method == "googletrans":
            try:
                from langdetect import detect
                return detect(text)
            except:
                pass
        
        # Détection simple basée sur des mots courants
        text_lower = text.lower()
        french_words = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'dans', 'pour']
        english_words = ['the', 'and', 'or', 'is', 'in', 'for', 'with', 'this', 'that']
        
        words = text_lower.split()
        fr_count = sum(1 for word in words if word in french_words)
        en_count = sum(1 for word in words if word in english_words)
        
        return 'fr' if fr_count > en_count else 'en'
    
    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Traduit un texte selon la méthode disponible"""
        if source_lang == target_lang:
            return text
            
        if self.method == "googletrans":
            return await self.translate_with_googletrans(text, source_lang, target_lang)
        elif self.method == "transformers":
            return await self.translate_with_transformers(text, source_lang, target_lang)
        else:
            logger.warning("Traduction non disponible, retour du texte original")
            return text
    
    async def translate_with_googletrans(self, text: str, source_lang: str, target_lang: str) -> str:
        """Traduction via Google Translate"""
        try:
            result = self.translator.translate(text, src=source_lang, dest=target_lang)
            return result.text
        except Exception as e:
            logger.error(f"Erreur traduction Google: {e}")
            return text
    
    async def translate_with_transformers(self, text: str, source_lang: str, target_lang: str) -> str:
        """Traduction via Transformers (si disponible)"""
        try:
            pair = (source_lang, target_lang)
            model_name = self.language_pairs.get(pair)
            
            if not model_name:
                return text
            
            if pair not in self.models:
                logger.info(f"Chargement du modèle: {model_name}")
                self.tokenizers[pair] = MarianTokenizer.from_pretrained(model_name)
                self.models[pair] = MarianMTModel.from_pretrained(model_name)
            
            tokenizer = self.tokenizers[pair]
            model = self.models[pair]
            
            inputs = tokenizer.encode(text, return_tensors="pt", padding=True, truncation=True)
            
            with torch.no_grad():
                outputs = model.generate(inputs, max_length=512, num_beams=2)
            
            return tokenizer.decode(outputs[0], skip_special_tokens=True)
            
        except Exception as e:
            logger.error(f"Erreur traduction Transformers: {e}")
            return text

# ===== GESTION DE LA BASE DE DONNÉES =====
class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialise la base de données"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    firstName TEXT NOT NULL,
                    lastName TEXT NOT NULL,
                    displayName TEXT,
                    email TEXT UNIQUE NOT NULL,
                    phoneNumber TEXT,
                    avatar TEXT,
                    password_hash TEXT NOT NULL,
                    systemLanguage TEXT DEFAULT 'fr',
                    regionalLanguage TEXT DEFAULT 'fr',
                    autoTranslateEnabled BOOLEAN DEFAULT TRUE,
                    isOnline BOOLEAN DEFAULT FALSE,
                    lastSeen DATETIME,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    lastActiveAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    role TEXT DEFAULT 'USER',
                    isActive BOOLEAN DEFAULT TRUE
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    title TEXT,
                    isActive BOOLEAN DEFAULT TRUE,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_participants (
                    id TEXT PRIMARY KEY,
                    conversationId TEXT NOT NULL,
                    userId TEXT NOT NULL,
                    role TEXT DEFAULT 'member',
                    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    leftAt DATETIME,
                    FOREIGN KEY (conversationId) REFERENCES conversations (id),
                    FOREIGN KEY (userId) REFERENCES users (id),
                    UNIQUE(conversationId, userId)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    senderId TEXT NOT NULL,
                    conversationId TEXT NOT NULL,
                    originalLanguage TEXT DEFAULT 'fr',
                    isEdited BOOLEAN DEFAULT FALSE,
                    editedAt DATETIME,
                    isDeleted BOOLEAN DEFAULT FALSE,
                    replyToId TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (senderId) REFERENCES users (id),
                    FOREIGN KEY (conversationId) REFERENCES conversations (id)
                )
            """)
            
            conn.commit()
    
    @asynccontextmanager
    async def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

# ===== SERVICES MÉTIER =====
class UserService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    def hash_password(self, password: str) -> str:
        salt = secrets.token_hex(32)
        return hashlib.pbkdf2_hex(password.encode('utf-8'), salt.encode('utf-8'), 100000) + ':' + salt
    
    def verify_password(self, password: str, hashed: str) -> bool:
        try:
            password_hash, salt = hashed.split(':')
            return hashlib.pbkdf2_hex(password.encode('utf-8'), salt.encode('utf-8'), 100000) == password_hash
        except ValueError:
            return False
    
    async def create_user(self, user_data: UserCreate) -> UserResponse:
        user_id = str(uuid.uuid4())
        password_hash = self.hash_password(user_data.password)
        
        async with self.db.get_connection() as conn:
            try:
                conn.execute("""
                    INSERT INTO users (
                        id, username, firstName, lastName, displayName, email, 
                        phoneNumber, avatar, password_hash, systemLanguage, 
                        regionalLanguage, autoTranslateEnabled
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, user_data.username, user_data.firstName, 
                    user_data.lastName, user_data.displayName, user_data.email,
                    user_data.phoneNumber, user_data.avatar, password_hash,
                    user_data.systemLanguage, user_data.regionalLanguage,
                    user_data.autoTranslateEnabled
                ))
                conn.commit()
                
                return await self.get_user_by_id(user_id)
            except sqlite3.IntegrityError:
                raise HTTPException(status_code=400, detail="User already exists")
    
    async def authenticate_user(self, email: str, password: str) -> Optional[UserResponse]:
        async with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE email = ? AND isActive = TRUE", (email,))
            row = cursor.fetchone()
            
            if row and self.verify_password(password, row['password_hash']):
                return UserResponse(**dict(row))
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        async with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE id = ? AND isActive = TRUE", (user_id,))
            row = cursor.fetchone()
            return UserResponse(**dict(row)) if row else None
    
    async def update_online_status(self, user_id: str, is_online: bool):
        async with self.db.get_connection() as conn:
            now = datetime.now()
            conn.execute("""
                UPDATE users SET isOnline = ?, lastActiveAt = ?, lastSeen = ?
                WHERE id = ?
            """, (is_online, now, now if not is_online else None, user_id))
            conn.commit()

# ===== GESTIONNAIRE WEBSOCKET =====
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[WebSocket, str] = {}
        self.conversation_rooms: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        
        if user_id in self.active_connections:
            old_websocket = self.active_connections[user_id]
            if old_websocket in self.user_connections:
                del self.user_connections[old_websocket]
        
        self.active_connections[user_id] = websocket
        self.user_connections[websocket] = user_id
        logger.info(f"User {user_id} connected")

    async def disconnect(self, websocket: WebSocket):
        user_id = self.user_connections.get(websocket)
        if user_id:
            self.active_connections.pop(user_id, None)
            self.user_connections.pop(websocket, None)
            logger.info(f"User {user_id} disconnected")

    async def send_personal_message(self, user_id: str, message: dict):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")

    async def broadcast_to_conversation(self, conversation_id: str, message: dict, exclude_user: str = None):
        users = self.conversation_rooms.get(conversation_id, set())
        for user_id in users:
            if user_id != exclude_user:
                await self.send_personal_message(user_id, message)

# ===== AUTHENTIFICATION JWT =====
security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_user_from_websocket_token(token: str) -> Optional[UserResponse]:
    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if user_id:
            return await user_service.get_user_by_id(user_id)
    except Exception as e:
        logger.error(f"WebSocket token error: {e}")
    return None

# ===== INITIALISATION DES SERVICES =====
db_manager = DatabaseManager(DATABASE_PATH)
translation_service = TranslationService()
user_service = UserService(db_manager)
connection_manager = ConnectionManager()

# ===== APPLICATION FASTAPI =====
app = FastAPI(title="Chat WebSocket API - macOS Compatible", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== ENDPOINTS REST =====
@app.post("/auth/register")
async def register(user_data: UserCreate):
    user = await user_service.create_user(user_data)
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.post("/auth/login")
async def login(credentials: LoginRequest):
    user = await user_service.authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.id})
    await user_service.update_online_status(user.id, True)
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.get("/auth/me")
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "translation_method": translation_service.method,
        "connections": len(connection_manager.active_connections)
    }

# ===== WEBSOCKET =====
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return
    
    user = await get_user_from_websocket_token(token)
    if not user:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    await connection_manager.connect(websocket, user.id)
    await user_service.update_online_status(user.id, True)
    
    await connection_manager.send_personal_message(user.id, {
        "type": "connected",
        "data": {"message": f"Connected successfully - Translation: {translation_service.method}"}
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Traitement basique des messages
            if message.get("type") == "ping":
                await connection_manager.send_personal_message(user.id, {
                    "type": "pong",
                    "data": {"timestamp": datetime.now().isoformat()}
                })
            
    except WebSocketDisconnect:
        await connection_manager.disconnect(websocket)
        await user_service.update_online_status(user.id, False)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await connection_manager.disconnect(websocket)

if __name__ == "__main__":
    print(f"🚀 Démarrage du serveur - Méthode de traduction: {TRANSLATION_METHOD}")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
