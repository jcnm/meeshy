#!/usr/bin/env python3
"""
Service de traduction Meeshy - Version ZeroMQ optimisée
Architecture distribuée haute performance avec compression Protobuf
"""

import zmq
import asyncio
import json
import time
import logging
import hashlib
import pickle
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading

# Import des messages protobuf générés
import translation_pb2

# Imports pour ML et traduction
try:
    import torch
    from transformers import (
        MarianTokenizer, MarianMTModel, 
        M2M100ForConditionalGeneration, M2M100Tokenizer,
        pipeline
    )
    from langdetect import detect, LangDetectError
    import textstat
    ML_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  ML libraries not available: {e}")
    ML_AVAILABLE = False

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("TranslationService")

# Configuration ZeroMQ
TRANSLATION_SERVICE_PORT = 5555  # Port d'écoute pour requêtes de traduction
GATEWAY_RESPONSE_PORT = 5556     # Port d'envoi vers Gateway
METRICS_PORT = 5557              # Port pour métriques (REST API séparée)

@dataclass
class ModelConfig:
    """Configuration des modèles de traduction"""
    name: str
    tier: str  # "basic", "medium", "premium"
    max_chars: int
    memory_mb: int
    languages: List[str]

class TranslationCache:
    """Cache intelligent pour traductions avec TTL et compression"""
    
    def __init__(self, max_size: int = 10000, default_ttl: int = 3600):
        self._cache: Dict[str, dict] = {}
        self._access_times: Dict[str, float] = {}
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = threading.RLock()
        
    def _generate_cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Génère une clé de cache optimisée"""
        content = f"{text}:{source_lang}:{target_lang}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def get(self, text: str, source_lang: str, target_lang: str) -> Optional[dict]:
        """Récupère une traduction du cache"""
        key = self._generate_cache_key(text, source_lang, target_lang)
        
        with self._lock:
            if key not in self._cache:
                return None
                
            entry = self._cache[key]
            now = time.time()
            
            # Vérifier TTL
            if now - entry['timestamp'] > entry['ttl']:
                del self._cache[key]
                del self._access_times[key]
                return None
            
            # Mettre à jour l'accès
            self._access_times[key] = now
            entry['access_count'] += 1
            
            return {
                'translated_text': entry['translated_text'],
                'confidence_score': entry['confidence_score'],
                'model_used': entry['model_used'],
                'ttl_remaining': int(entry['ttl'] - (now - entry['timestamp']))
            }
    
    def set(self, text: str, source_lang: str, target_lang: str, 
            translated_text: str, confidence_score: float, model_used: str):
        """Stocke une traduction dans le cache"""
        key = self._generate_cache_key(text, source_lang, target_lang)
        now = time.time()
        
        with self._lock:
            # Nettoyer le cache si nécessaire
            if len(self._cache) >= self._max_size:
                self._cleanup_lru()
            
            self._cache[key] = {
                'translated_text': translated_text,
                'confidence_score': confidence_score,
                'model_used': model_used,
                'timestamp': now,
                'ttl': self._default_ttl,
                'access_count': 1
            }
            self._access_times[key] = now
    
    def _cleanup_lru(self):
        """Nettoie les entrées les moins récemment utilisées"""
        if not self._access_times:
            return
            
        # Supprimer 20% des entrées les plus anciennes
        to_remove = max(1, len(self._cache) // 5)
        sorted_keys = sorted(self._access_times.items(), key=lambda x: x[1])
        
        for key, _ in sorted_keys[:to_remove]:
            if key in self._cache:
                del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]
    
    def get_stats(self) -> dict:
        """Statistiques du cache"""
        with self._lock:
            total_entries = len(self._cache)
            total_accesses = sum(entry['access_count'] for entry in self._cache.values())
            
            return {
                'total_entries': total_entries,
                'max_size': self._max_size,
                'total_accesses': total_accesses,
                'hit_rate': 0.0 if total_accesses == 0 else (total_accesses / (total_accesses + 1)),
                'memory_usage_estimate': total_entries * 512  # Estimation en bytes
            }

class ModelManager:
    """Gestionnaire des modèles ML avec chargement lazy et optimisations"""
    
    def __init__(self):
        self.models = {}
        self.tokenizers = {}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Configuration des modèles selon les instructions Copilot
        self.model_configs = {
            'basic': ModelConfig(
                name='Helsinki-NLP/opus-mt-{}-{}',
                tier='basic',
                max_chars=50,
                memory_mb=200,
                languages=['fr', 'en', 'es', 'de', 'it', 'pt']
            ),
            'medium': ModelConfig(
                name='facebook/m2m100_418M',
                tier='medium',
                max_chars=200,
                memory_mb=800,
                languages=['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ar']
            ),
            'premium': ModelConfig(
                name='facebook/m2m100_1.2B',
                tier='premium',
                max_chars=1000,
                memory_mb=2000,
                languages=['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ar', 'hi', 'ko']
            )
        }
        
        logger.info(f"ModelManager initialized on device: {self.device}")
    
    def select_model_tier(self, text: str) -> str:
        """Sélectionne le tier de modèle optimal selon la complexité"""
        char_count = len(text)
        
        # Analyse de complexité simple mais efficace
        if char_count <= 20:
            return 'basic'
        elif char_count <= 100:
            return 'medium'
        else:
            return 'premium'
    
    def load_model(self, tier: str, source_lang: str, target_lang: str) -> Tuple[object, object]:
        """Charge un modèle de façon lazy"""
        model_key = f"{tier}_{source_lang}_{target_lang}"
        
        if model_key in self.models:
            return self.models[model_key], self.tokenizers[model_key]
        
        config = self.model_configs[tier]
        
        try:
            if tier == 'basic':
                # Modèles Helsinki-NLP
                model_name = f"Helsinki-NLP/opus-mt-{source_lang}-{target_lang}"
                tokenizer = MarianTokenizer.from_pretrained(model_name)
                model = MarianMTModel.from_pretrained(model_name).to(self.device)
            
            elif tier in ['medium', 'premium']:
                # Modèles M2M100
                model_name = config.name
                tokenizer = M2M100Tokenizer.from_pretrained(model_name)
                model = M2M100ForConditionalGeneration.from_pretrained(model_name).to(self.device)
                
                # Configuration spécifique M2M100
                tokenizer.src_lang = source_lang
                tokenizer.tgt_lang = target_lang
            
            self.models[model_key] = model
            self.tokenizers[model_key] = tokenizer
            
            logger.info(f"Loaded model: {model_name} for {source_lang}→{target_lang}")
            return model, tokenizer
            
        except Exception as e:
            logger.error(f"Failed to load model {tier} for {source_lang}→{target_lang}: {e}")
            raise
    
    def get_model_stats(self) -> dict:
        """Statistiques des modèles chargés"""
        stats = {
            'loaded_models': len(self.models),
            'device': str(self.device),
            'models_by_tier': {},
            'memory_usage_estimate': 0
        }
        
        for model_key in self.models:
            tier = model_key.split('_')[0]
            if tier not in stats['models_by_tier']:
                stats['models_by_tier'][tier] = 0
            stats['models_by_tier'][tier] += 1
            
            # Estimation mémoire
            config = self.model_configs.get(tier, self.model_configs['basic'])
            stats['memory_usage_estimate'] += config.memory_mb
        
        return stats

class ZeroMQTranslationService:
    """Service de traduction ZeroMQ haute performance"""
    
    def __init__(self):
        self.context = zmq.Context()
        self.cache = TranslationCache()
        self.model_manager = ModelManager() if ML_AVAILABLE else None
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Statistiques de performance
        self.stats = {
            'translations_total': 0,
            'translations_cached': 0,
            'translations_failed': 0,
            'average_processing_time': 0.0,
            'start_time': time.time()
        }
        
        # Sockets ZeroMQ
        self.request_socket = None
        self.response_socket = None
        
        logger.info("ZeroMQ Translation Service initialized")
    
    def setup_sockets(self):
        """Configure les sockets ZeroMQ"""
        # Socket pour recevoir les requêtes de traduction du Gateway
        self.request_socket = self.context.socket(zmq.PULL)
        self.request_socket.bind(f"tcp://*:{TRANSLATION_SERVICE_PORT}")
        
        # Socket pour envoyer les réponses au Gateway  
        self.response_socket = self.context.socket(zmq.PUSH)
        self.response_socket.connect(f"tcp://localhost:{GATEWAY_RESPONSE_PORT}")
        
        logger.info(f"ZeroMQ sockets configured: listening on {TRANSLATION_SERVICE_PORT}, responding to {GATEWAY_RESPONSE_PORT}")
    
    def detect_language(self, text: str) -> Tuple[str, float]:
        """Détection rapide de langue"""
        try:
            if not text.strip():
                return 'fr', 0.5  # Défaut français
            
            detected = detect(text)
            # Score de confiance simulé (langdetect ne fournit pas de score)
            confidence = 0.9 if len(text) > 20 else 0.7
            
            return detected, confidence
            
        except (LangDetectError, Exception):
            # Fallback: analyse des mots courants
            text_lower = text.lower()
            
            fr_words = ['le', 'la', 'les', 'un', 'une', 'et', 'ou', 'dans', 'pour', 'avec']
            en_words = ['the', 'and', 'or', 'in', 'for', 'with', 'this', 'that', 'have']
            es_words = ['el', 'la', 'los', 'las', 'y', 'o', 'en', 'para', 'con', 'es']
            
            fr_count = sum(1 for word in fr_words if word in text_lower)
            en_count = sum(1 for word in en_words if word in text_lower)
            es_count = sum(1 for word in es_words if word in text_lower)
            
            if fr_count > max(en_count, es_count):
                return 'fr', 0.6
            elif en_count > es_count:
                return 'en', 0.6
            elif es_count > 0:
                return 'es', 0.6
            
            return 'fr', 0.5  # Défaut français
    
    def translate_text(self, text: str, source_lang: str, target_lang: str, 
                      model_tier: Optional[str] = None) -> dict:
        """Traduction avec cache et sélection automatique de modèle"""
        start_time = time.time()
        
        # Vérifier le cache
        cached_result = self.cache.get(text, source_lang, target_lang)
        if cached_result:
            self.stats['translations_cached'] += 1
            cached_result['from_cache'] = True
            return cached_result
        
        if not self.model_manager:
            # Mode fallback sans ML
            return {
                'translated_text': f"[FALLBACK] {text}",
                'confidence_score': 0.5,
                'model_used': 'fallback',
                'from_cache': False
            }
        
        try:
            # Sélection automatique du modèle si non spécifié
            if not model_tier:
                model_tier = self.model_manager.select_model_tier(text)
            
            # Charger le modèle
            model, tokenizer = self.model_manager.load_model(model_tier, source_lang, target_lang)
            
            # Traduction
            if model_tier == 'basic':
                # Modèles Helsinki-NLP
                inputs = tokenizer.encode(text, return_tensors="pt", padding=True, truncation=True)
                inputs = inputs.to(self.model_manager.device)
                
                with torch.no_grad():
                    outputs = model.generate(inputs, max_length=512, num_beams=4, early_stopping=True)
                
                translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            else:
                # Modèles M2M100
                inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
                inputs = {k: v.to(self.model_manager.device) for k, v in inputs.items()}
                
                with torch.no_grad():
                    outputs = model.generate(**inputs, forced_bos_token_id=tokenizer.get_lang_id(target_lang))
                
                translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Score de confiance simulé basé sur la longueur et le modèle
            confidence_score = min(0.95, 0.7 + (len(text) / 200) * 0.2)
            if model_tier == 'premium':
                confidence_score += 0.05
            
            result = {
                'translated_text': translated_text,
                'confidence_score': confidence_score,
                'model_used': model_tier,
                'from_cache': False
            }
            
            # Mise en cache
            self.cache.set(text, source_lang, target_lang, 
                          translated_text, confidence_score, model_tier)
            
            processing_time = (time.time() - start_time) * 1000
            self.stats['translations_total'] += 1
            self.stats['average_processing_time'] = (
                (self.stats['average_processing_time'] * (self.stats['translations_total'] - 1) + processing_time) /
                self.stats['translations_total']
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            self.stats['translations_failed'] += 1
            
            return {
                'translated_text': text,  # Retourner le texte original
                'confidence_score': 0.0,
                'model_used': 'error',
                'from_cache': False
            }
    
    def process_translate_request(self, request: translation_pb2.TranslateRequest) -> translation_pb2.TranslateResponse:
        """Traite une requête de traduction simple"""
        
        # Détection de langue si nécessaire
        if not request.source_language:
            detected_lang, confidence = self.detect_language(request.text)
            source_language = detected_lang
        else:
            source_language = request.source_language
        
        # Traduction
        result = self.translate_text(
            request.text, 
            source_language, 
            request.target_language,
            request.model_tier if request.model_tier else None
        )
        
        # Construction de la réponse
        metadata = translation_pb2.BasicMetadata(
            confidence_score=result['confidence_score'],
            from_cache=result['from_cache'],
            model_used=result['model_used']
        )
        
        response = translation_pb2.TranslateResponse(
            message_id=request.message_id,
            translated_text=result['translated_text'],
            detected_source_language=source_language,
            metadata=metadata,
            status=translation_pb2.SUCCESS
        )
        
        return response
    
    def process_batch_request(self, request: translation_pb2.TranslateBatchRequest) -> translation_pb2.TranslateBatchResponse:
        """Traite une requête de traduction batch"""
        
        # Détection de langue
        if not request.source_language:
            detected_lang, _ = self.detect_language(request.text)
            source_language = detected_lang
        else:
            source_language = request.source_language
        
        translations = []
        
        # Traduction vers chaque langue cible
        for target_lang in request.target_languages:
            result = self.translate_text(request.text, source_language, target_lang)
            
            batch_translation = translation_pb2.BatchTranslation(
                target_language=target_lang,
                translated_text=result['translated_text'],
                confidence_score=result['confidence_score'],
                from_cache=result['from_cache']
            )
            translations.append(batch_translation)
        
        response = translation_pb2.TranslateBatchResponse(
            message_id=request.message_id,
            detected_source_language=source_language,
            translations=translations,
            status=translation_pb2.SUCCESS
        )
        
        return response
    
    async def run(self):
        """Boucle principale du service ZeroMQ"""
        self.setup_sockets()
        
        logger.info("🚀 ZeroMQ Translation Service started")
        logger.info(f"📡 Listening on port {TRANSLATION_SERVICE_PORT}")
        logger.info(f"🔄 Responding to Gateway on port {GATEWAY_RESPONSE_PORT}")
        
        while True:
            try:
                # Recevoir une requête (non-bloquant avec timeout)
                if self.request_socket.poll(timeout=100):  # 100ms timeout
                    message_bytes = self.request_socket.recv()
                    
                    # Décompresser et désérialiser
                    try:
                        # Essayer de décoder comme TranslateRequest
                        try:
                            request = translation_pb2.TranslateRequest()
                            request.ParseFromString(message_bytes)
                            response = self.process_translate_request(request)
                            
                        except Exception:
                            # Essayer comme TranslateBatchRequest
                            request = translation_pb2.TranslateBatchRequest()
                            request.ParseFromString(message_bytes)
                            response = self.process_batch_request(request)
                        
                        # Sérialiser et envoyer la réponse
                        response_bytes = response.SerializeToString()
                        self.response_socket.send(response_bytes)
                        
                    except Exception as e:
                        logger.error(f"Message processing error: {e}")
                
                # Petit délai pour éviter la surcharge CPU
                await asyncio.sleep(0.001)
                
            except KeyboardInterrupt:
                logger.info("Shutting down ZeroMQ Translation Service...")
                break
            except Exception as e:
                logger.error(f"Service error: {e}")
                await asyncio.sleep(1)
        
        # Nettoyage
        self.request_socket.close()
        self.response_socket.close()
        self.context.term()
        self.executor.shutdown(wait=True)

def main():
    """Point d'entrée principal"""
    service = ZeroMQTranslationService()
    
    try:
        asyncio.run(service.run())
    except KeyboardInterrupt:
        logger.info("Service terminated by user")
    except Exception as e:
        logger.error(f"Service crashed: {e}")

if __name__ == "__main__":
    main()
