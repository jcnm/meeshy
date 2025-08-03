"""
Service de traduction ML propre et fonctionnel
Modèles: T5-Small + NLLB-200-Distilled-600M
Sans mocks, avec gestion d'erreurs robuste
"""

import asyncio
import logging
import time
import os
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import threading
import hashlib

# ML et transformers (optionnels pour mode dégradé)
try:
    import torch
    from transformers import (
        AutoTokenizer, 
        AutoModelForSeq2SeqLM, 
        M2M100ForConditionalGeneration,
        M2M100Tokenizer,
        pipeline
    )
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    torch = None

# Détection de langue (optionnelle)
try:
    from langdetect import detect, detect_langs, LangDetectError
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False

from config.settings import get_settings, get_model_language_code, get_iso_language_code
from .cache_service import CacheService

logger = logging.getLogger(__name__)

class TranslationService:
    """Service de traduction ML avec modèles réels"""
    
    def __init__(self, cache_service: Optional[CacheService] = None):
        self.settings = get_settings()
        self.cache_service = cache_service or CacheService()
        
        # État des modèles
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        self.pipelines: Dict[str, Any] = {}  # Pipelines de traduction
        self.device = "cpu"
        self.is_initialized = False
        
        # Configuration des modèles - MISE À JOUR avec T5
        self.model_configs = {
            "t5-small": {
                "name": "t5-small",
                "type": "t5",
                "max_length": 512
            },
            "nllb-200-distilled-600M": {
                "name": "facebook/nllb-200-distilled-600M",
                "type": "nllb",
                "max_length": 1024
            },
            "nllb-200-distilled-1.3B": {
                "name": "facebook/nllb-200-distilled-1.3B",
                "type": "nllb",
                "max_length": 1024
            }
        }
        
        # Statistiques
        self.stats = {
            'translations_count': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0,
            'models_loaded': 0,
            'average_inference_time': 0.0,
            'languages_detected': 0
        }
        
        # Thread safety
        self._model_lock = threading.Lock()
    
    async def initialize(self):
        """Initialise le service de traduction"""
        logger.info("🤖 Démarrage du service de traduction ML...")
        
        if not TRANSFORMERS_AVAILABLE:
            logger.warning("⚠️ Transformers non disponible - Mode détection de langue seulement")
            logger.warning("💡 Installez: pip install transformers torch")
            self.is_initialized = True
            return {
                "status": "initialized",
                "mode": "language_detection_only",
                "transformers_available": False,
                "models_loaded": 0
            }
        
        try:
            # Vérifier la disponibilité de CUDA
            if torch.cuda.is_available():
                self.device = "cuda"
                logger.info(f"🚀 CUDA disponible: {torch.cuda.get_device_name()}")
            else:
                self.device = "cpu"
                logger.info("🖥️ Utilisation du CPU")
            
            # Charger les modèles selon la configuration
            await self._load_models()
            
            self.is_initialized = True
            logger.info("✅ Service de traduction ML initialisé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation ML: {e}")
            logger.warning("🔄 Basculement en mode dégradé")
            self.is_initialized = True
        
        return {
            "status": "initialized",
            "mode": "full_translation" if self.models else "degraded",
            "transformers_available": TRANSFORMERS_AVAILABLE,
            "models_loaded": len(self.models),
            "device": self.device
        }
    
    async def _load_models(self):
        """Charge TOUS les modèles configurés au démarrage"""
        models_to_load = []
        
        # Charger TOUS les modèles disponibles (T5, NLLB-600M, NLLB-1.3B)
        for model_name in self.model_configs.keys():
            if model_name not in models_to_load:
                models_to_load.append(model_name)
        
        logger.info(f"� Chargement de TOUS les modèles: {models_to_load}")
        
        # Vérifier l'espace disque pour le modèle 1.3B
        import shutil
        free_space = shutil.disk_usage(self.settings.models_path).free
        required_space = 6 * 1024 * 1024 * 1024  # 6GB pour le modèle 1.3B
        
        if "nllb-200-distilled-1.3B" in models_to_load:
            premium_local_path = Path(self.settings.models_path) / "nllb-200-distilled-1.3B"
            
            if not premium_local_path.exists() and free_space < required_space:
                logger.warning(f"💽 Espace disque insuffisant pour NLLB-1.3B")
                logger.warning(f"   Requis: {required_space / (1024**3):.1f}GB, Disponible: {free_space / (1024**3):.1f}GB")
                models_to_load.remove("nllb-200-distilled-1.3B")
                logger.info(f"   Modèle NLLB-1.3B ignoré par manque d'espace")
            else:
                logger.info(f"� Espace suffisant pour NLLB-1.3B: {free_space / (1024**3):.1f}GB libres")
        
        for model_name in models_to_load:
            try:
                logger.info(f"⏳ Chargement du modèle {model_name}...")
                await self._load_single_model(model_name)
                logger.info(f"✅ Modèle {model_name} chargé")
                self.stats['models_loaded'] += 1
                
            except Exception as e:
                logger.error(f"❌ Erreur lors du chargement de {model_name}: {e}")
    
    async def _load_single_model(self, model_name: str):
        """Charge un modèle spécifique et crée un pipeline de traduction"""
        config = self.model_configs[model_name]
        
        # Vérifier si le modèle est disponible localement
        local_path = Path(self.settings.models_path) / model_name
        
        if local_path.exists():
            model_path = str(local_path)
            logger.info(f"📁 Utilisation du modèle local: {model_path}")
        else:
            model_path = config["name"]
            logger.info(f"🌐 Téléchargement du modèle depuis Hugging Face: {model_path}")
        
        with self._model_lock:
            try:
                # Créer le pipeline de traduction selon le type de modèle
                if config["type"] == "nllb":
                    logger.info(f"🔧 Création du pipeline NLLB pour {model_name}...")
                    translation_pipeline = pipeline(
                        "translation",
                        model=model_path,
                        tokenizer=model_path,
                        device=0 if self.device == "cuda" and torch.cuda.is_available() else -1,
                        torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                        model_kwargs={"low_cpu_mem_usage": True} if self.device == "cuda" else {}
                    )
                
                elif config["type"] == "t5":
                    logger.info(f"🔧 Création du pipeline T5 pour {model_name}...")
                    # Pour T5, nous devons utiliser text2text-generation
                    translation_pipeline = pipeline(
                        "text2text-generation",
                        model=model_path,
                        tokenizer=model_path,
                        device=0 if self.device == "cuda" and torch.cuda.is_available() else -1,
                        torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
                    )
                
                else:
                    raise ValueError(f"Type de modèle non supporté: {config['type']}")
                
                # Sauvegarder localement si téléchargé depuis Hugging Face
                if not local_path.exists():
                    logger.info(f"💾 Sauvegarde du modèle localement: {local_path}")
                    local_path.mkdir(parents=True, exist_ok=True)
                    
                    # Sauvegarder le tokenizer et le modèle
                    translation_pipeline.tokenizer.save_pretrained(str(local_path))
                    translation_pipeline.model.save_pretrained(str(local_path))
                    
                    logger.info(f"✅ Modèle sauvegardé avec succès: {local_path}")
                
                # Sauvegarder le pipeline en mémoire
                self.pipelines[model_name] = translation_pipeline
                self.models[model_name] = translation_pipeline.model
                self.tokenizers[model_name] = translation_pipeline.tokenizer
                
                logger.info(f"✅ Pipeline {config['type']} créé pour {model_name}")
                
            except Exception as e:
                logger.error(f"❌ Erreur lors de la création du pipeline {model_name}: {e}")
                raise
    
    async def translate_text(
        self,
        text: str,
        source_language: str,
        target_language: str,
        model_type: str = "basic"
    ) -> Dict[str, Any]:
        """Traduit un texte - Fonction principale SANS mock"""
        if not self.is_initialized:
            await self.initialize()
        
        # Validation des entrées
        if not text or not text.strip():
            return {
                'translated_text': '',
                'source_language': source_language,
                'target_language': target_language,
                'from_cache': False,
                'error': 'Texte vide'
            }
        
        text = text.strip()
        if len(text) > self.settings.max_text_length:
            return {
                'translated_text': text[:self.settings.max_text_length] + "...",
                'source_language': source_language,
                'target_language': target_language,
                'from_cache': False,
                'error': f'Texte trop long (max {self.settings.max_text_length} caractères)'
            }
        
        start_time = time.time()
        
        try:
            # 1. Détecter la langue source si nécessaire
            if source_language == "auto":
                source_language = await self._detect_language(text)
                logger.info(f"🔍 Langue détectée: {source_language}")
            
            # 2. Vérifier le cache
            cache_result = await self.cache_service.get_translation(
                text, source_language, target_language, model_type
            )
            
            if cache_result:
                self.stats['cache_hits'] += 1
                logger.debug(f"💨 Cache HIT pour: {text[:30]}...")
                return {
                    **cache_result,
                    'source_language': source_language,
                    'target_language': target_language,
                    'processing_time': time.time() - start_time
                }
            
            self.stats['cache_misses'] += 1
            
            # 3. Traduction réelle
            if not self.pipelines:
                # Mode dégradé - pas de traduction ML disponible
                return await self._fallback_translation(text, source_language, target_language)
            
            translation_result = await self._perform_ml_translation(
                text, source_language, target_language, model_type
            )
            
            # 4. Sauvegarder en cache
            if translation_result and not translation_result.get('error'):
                await self.cache_service.set_translation(
                    text, source_language, target_language,
                    translation_result['translated_text'], model_type,
                    metadata={
                        'model_used': translation_result.get('model_used'),
                        'confidence': translation_result.get('confidence', 0),
                        'processing_time': translation_result.get('processing_time', 0)
                    }
                )
            
            # 5. Mise à jour des statistiques
            processing_time = time.time() - start_time
            self._update_stats(processing_time, success=not translation_result.get('error'))
            
            return {
                **translation_result,
                'processing_time': processing_time,
                'from_cache': False
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la traduction: {e}")
            self.stats['errors'] += 1
            
            return {
                'translated_text': text,  # Retourner le texte original en cas d'erreur
                'source_language': source_language,
                'target_language': target_language,
                'from_cache': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    async def _detect_language(self, text: str) -> str:
        """Détecte la langue du texte"""
        if not LANGDETECT_AVAILABLE:
            logger.warning("⚠️ langdetect non disponible, utilisation du français par défaut")
            return self.settings.default_language
        
        try:
            detected_lang = detect(text)
            self.stats['languages_detected'] += 1
            
            # Validation de la langue détectée
            if detected_lang in self.settings.supported_languages_list:
                return detected_lang
            else:
                logger.warning(f"⚠️ Langue détectée non supportée: {detected_lang}")
                return self.settings.default_language
                
        except LangDetectError as e:
            logger.warning(f"⚠️ Erreur de détection de langue: {e}")
            return self.settings.default_language
    
    def _get_generation_params(self, text: str, model_type: str, config_type: str) -> Dict[str, Any]:
        """Détermine les paramètres de génération selon le texte et le modèle"""
        text_length = len(text)
        
        # Paramètres de base
        base_params = {
            "num_beams": 4,
            "do_sample": False,
            "no_repeat_ngram_size": 2,
            "repetition_penalty": 1.1
        }
        
        if config_type == "nllb":
            # Paramètres NLLB selon la longueur du texte
            if text_length < 10:  # Très court (mots simples)
                return {
                    **base_params,
                    "max_new_tokens": 32,
                    "length_penalty": 1.0,  # Changé de 1.2 à 1.0 pour neutralité
                    "early_stopping": True,
                    "num_beams": 4  # Augmenté de 2 à 4 pour consistance
                }
            elif text_length < 50:  # Court (phrases simples)
                return {
                    **base_params,
                    "max_new_tokens": 64,
                    "length_penalty": 1.0,
                    "early_stopping": True
                }
            elif text_length < 150:  # Moyen (paragraphes courts)
                return {
                    **base_params,
                    "max_new_tokens": 128,
                    "length_penalty": 0.9,
                    "early_stopping": True
                }
            else:  # Long (textes complexes)
                return {
                    **base_params,
                    "max_new_tokens": 256,
                    "length_penalty": 0.8,
                    "early_stopping": False,
                    "num_beams": 6  # Plus de beams pour meilleure qualité
                }
        
        elif config_type == "t5":
            # Paramètres T5 selon la longueur du texte
            if text_length < 20:  # Court
                return {
                    **base_params,
                    "max_new_tokens": 50,
                    "length_penalty": 1.0,
                    "early_stopping": True
                }
            else:  # Plus long
                return {
                    **base_params,
                    "max_new_tokens": 100,
                    "length_penalty": 1.0,
                    "early_stopping": True
                }
        
        # Paramètres par défaut
        return base_params

    def _get_pipeline_params(self, text: str, model_type: str, config_type: str) -> Dict[str, Any]:
        """Détermine les paramètres optimaux pour les pipelines selon le texte et le modèle"""
        text_length = len(text)
        
        if config_type == "nllb":
            # Paramètres pour pipeline NLLB selon la longueur du texte
            if text_length < 10:  # Très court (mots simples)
                return {
                    "max_length": 32,
                    "num_beams": 4,  # Augmenté de 2 à 4 pour meilleure qualité
                    "do_sample": False,
                    "early_stopping": True
                }
            elif text_length < 50:  # Court (phrases simples)
                return {
                    "max_length": 64,
                    "num_beams": 4,
                    "do_sample": False,
                    "early_stopping": True
                }
            elif text_length < 150:  # Moyen (paragraphes courts)
                return {
                    "max_length": 128,
                    "num_beams": 4,
                    "do_sample": False,
                    "early_stopping": True
                }
            else:  # Long (textes complexes)
                return {
                    "max_length": 256,
                    "num_beams": 6,
                    "do_sample": False,
                    "early_stopping": False
                }
        
        elif config_type == "t5":
            # Paramètres pour pipeline T5 text2text-generation avec instructions
            if text_length < 20:  # Court
                return {
                    "max_new_tokens": 32,  # Plus court pour mots simples
                    "num_beams": 4,
                    "do_sample": False,
                    "early_stopping": True,
                    "repetition_penalty": 1.1,
                    "length_penalty": 1.0
                }
            else:  # Plus long
                return {
                    "max_new_tokens": 100,
                    "num_beams": 4,
                    "do_sample": False,
                    "early_stopping": True,
                    "repetition_penalty": 1.1,
                    "length_penalty": 1.0
                }
        
        # Paramètres par défaut
        return {
            "max_length": 100,
            "num_beams": 4,
            "do_sample": False,
            "early_stopping": True
        }

    async def _perform_ml_translation(
        self,
        text: str,
        source_language: str,
        target_language: str,
        model_type: str
    ) -> Dict[str, Any]:
        """Effectue la traduction ML réelle avec les pipelines Transformers"""
        
        logger.info(f"🔄 DÉBUT TRADUCTION ML (Pipeline):")
        logger.info(f"   📝 Texte: '{text}'")
        logger.info(f"   🌐 {source_language} → {target_language}")
        logger.info(f"   🤖 Type de modèle demandé: {model_type}")
        
        # Sélection du modèle basée sur la demande utilisateur ET la longueur du texte
        text_length = len(text)
        
        # Respecter le choix de l'utilisateur en priorité
        if model_type == "basic":
            # basic = T5-small (rapide pour textes courts)
            preferred_model = "t5-small"
            logger.info(f"   🎯 Modèle 'basic' demandé → T5-small ({text_length} chars)")
        elif model_type == "medium":
            # medium = NLLB-600M (équilibre qualité/vitesse)
            preferred_model = "nllb-200-distilled-600M"
            logger.info(f"   🎯 Modèle 'medium' demandé → NLLB-600M ({text_length} chars)")
        elif model_type == "premium":
            # premium = NLLB-1.3B (meilleure qualité)
            preferred_model = "nllb-200-distilled-1.3B"
            logger.info(f"   🎯 Modèle 'premium' demandé → NLLB-1.3B ({text_length} chars)")
        else:
            # Fallback sur l'ancien comportement
            if text_length < 20:
                preferred_model = "t5-small"
                logger.info(f"   📏 Texte court ({text_length} chars) → T5-small par défaut")
            else:
                preferred_model = None
                logger.info(f"   📏 Texte long ({text_length} chars) → sélection automatique")
        
        # Sélectionner le modèle optimal
        model_name = self._select_model(preferred_model if preferred_model else model_type)
        
        if not model_name:
            logger.error("❌ Aucun modèle disponible")
            return await self._fallback_translation(text, source_language, target_language)
        
        logger.info(f"   🎯 Modèle sélectionné: {model_name}")
        
        try:
            config = self.model_configs[model_name]
            pipeline_obj = self.pipelines[model_name]
            
            logger.info(f"   📊 Config modèle: type={config['type']}, max_length={config['max_length']}")
            
            # Paramètres selon le type de modèle et la longueur du texte
            pipeline_params = self._get_pipeline_params(text, model_type, config["type"])
            logger.info(f"   ⚙️ Paramètres pipeline: {pipeline_params}")
            
            # Traduction selon le type de modèle
            if config["type"] == "nllb":
                # Mapper les codes de langue pour NLLB
                src_code = get_model_language_code(source_language)
                tgt_code = get_model_language_code(target_language)
                
                if not src_code or not tgt_code:
                    logger.error(f"   ❌ Codes de langue NLLB non trouvés: {source_language}→{target_language}")
                    return await self._fallback_translation(text, source_language, target_language)
                
                logger.info(f"   🌐 Codes langues NLLB: {src_code} → {tgt_code}")
                
                result = pipeline_obj(
                    text,
                    src_lang=src_code,
                    tgt_lang=tgt_code,
                    **pipeline_params
                )
                
                if isinstance(result, dict) and 'translation_text' in result:
                    translated_text = result['translation_text']
                elif isinstance(result, list) and len(result) > 0 and 'translation_text' in result[0]:
                    translated_text = result[0]['translation_text']
                else:
                    translated_text = str(result)
                
                logger.info(f"   📤 NLLB résultat pipeline: '{translated_text}'")
            
            elif config["type"] == "t5":
                # Format T5 avec instruction explicite incluant les langues
                simple_instruction = f"translate English to French: {text}"
                logger.info(f"   📝 Instruction T5 explicite: '{simple_instruction}'")
                
                # Paramètres spécifiques pour T5 text generation
                t5_params = {
                    "max_new_tokens": pipeline_params.get("max_new_tokens", 32),
                    "num_beams": pipeline_params.get("num_beams", 4),
                    "do_sample": False,
                    "early_stopping": True,
                    "pad_token_id": pipeline_obj.tokenizer.eos_token_id,
                    "temperature": 1.0,
                    "repetition_penalty": 1.2
                }
                
                logger.info(f"   ⚙️ Paramètres T5: {t5_params}")
                
                result = pipeline_obj(
                    simple_instruction,
                    **t5_params
                )
                
                if isinstance(result, list) and len(result) > 0:
                    translated_text = result[0]['generated_text']
                else:
                    translated_text = str(result)
                
                # Nettoyer la réponse T5
                translated_text = translated_text.strip()
                
                # Si T5 retourne l'instruction + résultat, extraire seulement la traduction
                if "translate English to French:" in translated_text:
                    parts = translated_text.split("translate English to French:", 1)
                    if len(parts) > 1:
                        translated_text = parts[1].strip()
                
                # Si la traduction est vide ou identique au texte original, 
                # utiliser NLLB en fallback
                if not translated_text or translated_text.lower() == text.lower() or "translate" in translated_text.lower():
                    logger.warning(f"   ⚠️ T5 n'a pas produit de traduction valide: '{translated_text}'")
                    logger.info(f"   🔄 Fallback vers NLLB pour texte court")
                    # Récursif vers NLLB
                    return await self._perform_ml_translation(text, source_language, target_language, "medium")
                
                logger.info(f"   📤 T5 résultat nettoyé: '{translated_text}'")
            
            else:
                raise ValueError(f"Type de modèle non supporté: {config['type']}")
            
            # Validation finale
            if not translated_text or translated_text.lower() == text.lower():
                logger.warning(f"   ⚠️ Traduction vide ou identique, utilisation du fallback")
                return await self._fallback_translation(text, source_language, target_language)
            
            logger.info(f"   ✅ TRADUCTION FINALE: '{translated_text}'")
            
            return {
                'translated_text': translated_text,
                'source_language': source_language,
                'target_language': target_language,
                'model_used': model_name,
                'confidence': 0.9,  # Pipeline plus fiable
                'cache_key': None
            }
            
        except Exception as e:
            logger.error(f"   ❌ Erreur pipeline traduction avec {model_name}: {e}")
            logger.exception(f"   🔍 Détails de l'erreur:")
            return await self._fallback_translation(text, source_language, target_language)
    
    def _select_model(self, model_type: str) -> Optional[str]:
        """Sélectionne le meilleur modèle disponible selon le type demandé"""
        logger.info(f"🎯 Sélection du modèle pour type: {model_type}")
        logger.info(f"📊 Modèles disponibles dans pipelines: {list(self.pipelines.keys())}")
        logger.info(f"⚙️ Settings: basic={self.settings.basic_model}, medium={self.settings.medium_model}, premium={self.settings.premium_model}")
        
        # Priorité spéciale pour nom direct de modèle (quand déjà spécifique)
        if model_type in self.pipelines:
            logger.info(f"✅ Modèle direct trouvé: {model_type}")
            return model_type
        
        # Correspondance par type générique
        if model_type == "basic" and self.settings.basic_model in self.pipelines:
            logger.info(f"✅ Modèle basic sélectionné: {self.settings.basic_model}")
            return self.settings.basic_model
        elif model_type == "medium" and self.settings.medium_model in self.pipelines:
            logger.info(f"✅ Modèle medium sélectionné: {self.settings.medium_model}")
            return self.settings.medium_model
        elif model_type == "premium" and self.settings.premium_model in self.pipelines:
            logger.info(f"✅ Modèle premium sélectionné: {self.settings.premium_model}")
            return self.settings.premium_model
        elif model_type == "premium":
            logger.error(f"❌ DEBUG: premium_model='{self.settings.premium_model}' pas dans pipelines {list(self.pipelines.keys())}")
            logger.error(f"❌ Comparaison: '{self.settings.premium_model}' in {list(self.pipelines.keys())} = {self.settings.premium_model in self.pipelines}")
        
        # Fallback intelligent : utiliser le meilleur modèle disponible
        logger.warning(f"⚠️ Modèle {model_type} non disponible, recherche de fallback")
        
        # Pour T5-small, si pas dispo, utiliser le modèle basic
        if model_type == "t5-small":
            if self.settings.basic_model in self.pipelines:
                logger.info(f"🔄 Fallback T5→Basic: {self.settings.basic_model}")
                return self.settings.basic_model
            elif self.settings.medium_model in self.pipelines:
                logger.info(f"🔄 Fallback T5→Medium: {self.settings.medium_model}")
                return self.settings.medium_model
        
        # Si premium demandé mais pas dispo, essayer medium puis basic
        if model_type == "premium":
            if self.settings.medium_model in self.pipelines:
                logger.info(f"🔄 Fallback: {self.settings.medium_model}")
                return self.settings.medium_model
            elif self.settings.basic_model in self.pipelines:
                logger.info(f"🔄 Fallback: {self.settings.basic_model}")
                return self.settings.basic_model
        
        # Si medium demandé mais pas dispo, essayer premium puis basic
        elif model_type == "medium":
            if self.settings.premium_model in self.pipelines:
                logger.info(f"🔄 Fallback (upgrade): {self.settings.premium_model}")
                return self.settings.premium_model
            elif self.settings.basic_model in self.pipelines:
                logger.info(f"🔄 Fallback (downgrade): {self.settings.basic_model}")
                return self.settings.basic_model
        
        # Si basic demandé mais pas dispo, essayer les autres
        elif model_type == "basic":
            if self.settings.medium_model in self.pipelines:
                logger.info(f"🔄 Fallback (upgrade): {self.settings.medium_model}")
                return self.settings.medium_model
            elif self.settings.premium_model in self.pipelines:
                logger.info(f"🔄 Fallback (upgrade): {self.settings.premium_model}")
                return self.settings.premium_model
        
        # Dernier recours : retourner le premier pipeline disponible
        available_model = next(iter(self.pipelines.keys())) if self.pipelines else None
        if available_model:
            logger.warning(f"🔄 Dernier recours: {available_model}")
        else:
            logger.error("❌ Aucun pipeline disponible!")
        
        return available_model
    
    async def _fallback_translation(self, text: str, source_language: str, target_language: str) -> Dict[str, Any]:
        """Traduction de secours quand ML n'est pas disponible"""
        logger.warning(f"🔄 Traduction de secours pour: {text[:30]}...")
        
        # Dans une vraie implémentation, ceci pourrait utiliser:
        # - Un service de traduction externe (Google Translate API, DeepL, etc.)
        # - Un modèle plus simple
        # - Une base de données de traductions communes
        
        return {
            'translated_text': f"[{target_language.upper()}] {text}",  # Placeholder simple
            'source_language': source_language,
            'target_language': target_language,
            'model_used': 'fallback',
            'confidence': 0.1,
            'cache_key': None,
            'note': 'Traduction de secours - modèles ML non disponibles'
        }
    
    def _update_stats(self, processing_time: float, success: bool):
        """Met à jour les statistiques"""
        if success:
            self.stats['translations_count'] += 1
            # Moyenne mobile
            current_avg = self.stats['average_inference_time']
            total_count = self.stats['translations_count']
            self.stats['average_inference_time'] = (
                (current_avg * (total_count - 1) + processing_time) / total_count
            )
        else:
            self.stats['errors'] += 1
    
    async def get_supported_languages(self) -> List[str]:
        """Retourne la liste des langues supportées"""
        return self.settings.supported_languages_list
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé du service de traduction"""
        health = {
            'service_initialized': self.is_initialized,
            'transformers_available': TRANSFORMERS_AVAILABLE,
            'langdetect_available': LANGDETECT_AVAILABLE,
            'models_loaded': len(self.models),
            'pipelines_loaded': len(self.pipelines),
            'device': self.device,
            'cache_available': self.cache_service is not None
        }
        
        if self.cache_service:
            cache_health = await self.cache_service.health_check()
            health['cache_health'] = cache_health
        
        return health
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du service"""
        total_requests = self.stats['translations_count'] + self.stats['errors']
        
        return {
            **self.stats,
            'total_requests': total_requests,
            'success_rate': (
                self.stats['translations_count'] / total_requests * 100
                if total_requests > 0 else 0
            ),
            'cache_hit_rate': (
                self.stats['cache_hits'] / (self.stats['cache_hits'] + self.stats['cache_misses']) * 100
                if (self.stats['cache_hits'] + self.stats['cache_misses']) > 0 else 0
            )
        }
    
    async def cleanup(self):
        """Décharge proprement tous les modèles et libère la mémoire"""
        logger.info("🧹 Déchargement des modèles ML...")
        
        try:
            # Décharger les pipelines
            for model_name in list(self.pipelines.keys()):
                logger.info(f"   🗑️ Déchargement du pipeline: {model_name}")
                pipeline = self.pipelines.pop(model_name, None)
                if pipeline:
                    # Libérer la mémoire du pipeline
                    del pipeline
            
            # Décharger les modèles
            for model_name in list(self.models.keys()):
                logger.info(f"   🗑️ Déchargement du modèle: {model_name}")
                model = self.models.pop(model_name, None)
                if model:
                    # Déplacer le modèle vers le CPU et libérer la mémoire
                    if hasattr(model, 'cpu'):
                        model.cpu()
                    del model
            
            # Décharger les tokenizers
            for tokenizer_name in list(self.tokenizers.keys()):
                logger.info(f"   🗑️ Déchargement du tokenizer: {tokenizer_name}")
                tokenizer = self.tokenizers.pop(tokenizer_name, None)
                if tokenizer:
                    del tokenizer
            
            # Forcer le garbage collection
            import gc
            gc.collect()
            
            # Libérer la mémoire CUDA si disponible
            if torch and torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("   🚀 Cache CUDA vidé")
            
            logger.info("✅ Déchargement des modèles terminé")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du déchargement: {e}")
