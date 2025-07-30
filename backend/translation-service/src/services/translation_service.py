"""
Service de traduction avec modèles MT5/NLLB
Gère le chargement des modèles et la traduction multi-langues
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import threading

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

from config.settings import get_settings, get_model_language_code, get_iso_language_code
from services.cache_service import CacheService

logger = logging.getLogger(__name__)

class TranslationService:
    """Service de traduction avec modèles MT5/NLLB"""
    
    def __init__(self, cache_service: CacheService):
        self.settings = get_settings()
        self.cache_service = cache_service
        
        # État des modèles
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        self.pipelines: Dict[str, Any] = {}
        self.is_initialized = False
        
        # Statistiques
        self.stats = {
            'translations_count': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0,
            'models_loaded': 0,
            'average_inference_time': 0.0
        }
        
        # Thread safety pour les modèles
        self._model_lock = threading.Lock()
        
    async def initialize(self):
        """Initialise les modèles de traduction"""
        if not TRANSFORMERS_AVAILABLE:
            logger.error("❌ Transformers non disponible. Installez avec: pip install transformers torch")
            raise ImportError("Transformers library not available")
        
        try:
            logger.info("🔄 Initialisation des modèles de traduction...")
            
            # Vérifier la disponibilité de CUDA
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"🖥️ Utilisation du device: {device}")
            
            # Charger les modèles selon la configuration
            await self._load_models(device)
            
            self.is_initialized = True
            logger.info("✅ Service de traduction initialisé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            raise
    
    async def _load_models(self, device: str):
        """Charge les modèles de traduction"""
        models_path = Path(self.settings.models_path)
        
        # Modèles à charger
        models_to_load = [
            ('basic', self.settings.basic_model),
            ('medium', self.settings.medium_model),
        ]
        
        # Charger uniquement le modèle premium si assez de mémoire
        if device == "cuda" and torch.cuda.get_device_properties(0).total_memory > 8e9:  # 8GB
            models_to_load.append(('premium', self.settings.premium_model))
        
        for tier, model_name in models_to_load:
            try:
                await self._load_single_model(tier, model_name, models_path, device)
            except Exception as e:
                logger.warning(f"⚠️ Impossible de charger le modèle {tier}: {e}")
                
        if not self.models:
            logger.error("❌ Aucun modèle chargé")
            raise RuntimeError("No translation models loaded")
    
    async def _load_single_model(self, tier: str, model_name: str, models_path: Path, device: str):
        """Charge un modèle spécifique"""
        model_path = models_path / model_name
        
        if not model_path.exists():
            logger.warning(f"⚠️ Modèle {model_name} non trouvé dans {model_path}")
            return
        
        logger.info(f"📥 Chargement du modèle {tier}: {model_name}")
        start_time = time.time()
        
        try:
            # Charger le tokenizer
            tokenizer = AutoTokenizer.from_pretrained(str(model_path))
            
            # Charger le modèle
            model = AutoModelForSeq2SeqLM.from_pretrained(
                str(model_path),
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None
            )
            
            if device == "cpu":
                model = model.to(device)
            
            # Créer le pipeline
            translator = pipeline(
                "translation",
                model=model,
                tokenizer=tokenizer,
                device=0 if device == "cuda" else -1,
                max_length=512,
                do_sample=True,
                temperature=0.7
            )
            
            # Stocker les composants
            with self._model_lock:
                self.models[tier] = model
                self.tokenizers[tier] = tokenizer
                self.pipelines[tier] = translator
                self.stats['models_loaded'] += 1
            
            load_time = time.time() - start_time
            logger.info(f"✅ Modèle {tier} chargé en {load_time:.1f}s")
            
        except Exception as e:
            logger.error(f"❌ Erreur chargement modèle {tier}: {e}")
            raise
    
    async def translate_text(
        self, 
        text: str, 
        source_lang: str, 
        target_lang: str, 
        model_tier: str = "basic"
    ) -> Dict[str, Any]:
        """Traduit un texte avec le modèle spécifié"""
        
        if not self.is_initialized:
            return {
                'success': False,
                'error': 'Service not initialized',
                'translated_text': '',
                'metadata': {}
            }
        
        # Validation des paramètres
        if not text.strip():
            return {
                'success': False,
                'error': 'Empty text',
                'translated_text': '',
                'metadata': {}
            }
        
        if len(text) > self.settings.max_text_length:
            return {
                'success': False,
                'error': f'Text too long (max {self.settings.max_text_length} chars)',
                'translated_text': '',
                'metadata': {}
            }
        
        # Vérifier si les langues sont supportées
        if source_lang not in self.settings.supported_languages_list:
            return {
                'success': False,
                'error': f'Source language {source_lang} not supported',
                'translated_text': '',
                'metadata': {}
            }
        
        if target_lang not in self.settings.supported_languages_list:
            return {
                'success': False,
                'error': f'Target language {target_lang} not supported',
                'translated_text': '',
                'metadata': {}
            }
        
        # Si même langue, retourner le texte original
        if source_lang == target_lang:
            return {
                'success': True,
                'translated_text': text,
                'metadata': {
                    'model_used': 'passthrough',
                    'confidence': 1.0,
                    'from_cache': False,
                    'processing_time': 0.001
                }
            }
        
        # Vérifier le cache
        cache_key = self.cache_service.generate_cache_key(text, source_lang, target_lang, model_tier)
        cached_result = await self.cache_service.get_translation(cache_key)
        
        if cached_result:
            self.stats['cache_hits'] += 1
            logger.info(f"📦 Cache hit: {text[:30]}... ({source_lang}→{target_lang})")
            return {
                'success': True,
                'translated_text': cached_result['translated_text'],
                'metadata': {
                    'model_used': cached_result.get('model_used', model_tier),
                    'confidence': cached_result.get('confidence', 0.95),
                    'from_cache': True,
                    'processing_time': 0.001
                }
            }
        
        # Choisir le meilleur modèle disponible
        available_tier = self._get_best_available_model(model_tier)
        if not available_tier:
            return {
                'success': False,
                'error': 'No translation model available',
                'translated_text': '',
                'metadata': {}
            }
        
        # Effectuer la traduction
        try:
            start_time = time.time()
            
            # Obtenir le pipeline approprié
            with self._model_lock:
                pipeline = self.pipelines.get(available_tier)
            
            if not pipeline:
                return {
                    'success': False,
                    'error': f'Model {available_tier} not loaded',
                    'translated_text': '',
                    'metadata': {}
                }
            
            # Préparer le texte pour la traduction
            model_source_lang = get_model_language_code(source_lang)
            model_target_lang = get_model_language_code(target_lang)
            
            # Effectuer la traduction (dans un thread pour ne pas bloquer)
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._translate_with_pipeline,
                pipeline,
                text,
                model_source_lang,
                model_target_lang
            )
            
            processing_time = time.time() - start_time
            
            if not result:
                self.stats['errors'] += 1
                return {
                    'success': False,
                    'error': 'Translation failed',
                    'translated_text': '',
                    'metadata': {}
                }
            
            translated_text = result['translation_text']
            confidence = result.get('confidence', 0.85)
            
            # Mettre en cache le résultat
            cache_data = {
                'translated_text': translated_text,
                'model_used': available_tier,
                'confidence': confidence,
                'processing_time': processing_time
            }
            await self.cache_service.set_translation(cache_key, cache_data)
            
            # Mise à jour des statistiques
            self.stats['translations_count'] += 1
            self.stats['cache_misses'] += 1
            self.stats['average_inference_time'] = (
                (self.stats['average_inference_time'] * (self.stats['translations_count'] - 1) + processing_time) 
                / self.stats['translations_count']
            )
            
            logger.info(
                f"✅ Traduction ({processing_time:.2f}s): '{text[:30]}...' "
                f"({source_lang}→{target_lang}) = '{translated_text[:30]}...'"
            )
            
            return {
                'success': True,
                'translated_text': translated_text,
                'metadata': {
                    'model_used': available_tier,
                    'confidence': confidence,
                    'from_cache': False,
                    'processing_time': processing_time,
                    'source_language': source_lang,
                    'target_language': target_lang
                }
            }
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"❌ Erreur de traduction: {e}")
            return {
                'success': False,
                'error': str(e),
                'translated_text': '',
                'metadata': {}
            }
    
    def _translate_with_pipeline(self, pipeline, text: str, source_lang: str, target_lang: str) -> Optional[Dict[str, Any]]:
        """Effectue la traduction avec le pipeline (fonction synchrone pour l'exécuteur)"""
        try:
            # Format pour les modèles NLLB
            if hasattr(pipeline.model.config, 'forced_bos_token_id'):
                # NLLB model
                result = pipeline(
                    text,
                    src_lang=source_lang,
                    tgt_lang=target_lang,
                    max_length=512
                )
            else:
                # MT5 model - format différent
                formatted_text = f"translate {source_lang} to {target_lang}: {text}"
                result = pipeline(formatted_text, max_length=512)
            
            if result and len(result) > 0:
                return {
                    'translation_text': result[0]['translation_text'],
                    'confidence': result[0].get('score', 0.85)
                }
            return None
            
        except Exception as e:
            logger.error(f"❌ Erreur pipeline: {e}")
            return None
    
    def _get_best_available_model(self, requested_tier: str) -> Optional[str]:
        """Retourne le meilleur modèle disponible"""
        # Ordre de préférence
        tier_priority = ['premium', 'medium', 'basic']
        
        # Si le tier demandé est disponible, l'utiliser
        if requested_tier in self.pipelines:
            return requested_tier
        
        # Sinon, prendre le meilleur disponible
        for tier in tier_priority:
            if tier in self.pipelines:
                return tier
        
        return None
    
    async def translate_to_multiple_languages(
        self, 
        text: str, 
        source_lang: str, 
        target_languages: List[str], 
        model_tier: str = "basic"
    ) -> Dict[str, Any]:
        """Traduit un texte vers plusieurs langues simultanément"""
        
        results = {}
        errors = []
        
        # Traductions en parallèle
        tasks = []
        for target_lang in target_languages:
            if target_lang != source_lang:  # Éviter de traduire vers la même langue
                task = self.translate_text(text, source_lang, target_lang, model_tier)
                tasks.append((target_lang, task))
        
        # Exécuter toutes les traductions
        for target_lang, task in tasks:
            try:
                result = await task
                if result['success']:
                    results[target_lang] = {
                        'translated_text': result['translated_text'],
                        'metadata': result['metadata']
                    }
                else:
                    errors.append(f"{target_lang}: {result['error']}")
            except Exception as e:
                errors.append(f"{target_lang}: {str(e)}")
        
        return {
            'success': len(results) > 0,
            'results': results,
            'errors': errors,
            'total_languages': len(target_languages),
            'successful_translations': len(results)
        }
    
    async def detect_language(self, text: str) -> Dict[str, Any]:
        """Détecte la langue d'un texte (implémentation basique)"""
        # Pour l'instant, détection basique basée sur des patterns
        # TODO: Intégrer un modèle de détection de langue plus sophistiqué
        
        text_lower = text.lower().strip()
        
        # Patterns de mots courants par langue
        language_patterns = {
            'fr': ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une', 'être', 'avoir', 'bonjour', 'merci'],
            'en': ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'hello', 'thank'],
            'es': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'hola', 'gracias'],
            'de': ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'ist', 'hallo'],
            'pt': ['o', 'a', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'olá'],
        }
        
        scores = {}
        words = text_lower.split()
        
        for lang, patterns in language_patterns.items():
            matches = sum(1 for word in words if word in patterns)
            if matches > 0:
                scores[lang] = matches / len(words)
        
        if not scores:
            return {
                'detected_language': self.settings.default_language,
                'confidence': 0.5,
                'alternatives': []
            }
        
        # Langue avec le meilleur score
        best_lang = max(scores, key=scores.get)
        confidence = min(scores[best_lang] * 1.5, 1.0)
        
        # Alternatives
        alternatives = [
            {'language': lang, 'confidence': score}
            for lang, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)[1:3]
        ]
        
        return {
            'detected_language': best_lang,
            'confidence': confidence,
            'alternatives': alternatives
        }
    
    async def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du service"""
        cache_stats = await self.cache_service.get_cache_stats()
        
        return {
            'service_status': 'initialized' if self.is_initialized else 'not_initialized',
            'models_loaded': list(self.pipelines.keys()),
            'translations_performed': self.stats['translations_count'],
            'cache_hit_rate': (
                self.stats['cache_hits'] / max(self.stats['cache_hits'] + self.stats['cache_misses'], 1)
            ),
            'average_inference_time': self.stats['average_inference_time'],
            'error_count': self.stats['errors'],
            'cache_stats': cache_stats,
            'supported_languages': self.settings.supported_languages_list
        }
    
    async def cleanup(self):
        """Nettoie les ressources lors de l'arrêt"""
        logger.info("🧹 Nettoyage du service de traduction...")
        
        try:
            # Libérer la mémoire des modèles
            with self._model_lock:
                for tier in list(self.models.keys()):
                    del self.models[tier]
                    del self.tokenizers[tier]
                    del self.pipelines[tier]
                
                self.models.clear()
                self.tokenizers.clear()
                self.pipelines.clear()
            
            # Libérer la mémoire GPU si utilisée
            if TRANSFORMERS_AVAILABLE and torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            logger.info("✅ Nettoyage terminé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du nettoyage: {e}")
