#!/usr/bin/env python3
"""
Service de traduction allégé pour tests rapides - Meeshy
Utilise des modèles plus légers pour l'initialisation rapide
"""
import logging
import time
import asyncio
from typing import Dict, List, Optional, Tuple
from functools import lru_cache
import hashlib

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Modèles ML plus légers
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
    from langdetect import detect
    from langdetect.lang_detect_exception import LangDetectException
    import torch
    logger.info("✅ Dépendances ML importées avec succès")
except ImportError as e:
    logger.error(f"❌ Erreur import ML: {e}")
    raise

# Configuration des modèles légers
LIGHTWEIGHT_MODELS = {
    'basic': {
        'name': 'Helsinki-NLP/opus-mt-en-fr',
        'description': 'Modèle léger EN->FR pour tests',
        'languages': ['en', 'fr']
    }
}

class LightweightLanguageDetector:
    """Détecteur de langue simplifié"""
    
    def __init__(self):
        self.supported_languages = {
            'en': 'english',
            'fr': 'french', 
            'es': 'spanish',
            'de': 'german',
            'it': 'italian',
            'pt': 'portuguese',
            'ru': 'russian',
            'zh': 'chinese',
            'ja': 'japanese',
            'ko': 'korean',
            'ar': 'arabic'
        }
        logger.info(f"✅ Détecteur initialisé pour {len(self.supported_languages)} langues")
    
    def detect_language(self, text: str) -> Tuple[str, float]:
        """Détecte la langue du texte"""
        try:
            # Nettoyage du texte
            clean_text = text.strip()
            if not clean_text:
                return 'unknown', 0.0
            
            # Détection avec langdetect
            detected = detect(clean_text)
            confidence = 0.9  # Confiance fixe pour ce modèle léger
            
            if detected in self.supported_languages:
                logger.info(f"🔍 Langue détectée: {detected} (confiance: {confidence})")
                return detected, confidence
            else:
                logger.warning(f"⚠️ Langue non supportée: {detected}")
                return 'unknown', 0.5
                
        except LangDetectException as e:
            logger.error(f"❌ Erreur détection langue: {e}")
            return 'unknown', 0.0
        except Exception as e:
            logger.error(f"❌ Erreur générale détection: {e}")
            return 'unknown', 0.0

