"""
Service de traduction avec modèles MT5/NLLB
Gère le chargement des modèles et la traduction multi-langues
"""

import asyncio
import logging
import time
import shutil
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import threading

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    torch = None

try:
    from langdetect import detect, detect_langs
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False

from config.settings import get_settings, get_model_language_code, get_iso_language_code
from services.cache_service import CacheService

logger = logging.getLogger(__name__)

class TranslationService:
    """Service de traduction avec modèles MT5/NLLB"""
    
    def __init__(self, cache_service: Optional[CacheService] = None):
        self.settings = get_settings()
        
        # Créer le cache service si non fourni
        if cache_service is None:
            self.cache_service = CacheService()
        else:
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
            logger.warning("⚠️ Transformers non disponible. Service fonctionnera en mode détection de langue seulement")
            logger.warning("💡 Pour la traduction complète, installez: pip install transformers torch")
            self.is_initialized = True
            return {
                "status": "initialized", 
                "mode": "language_detection_only",
                "transformers_available": False,
                "models_loaded": 0
            }
        
        try:
            logger.info("🔄 Initialisation des modèles de traduction...")
            
            # Vérifier la disponibilité de CUDA
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"🖥️ Utilisation du device: {device}")
            
            # Charger les modèles selon la configuration
            await self._load_models(device)
            
            self.is_initialized = True
            logger.info("✅ Service de traduction initialisé")
            
            return {
                "status": "initialized", 
                "mode": "full_translation" if self.models else "language_detection_only",
                "transformers_available": True,
                "models_loaded": len(self.models),
                "loaded_models": list(self.models.keys())
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            # Ne pas lever l'exception - le service peut fonctionner en mode dégradé
            self.is_initialized = True
            return {
                "status": "initialized_degraded", 
                "mode": "language_detection_only",
                "transformers_available": True,
                "models_loaded": 0,
                "error": str(e)
            }
    
    async def _load_models(self, device: str):
        """Charge les modèles de traduction"""
        models_path = Path(self.settings.models_path)
        
        # Vérifier l'espace disque disponible
        available_space_gb = self._get_available_space_gb(models_path)
        logger.info(f"💽 Espace disque disponible: {available_space_gb:.1f} GB")
        
        # Estimer l'espace requis par modèle (approximatif)
        model_sizes = {
            'basic': 1.2,    # MT5-small ~1.2GB
            'medium': 2.4,   # NLLB-600M ~2.4GB  
            'premium': 5.2   # NLLB-1.3B ~5.2GB
        }
        
        # Modèles à charger - d'abord essayer en local, puis télécharger depuis HuggingFace
        models_to_load = [
            ('basic', self.settings.basic_model, 'google/mt5-small', model_sizes['basic']),
            ('medium', self.settings.medium_model, 'facebook/nllb-200-distilled-600M', model_sizes['medium']),
        ]
        
        # Charger uniquement le modèle premium si assez de mémoire ET d'espace disque
        if (device == "cuda" and torch.cuda.get_device_properties(0).total_memory > 8e9 and 
            available_space_gb > model_sizes['premium']):
            models_to_load.append(('premium', self.settings.premium_model, 'facebook/nllb-200-1.3B', model_sizes['premium']))
        elif available_space_gb <= model_sizes['premium']:
            logger.warning(f"⚠️ Espace disque insuffisant pour le modèle premium ({model_sizes['premium']} GB requis)")
        
        for tier, local_model_name, hf_model_name, size_gb in models_to_load:
            try:
                # Vérifier l'espace avant téléchargement
                local_model_path = models_path / local_model_name
                if not local_model_path.exists() and available_space_gb < size_gb:
                    logger.warning(f"⚠️ Espace disque insuffisant pour télécharger {tier} ({size_gb} GB requis)")
                    continue
                    
                await self._load_single_model(tier, local_model_name, hf_model_name, models_path, device)
            except Exception as e:
                logger.warning(f"⚠️ Impossible de charger le modèle {tier}: {e}")
                
        if not self.models:
            logger.warning("❌ Aucun modèle ML chargé - service fonctionnera en mode détection de langue seulement")
            # Ne pas lever d'exception - le service peut fonctionner sans modèles ML
            # raise RuntimeError("No translation models loaded")
    
    async def _load_single_model(self, tier: str, local_model_name: str, hf_model_name: str, models_path: Path, device: str):
        """Charge un modèle spécifique - d'abord local, puis HuggingFace"""
        local_model_path = models_path / local_model_name
        
        # Essayer d'abord le modèle local
        model_source = None
        download_and_save = False
        
        if local_model_path.exists():
            model_source = str(local_model_path)
            logger.info(f"📁 Utilisation du modèle local: {local_model_path}")
        else:
            # Télécharger depuis HuggingFace et sauvegarder localement
            model_source = hf_model_name
            download_and_save = True
            logger.info(f"🌐 Téléchargement du modèle HuggingFace: {hf_model_name}")
            logger.info(f"💾 Sauvegarde prévue dans: {local_model_path}")
            
            # Créer le dossier s'il n'existe pas
            local_model_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"📥 Chargement du modèle {tier}: {model_source}")
        start_time = time.time()
        
        try:
            # Charger le tokenizer
            if download_and_save:
                # Télécharger et sauvegarder le tokenizer localement
                tokenizer = AutoTokenizer.from_pretrained(
                    model_source,
                    cache_dir=str(local_model_path)
                )
                # Sauvegarder le tokenizer dans le dossier local
                tokenizer.save_pretrained(str(local_model_path))
                logger.info(f"💾 Tokenizer sauvegardé dans: {local_model_path}")
            else:
                tokenizer = AutoTokenizer.from_pretrained(model_source)
            
            # Charger le modèle
            if download_and_save:
                # Télécharger et sauvegarder le modèle localement
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_source,
                    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                    device_map="auto" if device == "cuda" else None,
                    cache_dir=str(local_model_path)
                )
                # Sauvegarder le modèle dans le dossier local
                model.save_pretrained(str(local_model_path))
                logger.info(f"💾 Modèle sauvegardé dans: {local_model_path}")
            else:
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_source,
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
    
    def _get_available_space_gb(self, path: Path) -> float:
        """Retourne l'espace disque disponible en GB"""
        try:
            # Créer le dossier s'il n'existe pas
            path.mkdir(parents=True, exist_ok=True)
            
            # Obtenir l'espace disque disponible
            statvfs = shutil.disk_usage(str(path))
            available_bytes = statvfs.free
            available_gb = available_bytes / (1024**3)  # Convertir en GB
            return available_gb
        except Exception as e:
            logger.warning(f"⚠️ Impossible de vérifier l'espace disque: {e}")
            return 100.0  # Valeur par défaut optimiste
    
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
        
    async def detect_language(self, text: str) -> Dict[str, Any]:
        """Détecte la langue d'un texte"""
        if not text.strip():
            return {
                'language': self.settings.default_language,
                'confidence': 0.0,
                'alternatives': []
            }
        
        try:
            # Utiliser langdetect si disponible
            try:
                from langdetect import detect_langs
                
                # Détecter les langues possibles
                detected_langs = detect_langs(text)
                
                if not detected_langs:
                    raise Exception("Aucune langue détectée")
                
                # Prendre la langue avec la plus haute probabilité
                best_detection = detected_langs[0]
                best_lang = best_detection.lang
                confidence = best_detection.prob
                
                # Créer les alternatives
                alternatives = [
                    {'language': lang.lang, 'confidence': lang.prob}
                    for lang in detected_langs[1:3]  # Prendre 2 alternatives max
                ]
                
                return {
                    'language': best_lang,
                    'confidence': confidence,
                    'alternatives': alternatives
                }
                
            except ImportError:
                logger.warning("⚠️ langdetect non disponible, utilisation de la méthode simple")
                # Fallback sur la méthode simple
                scores = self._detect_language_simple(text)
                
                if not scores:
                    return {
                        'language': self.settings.default_language,
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
                    'language': best_lang,
                    'confidence': confidence,
                    'alternatives': alternatives
                }
            
        except Exception as e:
            logger.warning(f"⚠️ Erreur détection de langue: {e}")
            # Fallback sur la langue par défaut
            return {
                'language': self.settings.default_language,
                'confidence': 0.5,
                'alternatives': []
            }

    def _detect_language_simple(self, text: str) -> Dict[str, float]:
        """Méthode de détection simple basée sur des mots-clés"""
        # Dictionnaire simple de mots caractéristiques par langue
        language_keywords = {
            'fr': ['le', 'la', 'les', 'de', 'et', 'est', 'une', 'pour', 'que', 'avec'],
            'en': ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'it', 'you', 'that'],
            'es': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se'],
            'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
            'pt': ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para'],
            'zh': ['的', '是', '了', '我', '你', '在', '有', '个', '这', '他'],
            'ja': ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し'],
            'ar': ['في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'التي', 'الذي', 'كان', 'كل']
        }
        
        text_lower = text.lower()
        words = text_lower.split()
        
        scores = {}
        for lang, keywords in language_keywords.items():
            score = sum(1 for word in words if word in keywords)
            if len(words) > 0:
                scores[lang] = score / len(words)
            else:
                scores[lang] = 0
        
        return scores

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
        successful_translations = 0
        
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
                        'success': True,
                        'translated_text': result['translated_text'],
                        'metadata': result['metadata']
                    }
                    successful_translations += 1
                else:
                    results[target_lang] = {
                        'success': False,
                        'error': result['error'],
                        'translated_text': '',
                        'metadata': {}
                    }
                    errors.append(f"{target_lang}: {result['error']}")
                    
            except Exception as e:
                error_msg = str(e)
                results[target_lang] = {
                    'success': False,
                    'error': error_msg,
                    'translated_text': '',
                    'metadata': {}
                }
                errors.append(f"{target_lang}: {error_msg}")
        
        return {
            'success': successful_translations > 0,
            'results': results,
            'successful_translations': successful_translations,
            'failed_translations': len(errors),
            'errors': errors if errors else None
        }
    
    async def clean_huggingface_cache(self) -> Dict[str, Any]:
        """Nettoie le cache HuggingFace pour économiser l'espace disque"""
        import os
        import shutil
        
        try:
            # Localiser le cache HuggingFace
            hf_cache_dir = os.environ.get('HF_HOME', os.path.expanduser('~/.cache/huggingface'))
            
            if not os.path.exists(hf_cache_dir):
                return {
                    'success': True,
                    'message': 'Aucun cache HuggingFace trouvé',
                    'space_freed_mb': 0
                }
            
            # Calculer la taille avant nettoyage
            def get_dir_size(path):
                total_size = 0
                try:
                    for dirpath, dirnames, filenames in os.walk(path):
                        for f in filenames:
                            fp = os.path.join(dirpath, f)
                            if os.path.exists(fp):
                                total_size += os.path.getsize(fp)
                except Exception:
                    pass
                return total_size
            
            size_before = get_dir_size(hf_cache_dir)
            
            # Nettoyer le cache (garder seulement les modèles que nous utilisons)
            models_to_keep = [
                'google--mt5-small',
                'facebook--nllb-200-distilled-600M',
                'facebook--nllb-200-1.3B'
            ]
            
            cleaned_items = []
            hub_cache = os.path.join(hf_cache_dir, 'hub')
            
            if os.path.exists(hub_cache):
                for item in os.listdir(hub_cache):
                    item_path = os.path.join(hub_cache, item)
                    
                    # Garder seulement nos modèles
                    should_keep = any(model_name in item for model_name in models_to_keep)
                    
                    if not should_keep and os.path.isdir(item_path):
                        try:
                            shutil.rmtree(item_path)
                            cleaned_items.append(item)
                        except Exception as e:
                            logger.warning(f"⚠️ Impossible de nettoyer {item}: {e}")
            
            size_after = get_dir_size(hf_cache_dir)
            space_freed = (size_before - size_after) / (1024 * 1024)  # MB
            
            logger.info(f"🧹 Cache HuggingFace nettoyé: {space_freed:.1f} MB libérés")
            
            return {
                'success': True,
                'items_cleaned': cleaned_items,
                'space_freed_mb': round(space_freed, 1),
                'cache_directory': hf_cache_dir
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur nettoyage cache: {e}")
            return {
                'success': False,
                'error': str(e),
                'space_freed_mb': 0
            }

    async def get_models_info(self) -> Dict[str, Any]:
        """Retourne les informations sur les modèles disponibles et leur statut de sauvegarde"""
        models_path = Path(self.settings.models_path)
        
        models_info = {}
        
        # Modèles configurés
        configured_models = [
            ('basic', self.settings.basic_model, 'google/mt5-small'),
            ('medium', self.settings.medium_model, 'facebook/nllb-200-distilled-600M'),
            ('premium', self.settings.premium_model, 'facebook/nllb-200-1.3B'),
        ]
        
        for tier, local_name, hf_name in configured_models:
            local_path = models_path / local_name
            
            model_info = {
                'tier': tier,
                'local_name': local_name,
                'huggingface_name': hf_name,
                'local_path': str(local_path),
                'is_saved_locally': local_path.exists(),
                'is_loaded_in_memory': tier in self.pipelines,
                'size_on_disk_mb': 0
            }
            
            # Calculer la taille sur disque si le modèle existe localement
            if local_path.exists():
                try:
                    total_size = sum(f.stat().st_size for f in local_path.rglob('*') if f.is_file())
                    model_info['size_on_disk_mb'] = round(total_size / (1024**2), 1)
                except Exception as e:
                    logger.warning(f"⚠️ Impossible de calculer la taille de {local_name}: {e}")
            
            models_info[tier] = model_info
        
        # Informations générales
        available_space = self._get_available_space_gb(models_path)
        
        return {
            'models_path': str(models_path),
            'available_space_gb': round(available_space, 1),
            'models': models_info,
            'total_models_loaded': len(self.pipelines),
            'total_models_saved_locally': sum(1 for info in models_info.values() if info['is_saved_locally'])
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
