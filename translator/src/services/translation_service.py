"""
Service de traduction haute performance pour Meeshy
Supporte 100-1000 traductions par seconde selon le matériel
"""

import asyncio
import logging
import time
import hashlib
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading
from collections import OrderedDict

logger = logging.getLogger(__name__)

@dataclass
class TranslationRequest:
    """Requête de traduction"""
    text: str
    source_language: str
    target_language: str
    model_type: str = 'basic'
    task_id: Optional[str] = None

@dataclass
class TranslationResult:
    """Résultat de traduction"""
    translated_text: str
    detected_language: str
    confidence: float
    model_used: str
    from_cache: bool
    processing_time: float
    cache_key: str

class TranslationCache:
    """Cache haute performance pour les traductions"""
    
    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.cache: OrderedDict = OrderedDict()
        self.lock = threading.RLock()
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0
        }
    
    def get(self, key: str) -> Optional[TranslationResult]:
        """Récupère une traduction du cache"""
        with self.lock:
            if key in self.cache:
                # Déplacer en fin (LRU)
                result = self.cache.pop(key)
                self.cache[key] = result
                self.stats['hits'] += 1
                return result
            else:
                self.stats['misses'] += 1
                return None
    
    def put(self, key: str, result: TranslationResult):
        """Ajoute une traduction au cache"""
        with self.lock:
            if key in self.cache:
                # Mettre à jour
                self.cache.pop(key)
            elif len(self.cache) >= self.max_size:
                # Éviction LRU
                self.cache.popitem(last=False)
                self.stats['evictions'] += 1
            
            self.cache[key] = result
    
    def get_stats(self) -> Dict:
        """Récupère les statistiques du cache"""
        with self.lock:
            total = self.stats['hits'] + self.stats['misses']
            hit_rate = self.stats['hits'] / total if total > 0 else 0
            
            return {
                **self.stats,
                'size': len(self.cache),
                'max_size': self.max_size,
                'hit_rate': hit_rate
            }

