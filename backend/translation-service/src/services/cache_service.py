"""
Service de cache Redis pour les traductions
Gère le cache de traductions avec TTL et clés optimisées
"""

import asyncio
import json
import hashlib
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

try:
    import redis.asyncio as redis
except ImportError:
    import redis

from config.settings import get_settings

logger = logging.getLogger(__name__)

class CacheService:
    """Service de cache Redis pour les traductions"""
    
    def __init__(self):
        self.settings = get_settings()
        self.redis_client: Optional[redis.Redis] = None
        self.is_available = False
        
    async def initialize(self):
        """Initialise la connexion Redis"""
        try:
            if hasattr(redis, 'from_url'):
                # redis.asyncio
                self.redis_client = redis.from_url(
                    self.settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20
                )
            else:
                # redis standard
                self.redis_client = redis.StrictRedis.from_url(
                    self.settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20
                )
            
            # Test de connexion
            if hasattr(self.redis_client, 'ping'):
                await self.redis_client.ping()
            else:
                self.redis_client.ping()
                
            self.is_available = True
            logger.info("✅ Connexion Redis établie")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis non disponible: {e}")
            logger.warning("📝 Fonctionnement en mode cache local uniquement")
            self.is_available = False
            self.redis_client = None
            
            # Cache local de fallback
            self._local_cache: Dict[str, Dict[str, Any]] = {}
    
    def generate_cache_key(self, text: str, source_lang: str, target_lang: str, model: str = "basic") -> str:
        """Génère une clé de cache unique et reproductible"""
        # Normalisation du texte
        normalized_text = text.strip().lower()
        
        # Création de la clé composite
        key_content = f"{normalized_text}|{source_lang}|{target_lang}|{model}"
        
        # Hash SHA-256 pour une clé courte et unique
        hash_obj = hashlib.sha256(key_content.encode('utf-8'))
        cache_key = f"translation:{hash_obj.hexdigest()[:16]}"
        
        return cache_key
    
    async def get_translation(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Récupère une traduction depuis le cache"""
        try:
            if self.is_available and self.redis_client:
                # Cache Redis
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    return json.loads(cached_data)
            else:
                # Cache local
                cached_entry = self._local_cache.get(cache_key)
                if cached_entry:
                    # Vérifier l'expiration
                    if datetime.fromisoformat(cached_entry['expires_at']) > datetime.now():
                        return cached_entry['data']
                    else:
                        # Supprimer l'entrée expirée
                        del self._local_cache[cache_key]
                        
        except Exception as e:
            logger.error(f"❌ Erreur lors de la lecture du cache: {e}")
            
        return None
    
    async def set_translation(self, cache_key: str, translation_data: Dict[str, Any]) -> bool:
        """Stocke une traduction dans le cache"""
        try:
            if self.is_available and self.redis_client:
                # Cache Redis avec TTL
                cached_data = json.dumps(translation_data)
                await self.redis_client.setex(
                    cache_key, 
                    self.settings.translation_cache_ttl, 
                    cached_data
                )
                return True
            else:
                # Cache local avec gestion d'expiration
                expires_at = datetime.now() + timedelta(seconds=self.settings.translation_cache_ttl)
                self._local_cache[cache_key] = {
                    'data': translation_data,
                    'expires_at': expires_at.isoformat()
                }
                
                # Nettoyage du cache si trop d'entrées
                if len(self._local_cache) > self.settings.cache_max_entries:
                    await self._cleanup_local_cache()
                    
                return True
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'écriture du cache: {e}")
            return False
    
    async def _cleanup_local_cache(self):
        """Nettoie le cache local en supprimant les entrées expirées et anciennes"""
        try:
            now = datetime.now()
            expired_keys = []
            
            # Identifier les entrées expirées
            for key, entry in self._local_cache.items():
                expires_at = datetime.fromisoformat(entry['expires_at'])
                if expires_at <= now:
                    expired_keys.append(key)
            
            # Supprimer les entrées expirées
            for key in expired_keys:
                del self._local_cache[key]
            
            # Si encore trop d'entrées, supprimer les plus anciennes
            if len(self._local_cache) > self.settings.cache_max_entries:
                # Trier par date d'expiration (les plus anciennes d'abord)
                sorted_entries = sorted(
                    self._local_cache.items(),
                    key=lambda x: x[1]['expires_at']
                )
                
                # Garder seulement les plus récentes
                entries_to_keep = sorted_entries[-self.settings.cache_max_entries:]
                self._local_cache = dict(entries_to_keep)
                
            logger.info(f"🧹 Cache local nettoyé: {len(self._local_cache)} entrées restantes")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du nettoyage du cache local: {e}")
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du cache"""
        try:
            if self.is_available and self.redis_client:
                # Stats Redis
                info = await self.redis_client.info('memory')
                keyspace = await self.redis_client.info('keyspace')
                
                return {
                    "cache_type": "redis",
                    "available": True,
                    "memory_usage": info.get('used_memory_human', 'unknown'),
                    "total_keys": sum(db.get('keys', 0) for db in keyspace.values() if isinstance(db, dict)),
                    "url": self.settings.redis_url
                }
            else:
                # Stats cache local
                return {
                    "cache_type": "local",
                    "available": True,
                    "total_entries": len(self._local_cache),
                    "max_entries": self.settings.cache_max_entries,
                    "ttl_seconds": self.settings.translation_cache_ttl
                }
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de la récupération des stats: {e}")
            return {
                "cache_type": "unknown",
                "available": False,
                "error": str(e)
            }
    
    async def clear_cache(self) -> bool:
        """Vide le cache"""
        try:
            if self.is_available and self.redis_client:
                # Vider Redis (attention: vide toute la DB Redis!)
                await self.redis_client.flushdb()
                logger.info("🗑️ Cache Redis vidé")
            else:
                # Vider le cache local
                self._local_cache.clear()
                logger.info("🗑️ Cache local vidé")
                
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du vidage du cache: {e}")
            return False
    
    async def cleanup(self):
        """Nettoie les ressources lors de l'arrêt"""
        try:
            if self.is_available and self.redis_client:
                await self.redis_client.close()
                logger.info("✅ Connexion Redis fermée")
        except Exception as e:
            logger.error(f"❌ Erreur lors de la fermeture Redis: {e}")