class LightweightTranslationService:
    """Service de traduction allégé pour tests"""
    
    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Device utilisé: {self.device}")
        
        # Cache des traductions
        self.translation_cache: Dict[str, Dict] = {}
        
        # Initialisation des composants
        self.language_detector = LightweightLanguageDetector()
        self.models = {}
        
        # Stats du service
        self.stats = {
            'translations_count': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors_count': 0,
            'start_time': time.time()
        }
        
        logger.info("✅ Service de traduction léger initialisé")
    
    def _get_cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Génère une clé de cache"""
        content = f"{text}|{source_lang}|{target_lang}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _load_model_if_needed(self, model_key: str = 'basic'):
        """Charge un modèle à la demande"""
        if model_key not in self.models:
            try:
                model_config = LIGHTWEIGHT_MODELS[model_key]
                logger.info(f"📦 Chargement modèle léger: {model_config['name']}")
                
                # Utilisation du pipeline pour simplicité
                self.models[model_key] = pipeline(
                    "translation",
                    model=model_config['name'],
                    device=0 if self.device == 'cuda' else -1
                )
                
                logger.info(f"✅ Modèle {model_key} chargé avec succès")
                
            except Exception as e:
                logger.error(f"❌ Erreur chargement modèle {model_key}: {e}")
                raise
    
    async def translate_message(
        self,
        text: str,
        target_language: str,
        source_language: Optional[str] = None,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> Dict:
        """Traduit un message"""
        try:
            # Nettoyage du texte
            clean_text = text.strip()
            if not clean_text:
                return {
                    'success': False,
                    'error': 'Texte vide',
                    'original_text': text,
                    'translated_text': '',
                    'source_language': 'unknown',
                    'target_language': target_language
                }
            
            # Détection de la langue source si non fournie
            if not source_language:
                detected_lang, confidence = self.language_detector.detect_language(clean_text)
                source_language = detected_lang
                logger.info(f"🔍 Langue détectée: {source_language}")
            
            # Vérification si traduction nécessaire
            if source_language == target_language:
                return {
                    'success': True,
                    'original_text': text,
                    'translated_text': text,
                    'source_language': source_language,
                    'target_language': target_language,
                    'model_used': 'none',
                    'confidence_score': 1.0,
                    'from_cache': False,
                    'processing_time': 0.001
                }
            
            # Vérification du cache
            cache_key = self._get_cache_key(clean_text, source_language, target_language)
            if cache_key in self.translation_cache:
                cached_result = self.translation_cache[cache_key].copy()
                cached_result['from_cache'] = True
                self.stats['cache_hits'] += 1
                logger.info("📋 Traduction depuis le cache")
                return cached_result
            
            self.stats['cache_misses'] += 1
            start_time = time.time()
            
            # Chargement du modèle
            self._load_model_if_needed('basic')
            translator = self.models['basic']
            
            # Traduction simplifiée (EN->FR seulement pour ce modèle léger)
            if source_language == 'en' and target_language == 'fr':
                result = translator(clean_text)
                if result and len(result) > 0:
                    translated_text = result[0]['translation_text']
                else:
                    translated_text = clean_text
            else:
                # Fallback pour autres langues
                logger.warning(f"⚠️ Combinaison non supportée: {source_language}->{target_language}")
                translated_text = f"[TRADUCTION NON DISPONIBLE] {clean_text}"
            
            processing_time = time.time() - start_time
            
            # Résultat final
            translation_result = {
                'success': True,
                'original_text': text,
                'translated_text': translated_text,
                'source_language': source_language,
                'target_language': target_language,
                'model_used': 'Helsinki-NLP/opus-mt-en-fr',
                'confidence_score': 0.85,
                'from_cache': False,
                'processing_time': processing_time
            }
            
            # Cache de la traduction
            self.translation_cache[cache_key] = translation_result.copy()
            
            # Update stats
            self.stats['translations_count'] += 1
            
            logger.info(f"✅ Traduction réussie: {source_language}->{target_language} en {processing_time:.3f}s")
            return translation_result
            
        except Exception as e:
            self.stats['errors_count'] += 1
            logger.error(f"❌ Erreur traduction: {e}")
            
            return {
                'success': False,
                'error': str(e),
                'original_text': text,
                'translated_text': '',
                'source_language': source_language or 'unknown',
                'target_language': target_language,
                'processing_time': 0.0
            }
    
    async def translate_multiple(self, requests: List[Dict]) -> List[Dict]:
        """Traduit plusieurs messages"""
        results = []
        for req in requests:
            result = await self.translate_message(
                text=req.get('text', ''),
                target_language=req.get('target_language', 'en'),
                source_language=req.get('source_language'),
                user_id=req.get('user_id'),
                conversation_id=req.get('conversation_id')
            )
            results.append(result)
        return results
    
    def get_service_stats(self) -> Dict:
        """Retourne les statistiques du service"""
        uptime = time.time() - self.stats['start_time']
        
        return {
            'service_name': 'Meeshy Lightweight Translation Service',
            'uptime_seconds': uptime,
            'translations_count': self.stats['translations_count'],
            'cache_hits': self.stats['cache_hits'],
            'cache_misses': self.stats['cache_misses'],
            'cache_hit_rate': (
                self.stats['cache_hits'] / max(1, self.stats['cache_hits'] + self.stats['cache_misses'])
            ),
            'errors_count': self.stats['errors_count'],
            'models_loaded': list(self.models.keys()),
            'supported_languages': list(self.language_detector.supported_languages.keys()),
            'device': self.device,
            'cache_size': len(self.translation_cache)
        }

# Test du service
if __name__ == "__main__":
    async def test_service():
        service = LightweightTranslationService()
        
        # Test de traduction
        result = await service.translate_message(
            text="Hello, how are you?",
            target_language="fr"
        )
        
        print("Résultat de traduction:")
        print(f"- Original: {result['original_text']}")
        print(f"- Traduit: {result['translated_text']}")
        print(f"- Langue source: {result['source_language']}")
        print(f"- Langue cible: {result['target_language']}")
        print(f"- Succès: {result['success']}")
        print(f"- Temps: {result['processing_time']:.3f}s")
        
        # Stats du service
        stats = service.get_service_stats()
        print("\nStatistiques du service:")
        for key, value in stats.items():
            print(f"- {key}: {value}")
    
    asyncio.run(test_service())
