"""
Service de cache optimisé pour les traductions
Utilise Redis + cache local pour performance maximale
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from config.settings import get_settings

logger = logging.getLogger(__name__)

@dataclass
class CacheEntry:
    """Entrée de cache avec métadonnées"""
    value: str
    created_at: float
    hits: int = 0
    source_lang: str = ""
    target_lang: str = ""
    model_type: str = "basic"

class CacheService:
    """Service de cache multi-niveau pour les traductions"""
    
    def __init__(self):
        self.settings = get_settings()
        self.redis_client: Optional[redis.Redis] = None
        self.local_cache: Dict[str, CacheEntry] = {}
        self.stats = {
            'redis_hits': 0,
            'local_hits': 0,
            'misses': 0,
            'total_requests': 0,
            'redis_errors': 0
        }
        self.is_initialized = False
    
    async def initialize(self):
        """Initialise le service de cache"""
        try:
            if REDIS_AVAILABLE:
                logger.info("🔌 Connexion à Redis...")
                self.redis_client = redis.from_url(
                    self.settings.redis_url,
                    encoding='utf-8',
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                
                # Test de connexion
                await self.redis_client.ping()
                logger.info("✅ Redis connecté avec succès")
            else:
                logger.warning("⚠️ Redis non disponible, utilisation du cache local uniquement")
            
            self.is_initialized = True
            logger.info("📦 Service de cache initialisé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation du cache: {e}")
            logger.warning("🔄 Basculement vers le cache local uniquement")
            self.redis_client = None
            self.is_initialized = True
    
    def _generate_cache_key(self, text: str, source_lang: str, target_lang: str, model_type: str = "basic") -> str:
        """Génère une clé de cache unique"""
        # Normaliser le texte pour améliorer les hits de cache
        normalized_text = text.strip().lower()
        
        # Créer la clé avec hash pour éviter les clés trop longues
        key_data = f"{normalized_text}:{source_lang}:{target_lang}:{model_type}"
        key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:16]
        
        return f"meeshy:translate:{source_lang}:{target_lang}:{model_type}:{key_hash}"
    
    async def get_translation(self, text: str, source_lang: str, target_lang: str, model_type: str = "basic") -> Optional[Dict[str, Any]]:
        """Récupère une traduction du cache"""
        if not self.is_initialized:
            return None
        
        cache_key = self._generate_cache_key(text, source_lang, target_lang, model_type)
        self.stats['total_requests'] += 1
        
        # 1. Vérifier le cache local d'abord (plus rapide)
        if cache_key in self.local_cache:
            entry = self.local_cache[cache_key]
            
            # Vérifier l'expiration
            if time.time() - entry.created_at < self.settings.translation_cache_ttl:
                entry.hits += 1
                self.stats['local_hits'] += 1
                
                logger.debug(f"💨 Cache local HIT: {cache_key}")
                return {
                    'translated_text': entry.value,
                    'from_cache': True,
                    'cache_source': 'local',
                    'cache_key': cache_key,
                    'hits': entry.hits
                }
            else:
                # Entrée expirée, la supprimer
                del self.local_cache[cache_key]
        
        # 2. Vérifier Redis si disponible
        if self.redis_client:
            try:
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    data = json.loads(cached_data)
                    self.stats['redis_hits'] += 1
                    
                    # Sauvegarder dans le cache local pour les prochaines requêtes
                    self.local_cache[cache_key] = CacheEntry(
                        value=data['translated_text'],
                        created_at=time.time(),
                        hits=data.get('hits', 0) + 1,
                        source_lang=source_lang,
                        target_lang=target_lang,
                        model_type=model_type
                    )
                    
                    logger.debug(f"🔥 Cache Redis HIT: {cache_key}")
                    return {
                        'translated_text': data['translated_text'],
                        'from_cache': True,
                        'cache_source': 'redis',
                        'cache_key': cache_key,
                        'hits': data.get('hits', 0) + 1
                    }
                    
            except Exception as e:
                logger.error(f"❌ Erreur Redis GET: {e}")
                self.stats['redis_errors'] += 1
        
        # 3. Aucun cache trouvé
        self.stats['misses'] += 1
        logger.debug(f"❌ Cache MISS: {cache_key}")
        return None
    
    async def set_translation(self, text: str, source_lang: str, target_lang: str, translated_text: str, model_type: str = "basic", metadata: Optional[Dict] = None) -> bool:
        """Sauvegarde une traduction dans le cache"""
        if not self.is_initialized:
            return False
        
        cache_key = self._generate_cache_key(text, source_lang, target_lang, model_type)
        current_time = time.time()
        
        # Données à cacher
        cache_data = {
            'translated_text': translated_text,
            'source_lang': source_lang,
            'target_lang': target_lang,
            'model_type': model_type,
            'created_at': current_time,
            'hits': 0
        }
        
        if metadata:
            cache_data.update(metadata)
        
        try:
            # 1. Sauvegarder dans le cache local
            self.local_cache[cache_key] = CacheEntry(
                value=translated_text,
                created_at=current_time,
                source_lang=source_lang,
                target_lang=target_lang,
                model_type=model_type
            )
            
            # Limiter la taille du cache local
            if len(self.local_cache) > self.settings.cache_max_entries:
                await self._cleanup_local_cache()
            
            # 2. Sauvegarder dans Redis si disponible
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.settings.translation_cache_ttl,
                    json.dumps(cache_data)
                )
            
            logger.debug(f"✅ Cache SET: {cache_key}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la sauvegarde en cache: {e}")
            if self.redis_client:
                self.stats['redis_errors'] += 1
            return False
    
    async def _cleanup_local_cache(self):
        """Nettoie le cache local en gardant les entrées les plus récentes et utilisées"""
        if len(self.local_cache) <= self.settings.cache_max_entries:
            return
        
        # Trier par hits (plus utilisées) et date (plus récentes)
        sorted_entries = sorted(
            self.local_cache.items(),
            key=lambda x: (x[1].hits, x[1].created_at),
            reverse=True
        )
        
        # Garder seulement les 80% meilleures entrées
        keep_count = int(self.settings.cache_max_entries * 0.8)
        entries_to_keep = dict(sorted_entries[:keep_count])
        
        removed_count = len(self.local_cache) - len(entries_to_keep)
        self.local_cache = entries_to_keep
        
        logger.info(f"🧹 Cache local nettoyé: {removed_count} entrées supprimées")
    
    async def clear_cache(self, pattern: Optional[str] = None):
        """Vide le cache (local et Redis)"""
        # Vider le cache local
        if pattern:
            keys_to_remove = [k for k in self.local_cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self.local_cache[key]
            logger.info(f"🧹 Cache local vidé pour le pattern: {pattern}")
        else:
            self.local_cache.clear()
            logger.info("🧹 Cache local entièrement vidé")
        
        # Vider Redis si disponible
        if self.redis_client:
            try:
                if pattern:
                    keys = await self.redis_client.keys(f"meeshy:translate:*{pattern}*")
                    if keys:
                        await self.redis_client.delete(*keys)
                        logger.info(f"🧹 Cache Redis vidé pour le pattern: {pattern} ({len(keys)} clés)")
                else:
                    keys = await self.redis_client.keys("meeshy:translate:*")
                    if keys:
                        await self.redis_client.delete(*keys)
                        logger.info(f"🧹 Cache Redis entièrement vidé ({len(keys)} clés)")
            except Exception as e:
                logger.error(f"❌ Erreur lors du vidage Redis: {e}")
                self.stats['redis_errors'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du cache"""
        total_requests = self.stats['total_requests']
        if total_requests > 0:
            hit_rate = (self.stats['redis_hits'] + self.stats['local_hits']) / total_requests * 100
        else:
            hit_rate = 0
        
        return {
            **self.stats,
            'hit_rate_percent': round(hit_rate, 2),
            'local_cache_size': len(self.local_cache),
            'redis_available': self.redis_client is not None,
            'cache_initialized': self.is_initialized
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé du service de cache"""
        health = {
            'local_cache': True,
            'redis': False,
            'redis_latency_ms': None
        }
        
        if self.redis_client:
            try:
                start_time = time.time()
                await self.redis_client.ping()
                latency = (time.time() - start_time) * 1000
                
                health['redis'] = True
                health['redis_latency_ms'] = round(latency, 2)
            except Exception as e:
                logger.error(f"❌ Health check Redis failed: {e}")
        
        return health
    
    async def close(self):
        """Ferme les connexions du service de cache"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("✅ Connexion Redis fermée")
        
        self.local_cache.clear()
        logger.info("✅ Service de cache fermé")
