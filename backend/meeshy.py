"""
Chat WebSocket Backend avec traduction automatique en temps réel
Fichier unique implémentant toutes les fonctionnalités
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
from transformers import MarianMTModel, MarianTokenizer, pipeline
import torch

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== CONFIGURATION ET CONSTANTES =====

SECRET_KEY = "your-super-secret-jwt-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 jours

# Configuration de la base de données
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

class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"

class NotificationType(str, Enum):
    MESSAGE = "message"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    ROLE_CHANGED = "role_changed"
    SYSTEM = "system"

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
    customDestinationLanguage: Optional[str] = None
    autoTranslateEnabled: bool = True
    translateToSystemLanguage: bool = True
    translateToRegionalLanguage: bool = False
    useCustomDestination: bool = False

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    isOnline: bool
    lastSeen: Optional[datetime] = None
    createdAt: datetime
    lastActiveAt: datetime
    role: UserRole
    isActive: bool
    deactivatedAt: Optional[datetime] = None

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

class ConversationResponse(BaseModel):
    id: str
    type: ConversationType
    title: Optional[str] = None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime
    lastMessage: Optional[MessageResponse] = None
    unreadCount: int = 0
    participants: List[Dict[str, Any]] = []

# ===== GESTION DE LA BASE DE DONNÉES =====

class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialise la base de données avec toutes les tables nécessaires"""
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
                    customDestinationLanguage TEXT,
                    autoTranslateEnabled BOOLEAN DEFAULT TRUE,
                    translateToSystemLanguage BOOLEAN DEFAULT TRUE,
                    translateToRegionalLanguage BOOLEAN DEFAULT FALSE,
                    useCustomDestination BOOLEAN DEFAULT FALSE,
                    isOnline BOOLEAN DEFAULT FALSE,
                    lastSeen DATETIME,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    lastActiveAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    role TEXT DEFAULT 'USER',
                    isActive BOOLEAN DEFAULT TRUE,
                    deactivatedAt DATETIME
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    title TEXT,
                    description TEXT,
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
                    FOREIGN KEY (conversationId) REFERENCES conversations (id),
                    FOREIGN KEY (replyToId) REFERENCES messages (id)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS translation_cache (
                    id TEXT PRIMARY KEY,
                    original_text TEXT NOT NULL,
                    source_language TEXT NOT NULL,
                    target_language TEXT NOT NULL,
                    translated_text TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

# ===== SERVICE DE TRADUCTION =====

class TranslationService:
    def __init__(self):
        self.models = {}
        self.tokenizers = {}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")
        
        # Initialiser les modèles de traduction les plus courants
        self.language_pairs = {
            ('fr', 'en'): 'Helsinki-NLP/opus-mt-fr-en',
            ('en', 'fr'): 'Helsinki-NLP/opus-mt-en-fr',
            ('fr', 'es'): 'Helsinki-NLP/opus-mt-fr-es',
            ('es', 'fr'): 'Helsinki-NLP/opus-mt-es-fr',
            ('en', 'es'): 'Helsinki-NLP/opus-mt-en-es',
            ('es', 'en'): 'Helsinki-NLP/opus-mt-es-en',
        }
        
        # Pipeline de détection de langue
        try:
            self.language_detector = pipeline("text-classification", 
                                             model="facebook/fasttext-language-identification",
                                             device=0 if torch.cuda.is_available() else -1)
        except Exception as e:
            logger.warning(f"Could not load language detection model: {e}")
            self.language_detector = None
    
    async def detect_language(self, text: str) -> str:
        """Détecte la langue d'un texte"""
        if self.language_detector:
            try:
                result = self.language_detector(text)
                if result:
                    detected_lang = result[0]['label'].replace('__label__', '')
                    # Mapper les codes de langue détectés vers nos codes
                    lang_mapping = {'fra': 'fr', 'eng': 'en', 'spa': 'es'}
                    return lang_mapping.get(detected_lang, detected_lang)
            except Exception as e:
                logger.error(f"Language detection error: {e}")
        
        # Fallback: analyser le texte pour détecter des mots courants
        french_words = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'est', 'dans', 'pour', 'avec']
        english_words = ['the', 'and', 'or', 'is', 'in', 'for', 'with', 'this', 'that', 'have']
        spanish_words = ['el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'es', 'en', 'para', 'con']
        
        text_lower = text.lower()
        words = text_lower.split()
        
        fr_count = sum(1 for word in words if word in french_words)
        en_count = sum(1 for word in words if word in english_words)
        es_count = sum(1 for word in words if word in spanish_words)
        
        if fr_count > en_count and fr_count > es_count:
            return 'fr'
        elif en_count > es_count:
            return 'en'
        elif es_count > 0:
            return 'es'
        
        return 'fr'  # Default
    
    async def get_model_and_tokenizer(self, source_lang: str, target_lang: str):
        """Récupère ou charge le modèle de traduction"""
        pair = (source_lang, target_lang)
        
        if pair not in self.models:
            model_name = self.language_pairs.get(pair)
            if not model_name:
                # Essayer l'inverse
                reverse_pair = (target_lang, source_lang)
                model_name = self.language_pairs.get(reverse_pair)
                if model_name:
                    pair = reverse_pair
            
            if not model_name:
                raise ValueError(f"No translation model available for {source_lang} -> {target_lang}")
            
            try:
                logger.info(f"Loading translation model: {model_name}")
                tokenizer = MarianTokenizer.from_pretrained(model_name)
                model = MarianMTModel.from_pretrained(model_name).to(self.device)
                
                self.tokenizers[pair] = tokenizer
                self.models[pair] = model
                
            except Exception as e:
                logger.error(f"Error loading model {model_name}: {e}")
                raise
        
        return self.models[pair], self.tokenizers[pair]
    
    async def translate_text(self, text: str, source_lang: str, target_lang: str, 
                           use_cache: bool = True) -> str:
        """Traduit un texte d'une langue source vers une langue cible"""
        if source_lang == target_lang:
            return text
        
        # Vérifier le cache
        if use_cache:
            cached = await self.get_cached_translation(text, source_lang, target_lang)
            if cached:
                return cached
        
        try:
            model, tokenizer = await self.get_model_and_tokenizer(source_lang, target_lang)
            
            # Encoder le texte
            inputs = tokenizer.encode(text, return_tensors="pt", padding=True, truncation=True)
            inputs = inputs.to(self.device)
            
            # Générer la traduction
            with torch.no_grad():
                outputs = model.generate(inputs, max_length=512, num_beams=4, 
                                       early_stopping=True, pad_token_id=tokenizer.pad_token_id)
            
            # Décoder la traduction
            translated = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Sauvegarder en cache
            if use_cache:
                await self.cache_translation(text, source_lang, target_lang, translated)
            
            return translated
            
        except Exception as e:
            logger.error(f"Translation error ({source_lang} -> {target_lang}): {e}")
            return text  # Retourner le texte original en cas d'erreur
    
    async def get_cached_translation(self, text: str, source_lang: str, 
                                   target_lang: str) -> Optional[str]:
        """Récupère une traduction depuis le cache"""
        try:
            async with db_manager.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT translated_text FROM translation_cache 
                    WHERE original_text = ? AND source_language = ? AND target_language = ?
                    AND created_at > datetime('now', '-7 days')
                """, (text, source_lang, target_lang))
                row = cursor.fetchone()
                return row['translated_text'] if row else None
        except Exception as e:
            logger.error(f"Cache retrieval error: {e}")
            return None
    
    async def cache_translation(self, original: str, source_lang: str, 
                              target_lang: str, translated: str):
        """Sauvegarde une traduction en cache"""
        try:
            async with db_manager.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO translation_cache 
                    (id, original_text, source_language, target_language, translated_text)
                    VALUES (?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), original, source_lang, target_lang, translated))
                conn.commit()
        except Exception as e:
            logger.error(f"Cache storage error: {e}")

# ===== SERVICES MÉTIER =====

class UserService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    def hash_password(self, password: str) -> str:
        """Hash un mot de passe"""
        salt = secrets.token_hex(32)
        return hashlib.pbkdf2_hex(password.encode('utf-8'), salt.encode('utf-8'), 100000) + ':' + salt
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Vérifie un mot de passe"""
        try:
            password_hash, salt = hashed.split(':')
            return hashlib.pbkdf2_hex(password.encode('utf-8'), salt.encode('utf-8'), 100000) == password_hash
        except ValueError:
            return False
    
    async def create_user(self, user_data: UserCreate) -> UserResponse:
        """Crée un nouvel utilisateur"""
        user_id = str(uuid.uuid4())
        password_hash = self.hash_password(user_data.password)
        
        async with self.db.get_connection() as conn:
            try:
                conn.execute("""
                    INSERT INTO users (
                        id, username, firstName, lastName, displayName, email, 
                        phoneNumber, avatar, password_hash, systemLanguage, 
                        regionalLanguage, customDestinationLanguage, 
                        autoTranslateEnabled, translateToSystemLanguage,
                        translateToRegionalLanguage, useCustomDestination
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, user_data.username, user_data.firstName, 
                    user_data.lastName, user_data.displayName, user_data.email,
                    user_data.phoneNumber, user_data.avatar, password_hash,
                    user_data.systemLanguage, user_data.regionalLanguage,
                    user_data.customDestinationLanguage, user_data.autoTranslateEnabled,
                    user_data.translateToSystemLanguage, user_data.translateToRegionalLanguage,
                    user_data.useCustomDestination
                ))
                conn.commit()
                
                return await self.get_user_by_id(user_id)
            except sqlite3.IntegrityError as e:
                if "username" in str(e):
                    raise HTTPException(status_code=400, detail="Username already exists")
                elif "email" in str(e):
                    raise HTTPException(status_code=400, detail="Email already exists")
                raise HTTPException(status_code=400, detail="User creation failed")
    
    async def authenticate_user(self, email: str, password: str) -> Optional[UserResponse]:
        """Authentifie un utilisateur"""
        async with self.db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM users WHERE email = ? AND isActive = TRUE
            """, (email,))
            row = cursor.fetchone()
            
            if row and self.verify_password(password, row['password_hash']):
                return UserResponse(**dict(row))
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        """Récupère un utilisateur par son ID"""
        async with self.db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM users WHERE id = ? AND isActive = TRUE
            """, (user_id,))
            row = cursor.fetchone()
            return UserResponse(**dict(row)) if row else None
    
    async def update_online_status(self, user_id: str, is_online: bool):
        """Met à jour le statut en ligne d'un utilisateur"""
        async with self.db.get_connection() as conn:
            now = datetime.now()
            conn.execute("""
                UPDATE users SET isOnline = ?, lastActiveAt = ?, lastSeen = ?
                WHERE id = ?
            """, (is_online, now, now if not is_online else None, user_id))
            conn.commit()

class MessageService:
    def __init__(self, db_manager: DatabaseManager, translation_service: TranslationService):
        self.db = db_manager
        self.translation = translation_service
    
    async def create_message(self, message_data: CreateMessageDto, sender_id: str) -> MessageResponse:
        """Crée un nouveau message"""
        message_id = str(uuid.uuid4())
        
        # Détecter la langue du message
        detected_lang = await self.translation.detect_language(message_data.content)
        
        async with self.db.get_connection() as conn:
            # Vérifier que l'utilisateur fait partie de la conversation
            cursor = conn.execute("""
                SELECT 1 FROM conversation_participants 
                WHERE conversationId = ? AND userId = ? AND leftAt IS NULL
            """, (message_data.conversationId, sender_id))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="Access denied to this conversation")
            
            # Créer le message
            now = datetime.now()
            conn.execute("""
                INSERT INTO messages (
                    id, content, senderId, conversationId, originalLanguage, 
                    replyToId, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                message_id, message_data.content, sender_id, 
                message_data.conversationId, detected_lang,
                message_data.replyToId, now, now
            ))
            conn.commit()
            
            # Récupérer le message créé avec les informations du sender
            return await self.get_message_by_id(message_id)
    
    async def get_message_by_id(self, message_id: str) -> MessageResponse:
        """Récupère un message par son ID"""
        async with self.db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT m.*, u.displayName, u.username, u.avatar
                FROM messages m
                JOIN users u ON m.senderId = u.id
                WHERE m.id = ?
            """, (message_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Message not found")
            
            return MessageResponse(
                id=row['id'],
                content=row['content'],
                senderId=row['senderId'],
                senderName=row['displayName'] or row['username'],
                senderAvatar=row['avatar'],
                originalLanguage=row['originalLanguage'],
                isEdited=bool(row['isEdited']),
                editedAt=row['editedAt'],
                isDeleted=bool(row['isDeleted']),
                conversationId=row['conversationId'],
                createdAt=row['createdAt'],
                updatedAt=row['updatedAt']
            )
    
    async def get_translated_message(self, message: MessageResponse, target_language: str) -> MessageResponse:
        """Traduit un message vers une langue cible"""
        if message.originalLanguage == target_language:
            return message
        
        try:
            translated_content = await self.translation.translate_text(
                message.content, message.originalLanguage, target_language
            )
            
            # Créer une copie du message avec la traduction
            translated_message = message.copy()
            translated_message.translatedContent = translated_content
            translated_message.targetLanguage = target_language
            
            return translated_message
        except Exception as e:
            logger.error(f"Translation error: {e}")
            return message

class ConversationService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    async def create_conversation(self, conversation_data: CreateConversationDto, 
                                creator_id: str) -> ConversationResponse:
        """Crée une nouvelle conversation"""
        conversation_id = str(uuid.uuid4())
        
        async with self.db.get_connection() as conn:
            now = datetime.now()
            
            # Créer la conversation
            conn.execute("""
                INSERT INTO conversations (id, type, title, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?)
            """, (conversation_id, conversation_data.type.value, 
                  conversation_data.title, now, now))
            
            # Ajouter le créateur
            participants = [creator_id] + conversation_data.participantIds
            for user_id in set(participants):  # Éviter les doublons
                role = ParticipantRole.ADMIN if user_id == creator_id else ParticipantRole.MEMBER
                conn.execute("""
                    INSERT INTO conversation_participants (
                        id, conversationId, userId, role, joinedAt
                    ) VALUES (?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), conversation_id, user_id, role.value, now))
            
            conn.commit()
            
            return await self.get_conversation_by_id(conversation_id, creator_id)
    
    async def get_conversation_by_id(self, conversation_id: str, user_id: str) -> ConversationResponse:
        """Récupère une conversation par son ID"""
        async with self.db.get_connection() as conn:
            # Vérifier l'accès
            cursor = conn.execute("""
                SELECT 1 FROM conversation_participants 
                WHERE conversationId = ? AND userId = ? AND leftAt IS NULL
            """, (conversation_id, user_id))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="Access denied to this conversation")
            
            # Récupérer la conversation
            cursor = conn.execute("""
                SELECT * FROM conversations WHERE id = ?
            """, (conversation_id,))
            conv_row = cursor.fetchone()
            
            if not conv_row:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Récupérer les participants
            cursor = conn.execute("""
                SELECT cp.*, u.username, u.displayName, u.avatar, u.isOnline
                FROM conversation_participants cp
                JOIN users u ON cp.userId = u.id
                WHERE cp.conversationId = ? AND cp.leftAt IS NULL
            """, (conversation_id,))
            participants = cursor.fetchall()
            
            return ConversationResponse(
                id=conv_row['id'],
                type=ConversationType(conv_row['type']),
                title=conv_row['title'],
                isActive=bool(conv_row['isActive']),
                createdAt=conv_row['createdAt'],
                updatedAt=conv_row['updatedAt'],
                participants=[dict(p) for p in participants]
            )

# ===== GESTIONNAIRE WEBSOCKET =====

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self.user_connections: Dict[WebSocket, str] = {}    # websocket -> user_id
        self.conversation_rooms: Dict[str, Set[str]] = {}   # conversation_id -> set of user_ids
        self.typing_users: Dict[str, Set[str]] = {}         # conversation_id -> set of user_ids

    async def connect(self, websocket: WebSocket, user_id: str):
        """Connecte un utilisateur WebSocket"""
        await websocket.accept()
        
        # Nettoyer les anciennes connexions
        if user_id in self.active_connections:
            old_websocket = self.active_connections[user_id]
            if old_websocket in self.user_connections:
                del self.user_connections[old_websocket]
        
        self.active_connections[user_id] = websocket
        self.user_connections[websocket] = user_id
        
        logger.info(f"User {user_id} connected via WebSocket")

    async def disconnect(self, websocket: WebSocket):
        """Déconnecte un utilisateur WebSocket"""
        user_id = self.user_connections.get(websocket)
        if user_id:
            self.active_connections.pop(user_id, None)
            self.user_connections.pop(websocket, None)
            
            # Nettoyer les salles de conversation
            for conv_id, users in self.conversation_rooms.items():
                users.discard(user_id)
            
            # Nettoyer les utilisateurs en train de taper
            for conv_id, users in self.typing_users.items():
                if user_id in users:
                    users.remove(user_id)
                    await self.broadcast_typing(conv_id, user_id, "", False)
            
            logger.info(f"User {user_id} disconnected from WebSocket")

    async def join_conversation(self, user_id: str, conversation_id: str):
        """Fait rejoindre un utilisateur à une conversation"""
        if conversation_id not in self.conversation_rooms:
            self.conversation_rooms[conversation_id] = set()
        self.conversation_rooms[conversation_id].add(user_id)

    async def leave_conversation(self, user_id: str, conversation_id: str):
        """Fait quitter un utilisateur d'une conversation"""
        if conversation_id in self.conversation_rooms:
            self.conversation_rooms[conversation_id].discard(user_id)

    async def send_personal_message(self, user_id: str, message: dict):
        """Envoie un message à un utilisateur spécifique"""
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                await self.disconnect(websocket)

    async def broadcast_to_conversation(self, conversation_id: str, message: dict, exclude_user: str = None):
        """Diffuse un message à tous les participants d'une conversation"""
        users = self.conversation_rooms.get(conversation_id, set())
        for user_id in users:
            if user_id != exclude_user:
                await self.send_personal_message(user_id, message)

    async def broadcast_typing(self, conversation_id: str, user_id: str, username: str, is_typing: bool):
        """Diffuse l'état de frappe d'un utilisateur"""
        message = {
            "type": "userTyping",
            "data": {
                "conversationId": conversation_id,
                "userId": user_id,
                "username": username,
                "isTyping": is_typing
            }
        }
        await self.broadcast_to_conversation(conversation_id, message, exclude_user=user_id)

# ===== AUTHENTIFICATION JWT =====

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crée un token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
   """Vérifie un token JWT"""
   try:
       payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
       return payload
   except jwt.ExpiredSignatureError:
       raise HTTPException(status_code=401, detail="Token expired")
   except jwt.JWTError:
       raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
   """Récupère l'utilisateur actuel depuis le token JWT"""
   payload = verify_token(credentials.credentials)
   user_id = payload.get("sub")
   if user_id is None:
       raise HTTPException(status_code=401, detail="Invalid token payload")
   
   user = await user_service.get_user_by_id(user_id)
   if user is None:
       raise HTTPException(status_code=401, detail="User not found")
   
   return user

async def get_user_from_websocket_token(token: str) -> Optional[UserResponse]:
   """Récupère l'utilisateur depuis un token WebSocket"""
   try:
       payload = verify_token(token)
       user_id = payload.get("sub")
       if user_id:
           return await user_service.get_user_by_id(user_id)
   except Exception as e:
       logger.error(f"WebSocket token verification error: {e}")
   return None

# ===== INITIALISATION DES SERVICES =====

db_manager = DatabaseManager(DATABASE_PATH)
translation_service = TranslationService()
user_service = UserService(db_manager)
message_service = MessageService(db_manager, translation_service)
conversation_service = ConversationService(db_manager)
connection_manager = ConnectionManager()

# ===== APPLICATION FASTAPI =====

app = FastAPI(title="Chat WebSocket API with Real-time Translation", version="1.0.0")

# Configuration CORS
app.add_middleware(
   CORSMiddleware,
   allow_origins=["http://localhost:3000"],
   allow_credentials=True,
   allow_methods=["*"],
   allow_headers=["*"],
)

# ===== ENDPOINTS REST =====

@app.post("/auth/register")
async def register(user_data: UserCreate):
   """Inscription d'un nouvel utilisateur"""
   user = await user_service.create_user(user_data)
   access_token = create_access_token(data={"sub": user.id})
   return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.post("/auth/login")
async def login(credentials: LoginRequest):
   """Connexion d'un utilisateur"""
   user = await user_service.authenticate_user(credentials.email, credentials.password)
   if not user:
       raise HTTPException(status_code=401, detail="Invalid credentials")
   
   access_token = create_access_token(data={"sub": user.id})
   await user_service.update_online_status(user.id, True)
   
   return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.get("/auth/me")
async def get_me(current_user: UserResponse = Depends(get_current_user)):
   """Récupère les informations de l'utilisateur connecté"""
   return current_user

@app.post("/conversations")
async def create_conversation(
   conversation_data: CreateConversationDto,
   current_user: UserResponse = Depends(get_current_user)
):
   """Crée une nouvelle conversation"""
   return await conversation_service.create_conversation(conversation_data, current_user.id)

@app.get("/conversations/{conversation_id}")
async def get_conversation(
   conversation_id: str,
   current_user: UserResponse = Depends(get_current_user)
):
   """Récupère une conversation par son ID"""
   return await conversation_service.get_conversation_by_id(conversation_id, current_user.id)

@app.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
   conversation_id: str,
   page: int = 1,
   limit: int = 50,
   translate_to: Optional[str] = None,
   current_user: UserResponse = Depends(get_current_user)
):
   """Récupère les messages d'une conversation avec traduction optionnelle"""
   async with db_manager.get_connection() as conn:
       # Vérifier l'accès
       cursor = conn.execute("""
           SELECT 1 FROM conversation_participants 
           WHERE conversationId = ? AND userId = ? AND leftAt IS NULL
       """, (conversation_id, current_user.id))
       
       if not cursor.fetchone():
           raise HTTPException(status_code=403, detail="Access denied to this conversation")
       
       # Récupérer les messages avec pagination
       offset = (page - 1) * limit
       cursor = conn.execute("""
           SELECT m.*, u.displayName, u.username, u.avatar
           FROM messages m
           JOIN users u ON m.senderId = u.id
           WHERE m.conversationId = ? AND m.isDeleted = FALSE
           ORDER BY m.createdAt DESC
           LIMIT ? OFFSET ?
       """, (conversation_id, limit, offset))
       
       rows = cursor.fetchall()
       messages = []
       
       # Déterminer la langue de traduction
       target_language = translate_to or current_user.systemLanguage
       
       for row in rows:
           message = MessageResponse(
               id=row['id'],
               content=row['content'],
               senderId=row['senderId'],
               senderName=row['displayName'] or row['username'],
               senderAvatar=row['avatar'],
               originalLanguage=row['originalLanguage'],
               isEdited=bool(row['isEdited']),
               editedAt=row['editedAt'],
               isDeleted=bool(row['isDeleted']),
               conversationId=row['conversationId'],
               createdAt=row['createdAt'],
               updatedAt=row['updatedAt']
           )
           
           # Traduire si nécessaire
           if current_user.autoTranslateEnabled and row['originalLanguage'] != target_language:
               message = await message_service.get_translated_message(message, target_language)
           
           messages.append(message)
       
       return {"messages": messages, "page": page, "limit": limit}

# ===== WEBSOCKET ENDPOINT =====

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
   """Point d'entrée WebSocket principal"""
   if not token:
       await websocket.close(code=1008, reason="Authentication required")
       return
   
   user = await get_user_from_websocket_token(token)
   if not user:
       await websocket.close(code=1008, reason="Invalid token")
       return
   
   await connection_manager.connect(websocket, user.id)
   await user_service.update_online_status(user.id, True)
   
   # Rejoindre automatiquement les conversations de l'utilisateur
   async with db_manager.get_connection() as conn:
       cursor = conn.execute("""
           SELECT conversationId FROM conversation_participants 
           WHERE userId = ? AND leftAt IS NULL
       """, (user.id,))
       
       for row in cursor.fetchall():
           await connection_manager.join_conversation(user.id, row['conversationId'])
   
   # Notifier les autres utilisateurs de la connexion
   await connection_manager.send_personal_message(user.id, {
       "type": "connected",
       "data": {"message": "Successfully connected to chat server"}
   })
   
   try:
       while True:
           # Recevoir les messages WebSocket
           data = await websocket.receive_text()
           message = json.loads(data)
           
           await handle_websocket_message(websocket, user, message)
           
   except WebSocketDisconnect:
       await connection_manager.disconnect(websocket)
       await user_service.update_online_status(user.id, False)
   except Exception as e:
       logger.error(f"WebSocket error for user {user.id}: {e}")
       await connection_manager.disconnect(websocket)
       await user_service.update_online_status(user.id, False)

async def handle_websocket_message(websocket: WebSocket, user: UserResponse, message: dict):
   """Gère les messages WebSocket entrants"""
   message_type = message.get("type")
   data = message.get("data", {})
   
   try:
       if message_type == "sendMessage":
           await handle_send_message(user, data)
       
       elif message_type == "startTyping":
           await handle_start_typing(user, data)
       
       elif message_type == "stopTyping":
           await handle_stop_typing(user, data)
       
       elif message_type == "joinConversation":
           await handle_join_conversation(user, data)
       
       elif message_type == "leaveConversation":
           await handle_leave_conversation(user, data)
       
       elif message_type == "markMessageRead":
           await handle_mark_message_read(user, data)
       
       else:
           logger.warning(f"Unknown message type: {message_type}")
           await connection_manager.send_personal_message(user.id, {
               "type": "error",
               "data": {"message": f"Unknown message type: {message_type}"}
           })
   
   except Exception as e:
       logger.error(f"Error handling WebSocket message: {e}")
       await connection_manager.send_personal_message(user.id, {
           "type": "error",
           "data": {"message": "Internal server error"}
       })

async def handle_send_message(user: UserResponse, data: dict):
   """Gère l'envoi d'un message"""
   try:
       # Créer le DTO depuis les données reçues
       message_dto = CreateMessageDto(
           conversationId=data["conversationId"],
           content=data["content"],
           replyToId=data.get("replyToId")
       )
       
       # Créer le message
       message = await message_service.create_message(message_dto, user.id)
       
       logger.info(f"Message created: {message.id} in conversation {message.conversationId}")
       
       # Récupérer tous les participants de la conversation avec leurs préférences
       async with db_manager.get_connection() as conn:
           cursor = conn.execute("""
               SELECT cp.userId, u.systemLanguage, u.autoTranslateEnabled, 
                      u.translateToSystemLanguage, u.customDestinationLanguage,
                      u.useCustomDestination
               FROM conversation_participants cp
               JOIN users u ON cp.userId = u.id
               WHERE cp.conversationId = ? AND cp.leftAt IS NULL
           """, (message.conversationId,))
           
           participants = cursor.fetchall()
       
       # Diffuser le message à chaque participant avec traduction si nécessaire
       for participant in participants:
           participant_message = message
           
           # Déterminer la langue cible pour ce participant
           if participant['autoTranslateEnabled'] and participant['userId'] != user.id:
               target_lang = None
               
               if participant['useCustomDestination'] and participant['customDestinationLanguage']:
                   target_lang = participant['customDestinationLanguage']
               elif participant['translateToSystemLanguage']:
                   target_lang = participant['systemLanguage']
               
               # Traduire si nécessaire
               if target_lang and target_lang != message.originalLanguage:
                   try:
                       participant_message = await message_service.get_translated_message(
                           message, target_lang
                       )
                       logger.info(f"Translated message for user {participant['userId']} to {target_lang}")
                   except Exception as e:
                       logger.error(f"Translation failed for user {participant['userId']}: {e}")
           
           # Envoyer le message au participant
           await connection_manager.send_personal_message(participant['userId'], {
               "type": "newMessage",
               "data": {
                   "message": participant_message.dict(),
                   "conversationId": message.conversationId
               }
           })
       
       # Arrêter l'indicateur de frappe pour l'expéditeur
       if message.conversationId in connection_manager.typing_users:
           typing_users = connection_manager.typing_users[message.conversationId]
           if user.id in typing_users:
               typing_users.remove(user.id)
               await connection_manager.broadcast_typing(
                   message.conversationId, user.id, user.displayName or user.username, False
               )
       
       # Confirmer l'envoi à l'expéditeur
       await connection_manager.send_personal_message(user.id, {
           "type": "messageSent",
           "data": {"messageId": message.id, "success": True}
       })
       
   except Exception as e:
       logger.error(f"Error sending message: {e}")
       await connection_manager.send_personal_message(user.id, {
           "type": "messageSent",
           "data": {"success": False, "error": str(e)}
       })

async def handle_start_typing(user: UserResponse, data: dict):
   """Gère le début de frappe"""
   conversation_id = data.get("conversationId")
   if not conversation_id:
       return
   
   if conversation_id not in connection_manager.typing_users:
       connection_manager.typing_users[conversation_id] = set()
   
   connection_manager.typing_users[conversation_id].add(user.id)
   
   await connection_manager.broadcast_typing(
       conversation_id, user.id, user.displayName or user.username, True
   )

async def handle_stop_typing(user: UserResponse, data: dict):
   """Gère l'arrêt de frappe"""
   conversation_id = data.get("conversationId")
   if not conversation_id:
       return
   
   if conversation_id in connection_manager.typing_users:
       connection_manager.typing_users[conversation_id].discard(user.id)
   
   await connection_manager.broadcast_typing(
       conversation_id, user.id, user.displayName or user.username, False
   )

async def handle_join_conversation(user: UserResponse, data: dict):
   """Gère l'adhésion à une conversation"""
   conversation_id = data.get("conversationId")
   if not conversation_id:
       return
   
   # Vérifier l'accès à la conversation
   async with db_manager.get_connection() as conn:
       cursor = conn.execute("""
           SELECT 1 FROM conversation_participants 
           WHERE conversationId = ? AND userId = ? AND leftAt IS NULL
       """, (conversation_id, user.id))
       
       if cursor.fetchone():
           await connection_manager.join_conversation(user.id, conversation_id)
           await connection_manager.send_personal_message(user.id, {
               "type": "joinedConversation",
               "data": {"conversationId": conversation_id, "success": True}
           })
       else:
           await connection_manager.send_personal_message(user.id, {
               "type": "joinedConversation",
               "data": {"conversationId": conversation_id, "success": False, "error": "Access denied"}
           })

async def handle_leave_conversation(user: UserResponse, data: dict):
   """Gère la sortie d'une conversation"""
   conversation_id = data.get("conversationId")
   if not conversation_id:
       return
   
   await connection_manager.leave_conversation(user.id, conversation_id)
   
   # Arrêter la frappe si active
   if conversation_id in connection_manager.typing_users:
       connection_manager.typing_users[conversation_id].discard(user.id)
       await connection_manager.broadcast_typing(
           conversation_id, user.id, user.displayName or user.username, False
       )
   
   await connection_manager.send_personal_message(user.id, {
       "type": "leftConversation",
       "data": {"conversationId": conversation_id, "success": True}
   })

async def handle_mark_message_read(user: UserResponse, data: dict):
   """Gère le marquage d'un message comme lu"""
   message_id = data.get("messageId")
   if not message_id:
       return
   
   # Ici, vous pourriez implémenter la logique de marquage des messages comme lus
   # Pour l'instant, on confirme simplement la réception
   await connection_manager.send_personal_message(user.id, {
       "type": "messageMarkedRead",
       "data": {"messageId": message_id, "success": True}
   })

# ===== ENDPOINTS UTILITAIRES =====

@app.get("/health")
async def health_check():
   """Vérification de l'état de santé de l'API"""
   return {
       "status": "healthy",
       "timestamp": datetime.now(),
       "connections": len(connection_manager.active_connections),
       "translation_models_loaded": len(translation_service.models)
   }

@app.get("/stats")
async def get_stats(current_user: UserResponse = Depends(get_current_user)):
   """Statistiques de l'application"""
   if current_user.role not in [UserRole.ADMIN, UserRole.BIGBOSS]:
       raise HTTPException(status_code=403, detail="Access denied")
   
   async with db_manager.get_connection() as conn:
       # Compter les utilisateurs
       cursor = conn.execute("SELECT COUNT(*) as count FROM users WHERE isActive = TRUE")
       users_count = cursor.fetchone()['count']
       
       # Compter les conversations
       cursor = conn.execute("SELECT COUNT(*) as count FROM conversations WHERE isActive = TRUE")
       conversations_count = cursor.fetchone()['count']
       
       # Compter les messages
       cursor = conn.execute("SELECT COUNT(*) as count FROM messages WHERE isDeleted = FALSE")
       messages_count = cursor.fetchone()['count']
       
       # Utilisateurs en ligne
       cursor = conn.execute("SELECT COUNT(*) as count FROM users WHERE isOnline = TRUE")
       online_users = cursor.fetchone()['count']
   
   return {
       "users": users_count,
       "conversations": conversations_count,
       "messages": messages_count,
       "online_users": online_users,
       "websocket_connections": len(connection_manager.active_connections),
       "translation_cache_size": len(translation_service.models)
   }

# ===== POINT D'ENTRÉE PRINCIPAL =====

if __name__ == "__main__":
   logger.info("Starting Chat WebSocket Server with Real-time Translation")
   logger.info(f"Translation models available: {len(translation_service.language_pairs)} language pairs")
   
   uvicorn.run(
       "main:app",  # Remplacez "main" par le nom de votre fichier si différent
       host="0.0.0.0",
       port=8000,
       reload=True,
       log_level="info"
   )