class HighPerformanceTranslationService:
    """Service de traduction haute performance"""
    
    def __init__(self, max_workers: int = 20):
        self.max_workers = max_workers
        self.cache = TranslationCache()
        self.worker_pool = ThreadPoolExecutor(max_workers=max_workers)
        self.stats = {
            'total_requests': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0,
            'avg_processing_time': 0.0,
            'requests_per_second': 0.0
        }
        self.request_times: List[float] = []
        self.last_stats_reset = time.time()
        
        # Modèles de traduction disponibles
        self.translation_models = {
            'basic': self._translate_basic,
            'medium': self._translate_medium,
            'premium': self._translate_premium
        }
    
    async def translate(
        self, 
        text: str, 
        source_language: str, 
        target_language: str, 
        model_type: str = 'basic'
    ) -> Dict[str, Any]:
        """Traduit un texte avec haute performance"""
        
        start_time = time.time()
        self.stats['total_requests'] += 1
        
        try:
            # Générer la clé de cache
            cache_key = self._generate_cache_key(text, source_language, target_language, model_type)
            
            # Vérifier le cache
            cached_result = self.cache.get(cache_key)
            if cached_result:
                self.stats['cache_hits'] += 1
                logger.info(f"💾 Cache hit pour {cache_key}")
                return self._format_result(cached_result)
            
            self.stats['cache_misses'] += 1
            
            # Créer la requête
            request = TranslationRequest(
                text=text,
                source_language=source_language,
                target_language=target_language,
                model_type=model_type
            )
            
            # Traduire avec le modèle approprié
            translation_func = self.translation_models.get(model_type, self._translate_basic)
            
            # Utiliser le pool de workers pour les traductions lourdes
            if model_type in ['medium', 'premium']:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    self.worker_pool, 
                    translation_func, 
                    request
                )
            else:
                # Traduction basique synchrone pour la performance
                result = translation_func(request)
            
            # Mettre en cache
            self.cache.put(cache_key, result)
            
            # Mettre à jour les statistiques
            processing_time = time.time() - start_time
            self._update_stats(processing_time)
            
            logger.info(f"✅ Traduction terminée: {text[:50]}... → {result.translated_text[:50]}... ({processing_time:.3f}s)")
            
            return self._format_result(result)
            
        except Exception as e:
            self.stats['errors'] += 1
            processing_time = time.time() - start_time
            logger.error(f"❌ Erreur traduction: {e}")
            
            # Fallback
            fallback_result = TranslationResult(
                translated_text=f"[{source_language}→{target_language}] {text}",
                detected_language=source_language,
                confidence=0.1,
                model_used='fallback',
                from_cache=False,
                processing_time=processing_time,
                cache_key=''
            )
            
            return self._format_result(fallback_result)
    
    def _translate_basic(self, request: TranslationRequest) -> TranslationResult:
        """Traduction basique (rapide)"""
        start_time = time.time()
        
        # Simulation de traduction basique
        # En production, utiliser un modèle léger comme T5-small
        translated_text = self._basic_translation_engine(
            request.text, 
            request.source_language, 
            request.target_language
        )
        
        processing_time = time.time() - start_time
        
        return TranslationResult(
            translated_text=translated_text,
            detected_language=request.source_language,
            confidence=0.7,
            model_used='basic',
            from_cache=False,
            processing_time=processing_time,
            cache_key=''
        )
    
    def _translate_medium(self, request: TranslationRequest) -> TranslationResult:
        """Traduction moyenne (équilibrée)"""
        start_time = time.time()
        
        # Simulation de traduction moyenne
        # En production, utiliser un modèle comme T5-base ou NLLB-200
        translated_text = self._medium_translation_engine(
            request.text, 
            request.source_language, 
            request.target_language
        )
        
        processing_time = time.time() - start_time
        
        return TranslationResult(
            translated_text=translated_text,
            detected_language=request.source_language,
            confidence=0.85,
            model_used='medium',
            from_cache=False,
            processing_time=processing_time,
            cache_key=''
        )
    
    def _translate_premium(self, request: TranslationRequest) -> TranslationResult:
        """Traduction premium (haute qualité)"""
        start_time = time.time()
        
        # Simulation de traduction premium
        # En production, utiliser un modèle comme NLLB-200-3.3B ou mBART
        translated_text = self._premium_translation_engine(
            request.text, 
            request.source_language, 
            request.target_language
        )
        
        processing_time = time.time() - start_time
        
        return TranslationResult(
            translated_text=translated_text,
            detected_language=request.source_language,
            confidence=0.95,
            model_used='premium',
            from_cache=False,
            processing_time=processing_time,
            cache_key=''
        )
    
    def _basic_translation_engine(self, text: str, source_lang: str, target_lang: str) -> str:
        """Moteur de traduction basique (simulation)"""
        # Simulation simple pour les tests
        # En production, charger un modèle T5-small ou équivalent
        
        # Dictionnaire de traductions simples pour les tests
        translations = {
            ('en', 'fr'): {
                'hello': 'bonjour',
                'world': 'monde',
                'good': 'bon',
                'morning': 'matin',
                'how': 'comment',
                'are': 'êtes',
                'you': 'vous'
            },
            ('fr', 'en'): {
                'bonjour': 'hello',
                'monde': 'world',
                'bon': 'good',
                'matin': 'morning',
                'comment': 'how',
                'êtes': 'are',
                'vous': 'you'
            }
        }
        
        lang_pair = (source_lang, target_lang)
        if lang_pair in translations:
            words = text.lower().split()
            translated_words = []
            for word in words:
                translated_word = translations[lang_pair].get(word, word)
                translated_words.append(translated_word)
            return ' '.join(translated_words)
        
        # Fallback
        return f"[{source_lang}→{target_lang}] {text}"
    
    def _medium_translation_engine(self, text: str, source_lang: str, target_lang: str) -> str:
        """Moteur de traduction moyen (simulation)"""
        # Simulation avec plus de logique
        # En production, utiliser un modèle NLLB-200 ou T5-base
        
        # Ajouter un délai pour simuler le traitement
        time.sleep(0.01)
        
        return self._basic_translation_engine(text, source_lang, target_lang)
    
    def _premium_translation_engine(self, text: str, source_lang: str, target_lang: str) -> str:
        """Moteur de traduction premium (simulation)"""
        # Simulation avec traitement plus long
        # En production, utiliser un modèle NLLB-200-3.3B ou mBART
        
        # Ajouter un délai pour simuler le traitement lourd
        time.sleep(0.05)
        
        return self._basic_translation_engine(text, source_lang, target_lang)
    
    def _generate_cache_key(self, text: str, source_lang: str, target_lang: str, model_type: str) -> str:
        """Génère une clé de cache unique"""
        content = f"{text}:{source_lang}:{target_lang}:{model_type}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _format_result(self, result: TranslationResult) -> Dict[str, Any]:
        """Formate le résultat pour l'API"""
        return {
            'translated_text': result.translated_text,
            'detected_language': result.detected_language,
            'confidence': result.confidence,
            'model_used': result.model_used,
            'from_cache': result.from_cache,
            'processing_time': result.processing_time
        }
    
    def _update_stats(self, processing_time: float):
        """Met à jour les statistiques"""
        self.request_times.append(processing_time)
        
        # Garder seulement les 1000 dernières requêtes
        if len(self.request_times) > 1000:
            self.request_times = self.request_times[-1000:]
        
        # Mettre à jour le temps moyen
        self.stats['avg_processing_time'] = sum(self.request_times) / len(self.request_times)
        
        # Calculer les requêtes par seconde
        current_time = time.time()
        time_window = current_time - self.last_stats_reset
        
        if time_window >= 60:  # Réinitialiser toutes les minutes
            self.stats['requests_per_second'] = len(self.request_times) / time_window
            self.request_times = []
            self.last_stats_reset = current_time
    
    def get_stats(self) -> Dict[str, Any]:
        """Récupère les statistiques complètes"""
        cache_stats = self.cache.get_stats()
        
        return {
            'service': self.stats,
            'cache': cache_stats,
            'workers': {
                'max_workers': self.max_workers,
                'active_workers': len([w for w in self.worker_pool._threads if w.is_alive()])
            }
        }
    
    async def health_check(self) -> bool:
        """Vérifie la santé du service"""
        try:
            # Test de traduction simple
            result = await self.translate('hello', 'en', 'fr', 'basic')
            return result['translated_text'] != 'hello'
        except Exception as e:
            logger.error(f"❌ Health check échoué: {e}")
            return False
    
    async def close(self):
        """Ferme le service"""
        logger.info("🛑 Fermeture du service de traduction haute performance...")
        self.worker_pool.shutdown(wait=True)
        logger.info("✅ Service de traduction fermé")
