"""
Service de cache production-ready pour les traductions
Gère le cache Redis + fallback local avec TTL et optimisations
"""

import asyncio
import json
import hashlib
import logging
import time
from typing import Optional, Dict, Any, Union
from datetime import datetime, timedelta

# Import conditionnel de Redis
try:
    import redis.asyncio as redis
    REDIS_ASYNC_AVAILABLE = True
except ImportError:
    REDIS_ASYNC_AVAILABLE = False
    try:
        import redis
        REDIS_SYNC_AVAILABLE = True
    except ImportError:
        REDIS_SYNC_AVAILABLE = False

from config.settings import get_settings

logger = logging.getLogger(__name__)

class CacheService:
    """Service de cache haute performance avec Redis et fallback local"""
    
    def __init__(self):
        self.settings = get_settings()
        self.redis_client: Optional[Union[redis.Redis, Any]] = None
        self.is_redis_available = False
        
        # Cache local de fallback (toujours disponible)
        self._local_cache: Dict[str, Dict[str, Any]] = {}
        self._local_cache_timestamps: Dict[str, float] = {}
        
        # Statistiques
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0,
            'local_cache_size': 0,
            'redis_available': False
        }
        
    async def initialize(self):
        """Initialise le service de cache (Redis + local)"""
        logger.info("🔄 Initialisation du service de cache...")
        
        # Toujours initialiser le cache local
        self._local_cache.clear()
        self._local_cache_timestamps.clear()
        
        # Essayer d'initialiser Redis
        if REDIS_ASYNC_AVAILABLE:
            await self._init_redis_async()
        elif REDIS_SYNC_AVAILABLE:
            self._init_redis_sync()
        else:
            logger.warning("⚠️ Redis non disponible - cache local uniquement")
        
        self.stats['redis_available'] = self.is_redis_available
        
        logger.info(f"✅ Cache initialisé (Redis: {self.is_redis_available}, Local: Toujours)")
        
    async def _init_redis_async(self):
        """Initialise Redis en mode async"""
        try:
            self.redis_client = redis.from_url(
                self.settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test de connexion
            await self.redis_client.ping()
            self.is_redis_available = True
            logger.info("✅ Redis async connecté")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis async non disponible: {e}")
            self.is_redis_available = False
            self.redis_client = None
    
    def _init_redis_sync(self):
        """Initialise Redis en mode sync (fallback)"""
        try:
            import redis as redis_sync
            self.redis_client = redis_sync.StrictRedis.from_url(
                self.settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test de connexion
            self.redis_client.ping()
            self.is_redis_available = True
            logger.info("✅ Redis sync connecté")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis sync non disponible: {e}")
            self.is_redis_available = False
            self.redis_client = None
    
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
        """Récupère une traduction depuis le cache (Redis prioritaire, local en fallback)"""
        try:
            # Essayer Redis d'abord si disponible
            if self.is_redis_available and self.redis_client:
                result = await self._get_from_redis(cache_key)
                if result:
                    self.stats['hits'] += 1
                    return result
            
            # Fallback vers cache local
            result = self._get_from_local_cache(cache_key)
            if result:
                self.stats['hits'] += 1
                return result
            
            self.stats['misses'] += 1
            return None
            
        except Exception as e:
            logger.error(f"❌ Erreur récupération cache: {e}")
            self.stats['errors'] += 1
            return None
    
    async def _get_from_redis(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Récupère depuis Redis"""
        try:
            if REDIS_ASYNC_AVAILABLE and hasattr(self.redis_client, 'get'):
                data = await self.redis_client.get(cache_key)
            else:
                # Mode sync
                data = self.redis_client.get(cache_key)
            
            if data:
                return json.loads(data)
            return None
            
        except Exception as e:
            logger.warning(f"⚠️ Erreur Redis get: {e}")
            return None
    
    def _get_from_local_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Récupère depuis le cache local avec vérification TTL"""
        if cache_key not in self._local_cache:
            return None
        
        # Vérifier TTL
        timestamp = self._local_cache_timestamps.get(cache_key, 0)
        if time.time() - timestamp > self.settings.translation_cache_ttl:
            # Expiré - nettoyer
            self._local_cache.pop(cache_key, None)
            self._local_cache_timestamps.pop(cache_key, None)
            return None
        
        return self._local_cache[cache_key]
    
    async def set_translation(self, cache_key: str, translation_data: Dict[str, Any]):
        """Stocke une traduction dans le cache (Redis + local)"""
        try:
            # Enrichir les données avec timestamp
            enriched_data = {
                **translation_data,
                'cached_at': time.time(),
                'ttl': self.settings.translation_cache_ttl
            }
            
            # Stocker dans Redis si disponible
            if self.is_redis_available and self.redis_client:
                await self._set_in_redis(cache_key, enriched_data)
            
            # Toujours stocker en local (fallback + rapidité)
            self._set_in_local_cache(cache_key, enriched_data)
            
            self.stats['sets'] += 1
            
        except Exception as e:
            logger.error(f"❌ Erreur stockage cache: {e}")
            self.stats['errors'] += 1
    
    async def _set_in_redis(self, cache_key: str, data: Dict[str, Any]):
        """Stocke dans Redis avec TTL"""
        try:
            data_json = json.dumps(data, ensure_ascii=False)
            
            if REDIS_ASYNC_AVAILABLE and hasattr(self.redis_client, 'setex'):
                await self.redis_client.setex(
                    cache_key, 
                    self.settings.translation_cache_ttl, 
                    data_json
                )
            else:
                # Mode sync
                self.redis_client.setex(
                    cache_key, 
                    self.settings.translation_cache_ttl, 
                    data_json
                )
                
        except Exception as e:
            logger.warning(f"⚠️ Erreur Redis set: {e}")
    
    def _set_in_local_cache(self, cache_key: str, data: Dict[str, Any]):
        """Stocke dans le cache local avec gestion de taille"""
        # Limiter la taille du cache local
        if len(self._local_cache) >= self.settings.cache_max_entries:
            self._cleanup_local_cache()
        
        self._local_cache[cache_key] = data
        self._local_cache_timestamps[cache_key] = time.time()
        self.stats['local_cache_size'] = len(self._local_cache)
    
    def _cleanup_local_cache(self):
        """Nettoie le cache local (supprime les plus anciens)"""
        if not self._local_cache_timestamps:
            return
        
        # Supprimer les entrées expirées
        current_time = time.time()
        expired_keys = [
            key for key, timestamp in self._local_cache_timestamps.items()
            if current_time - timestamp > self.settings.translation_cache_ttl
        ]
        
        for key in expired_keys:
            self._local_cache.pop(key, None)
            self._local_cache_timestamps.pop(key, None)
        
        # Si encore trop d'entrées, supprimer les plus anciennes
        if len(self._local_cache) >= self.settings.cache_max_entries:
            # Trier par timestamp (plus ancien en premier)
            sorted_keys = sorted(
                self._local_cache_timestamps.items(), 
                key=lambda x: x[1]
            )
            
            # Supprimer la moitié des plus anciennes
            keys_to_remove = sorted_keys[:len(sorted_keys) // 2]
            for key, _ in keys_to_remove:
                self._local_cache.pop(key, None)
                self._local_cache_timestamps.pop(key, None)
        
        self.stats['local_cache_size'] = len(self._local_cache)
    
    async def get_cache_info(self) -> Dict[str, Any]:
        """Retourne les informations du cache"""
        redis_info = {}
        
        if self.is_redis_available and self.redis_client:
            try:
                if REDIS_ASYNC_AVAILABLE and hasattr(self.redis_client, 'info'):
                    info = await self.redis_client.info('memory')
                else:
                    info = self.redis_client.info('memory')
                
                redis_info = {
                    'connected': True,
                    'memory_used': info.get('used_memory_human', 'N/A'),
                    'memory_peak': info.get('used_memory_peak_human', 'N/A')
                }
            except Exception as e:
                redis_info = {'connected': False, 'error': str(e)}
        else:
            redis_info = {'connected': False, 'reason': 'not_initialized'}
        
        return {
            'type': 'redis+local' if self.is_redis_available else 'local_only',
            'redis': redis_info,
            'local_cache': {
                'size': len(self._local_cache),
                'max_entries': self.settings.cache_max_entries,
                'ttl_seconds': self.settings.translation_cache_ttl
            },
            'stats': self.stats,
            'hit_rate': (
                self.stats['hits'] / (self.stats['hits'] + self.stats['misses'])
                if (self.stats['hits'] + self.stats['misses']) > 0 else 0.0
            )
        }
    
    async def clear_cache(self):
        """Vide le cache (Redis + local)"""
        try:
            # Vider Redis si disponible
            if self.is_redis_available and self.redis_client:
                if REDIS_ASYNC_AVAILABLE and hasattr(self.redis_client, 'flushdb'):
                    await self.redis_client.flushdb()
                else:
                    self.redis_client.flushdb()
                logger.info("🗑️ Cache Redis vidé")
            
            # Vider cache local
            self._local_cache.clear()
            self._local_cache_timestamps.clear()
            self.stats['local_cache_size'] = 0
            
            logger.info("🗑️ Cache local vidé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du vidage du cache: {e}")
    
    async def cleanup(self):
        """Nettoie les ressources du cache"""
        logger.info("🧹 Nettoyage du service de cache...")
        
        try:
            # Fermer la connexion Redis si active
            if self.is_redis_available and self.redis_client:
                if REDIS_ASYNC_AVAILABLE and hasattr(self.redis_client, 'close'):
                    await self.redis_client.close()
                elif hasattr(self.redis_client, 'connection_pool'):
                    self.redis_client.connection_pool.disconnect()
            
            # Vider le cache local
            self._local_cache.clear()
            self._local_cache_timestamps.clear()
            
            logger.info("✅ Nettoyage du cache terminé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du nettoyage du cache: {e}")
