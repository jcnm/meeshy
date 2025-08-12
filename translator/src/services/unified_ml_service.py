"""
Service de traduction ML unifié - Architecture centralisée
Un seul service ML qui charge les modèles au démarrage et sert tous les canaux
"""

import os
import logging
import time
import asyncio
from typing import Dict, Optional, List, Any, Union
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading
from pathlib import Path

# Import des settings
from config.settings import get_settings

# Import des modèles ML
try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
    import torch
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("⚠️ Transformers non disponible. Installation requise: pip install transformers torch")

logger = logging.getLogger(__name__)

@dataclass
class TranslationResult:
    """Résultat d'une traduction unifié"""
    translated_text: str
    detected_language: str
    confidence: float
    model_used: str
    from_cache: bool
    processing_time: float
    source_channel: str  # 'zmq', 'rest', 'websocket'

class UnifiedMLTranslationService:
    """
    Service de traduction ML unifié - Singleton
    Charge les modèles une seule fois au démarrage et sert tous les canaux
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, *args, **kwargs):
        """Singleton pattern pour garantir une seule instance"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, max_workers: int = 4):
        if self._initialized:
            return
            
        # Charger les settings
        self.settings = get_settings()
        
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # Modèles ML chargés (partagés entre tous les canaux)
        self.models = {}
        self.tokenizers = {}
        self.pipelines = {}
        
        # Configuration des modèles depuis les settings et .env
        self.models_path = Path(self.settings.models_path)
        self.device = os.getenv('DEVICE', 'cpu')
        
        self.model_configs = {
            'basic': {
                'model_name': self.settings.basic_model,
                'local_path': self.models_path / self.settings.basic_model,
                'description': f'{self.settings.basic_model} - Modèle rapide',
                'device': self.device,
                'priority': 1  # Chargé en premier
            },
            'medium': {
                'model_name': self.settings.medium_model,
                'local_path': self.models_path / self.settings.medium_model,
                'description': f'{self.settings.medium_model} - Modèle équilibré',
                'device': self.device,
                'priority': 2
            },
            'premium': {
                'model_name': self.settings.premium_model,
                'local_path': self.models_path / self.settings.premium_model,
                'description': f'{self.settings.premium_model} - Modèle haute qualité',
                'device': self.device,
                'priority': 3
            }
        }
        
        # Mapping des codes de langues NLLB
        self.lang_codes = {
            'fr': 'fra_Latn',
            'en': 'eng_Latn', 
            'es': 'spa_Latn',
            'de': 'deu_Latn',
            'pt': 'por_Latn',
            'zh': 'zho_Hans',
            'ja': 'jpn_Jpan',
            'ar': 'arb_Arab'
        }
        
        # Mapping des noms de langues pour T5 (noms complets)
        self.language_names = {
            'fr': 'French',
            'en': 'English', 
            'es': 'Spanish',
            'de': 'German',
            'pt': 'Portuguese',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ar': 'Arabic',
            'it': 'Italian',
            'ru': 'Russian',
            'ko': 'Korean',
            'nl': 'Dutch'
        }
        
        # Stats globales (partagées entre tous les canaux)
        self.stats = {
            'translations_count': 0,
            'zmq_translations': 0,
            'rest_translations': 0,
            'websocket_translations': 0,
            'avg_processing_time': 0.0,
            'models_loaded': False,
            'startup_time': None
        }
        self.request_times = []
        
        # État d'initialisation
        self.is_initialized = False
        self.is_loading = False
        self._startup_lock = asyncio.Lock()
        
        self._initialized = True
        logger.info(f"🤖 Service ML Unifié créé (Singleton) avec {max_workers} workers")
    
    async def initialize(self) -> bool:
        """Initialise les modèles ML une seule fois au démarrage"""
        async with self._startup_lock:
            if self.is_initialized:
                logger.info("✅ Service ML déjà initialisé")
                return True
                
            if self.is_loading:
                logger.info("⏳ Initialisation ML en cours...")
                # Attendre que l'initialisation se termine
                while self.is_loading and not self.is_initialized:
                    await asyncio.sleep(0.5)
                return self.is_initialized
            
            self.is_loading = True
            startup_start = time.time()
            
            if not ML_AVAILABLE:
                logger.error("❌ Transformers non disponible. Service ML désactivé.")
                self.is_loading = False
                return False
            
            try:
                logger.info("🚀 Initialisation du Service ML Unifié...")
                logger.info("📚 Chargement des modèles NLLB...")
                
                # Charger les modèles par ordre de priorité
                models_to_load = sorted(
                    self.model_configs.items(), 
                    key=lambda x: x[1]['priority']
                )
                
                for model_type, config in models_to_load:
                    try:
                        await self._load_model(model_type)
                    except Exception as e:
                        logger.error(f"❌ Erreur chargement {model_type}: {e}")
                        # Continuer avec les autres modèles
                
                # Vérifier qu'au moins un modèle est chargé
                if not self.models:
                    logger.error("❌ Aucun modèle ML chargé")
                    self.is_loading = False
                    return False
                
                startup_time = time.time() - startup_start
                self.stats['startup_time'] = startup_time
                self.stats['models_loaded'] = True
                self.is_initialized = True
                self.is_loading = False
                
                logger.info(f"✅ Service ML Unifié initialisé en {startup_time:.2f}s")
                logger.info(f"📊 Modèles chargés: {list(self.models.keys())}")
                logger.info(f"🎯 Prêt à servir tous les canaux: ZMQ, REST, WebSocket")
                
                return True
                
            except Exception as e:
                logger.error(f"❌ Erreur critique initialisation ML: {e}")
                self.is_loading = False
                return False
    
    async def _load_model(self, model_type: str):
        """Charge un modèle spécifique depuis local ou HuggingFace"""
        if model_type in self.models:
            return  # Déjà chargé
        
        config = self.model_configs[model_type]
        model_name = config['model_name']
        local_path = config['local_path']
        device = config['device']
        
        # Vérifier si le modèle existe en local
        model_path = str(local_path) if local_path.exists() else model_name
        logger.info(f"📥 Chargement {model_type}: {model_path}")
        
        # Charger dans un thread pour éviter de bloquer
        def load_model():
            try:
                # Tokenizer
                tokenizer = AutoTokenizer.from_pretrained(
                    model_path, 
                    cache_dir=str(self.models_path),
                    local_files_only=local_path.exists()
                )
                
                # Modèle
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_path,
                    cache_dir=str(self.models_path), 
                    local_files_only=local_path.exists()
                )
                
                # CORRECTION: Pas de pipeline partagé pour éviter "Already borrowed"
                # On crée les pipelines à la demande dans _ml_translate
                
                return tokenizer, model
                
            except Exception as e:
                logger.error(f"❌ Erreur chargement {model_type}: {e}")
                return None, None
        
        # Charger de manière asynchrone
        loop = asyncio.get_event_loop()
        tokenizer, model = await loop.run_in_executor(self.executor, load_model)
        
        if model and tokenizer:
            self.tokenizers[model_type] = tokenizer
            self.models[model_type] = model
            logger.info(f"✅ Modèle {model_type} chargé: {model_path}")
            if local_path.exists():
                logger.info(f"📁 Utilisé modèle local: {local_path}")
        else:
            raise Exception(f"Échec chargement {model_type}")
    
    async def translate(self, text: str, source_language: str = "auto", 
                       target_language: str = "en", model_type: str = "basic",
                       source_channel: str = "unknown") -> Dict[str, Any]:
        """
        Interface unique de traduction pour tous les canaux
        source_channel: 'zmq', 'rest', 'websocket'
        """
        start_time = time.time()
        
        try:
            # Validation
            if not text.strip():
                raise ValueError("Text cannot be empty")
            
            # Vérifier que le service est initialisé
            if not self.is_initialized:
                logger.warning("Service ML non initialisé, utilisation du fallback")
                return await self._fallback_translate(text, source_language, target_language, model_type, source_channel)
            
            # Fallback si modèle spécifique pas disponible  
            if model_type not in self.models:
                # Utiliser le premier modèle disponible
                available_models = list(self.models.keys())
                if available_models:
                    model_type = available_models[0]
                    logger.info(f"Modèle demandé non disponible, utilisation de: {model_type}")
                else:
                    return await self._fallback_translate(text, source_language, target_language, model_type, source_channel)
            
            # Détecter la langue source si nécessaire
            detected_lang = source_language if source_language != "auto" else self._detect_language(text)
            
            # Traduire avec le vrai modèle ML
            translated_text = await self._ml_translate(text, detected_lang, target_language, model_type)
            
            processing_time = time.time() - start_time
            self._update_stats(processing_time, source_channel)
            
            result = {
                'translated_text': translated_text,
                'detected_language': detected_lang,
                'confidence': 0.95,  # Confiance élevée pour les vrais modèles
                'model_used': f"{model_type}_ml",
                'from_cache': False,
                'processing_time': processing_time,
                'source_channel': source_channel
            }
            
            logger.info(f"✅ [ML-{source_channel.upper()}] '{text[:20]}...' → '{translated_text[:20]}...' ({processing_time:.3f}s)")
            return result
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction ML [{source_channel}]: {e}")
            # Fallback en cas d'erreur
            return await self._fallback_translate(text, source_language, target_language, model_type, source_channel)
    
    async def _ml_translate(self, text: str, source_lang: str, target_lang: str, model_type: str) -> str:
        """Traduction avec le vrai modèle ML - pipeline créé à la demande"""
        try:
            if model_type not in self.models:
                raise Exception(f"Modèle {model_type} non chargé")
            
            model = self.models[model_type]
            tokenizer = self.tokenizers[model_type]
            model_name = self.model_configs[model_type]['model_name']
            
            # Traduction dans un thread avec pipeline à la demande
            def translate():
                try:
                    # Différencier T5 et NLLB avec pipelines appropriés
                    if "t5" in model_name.lower():
                        # T5: utiliser text2text-generation
                        temp_pipeline = pipeline(
                            "text2text-generation",
                            model=model,
                            tokenizer=tokenizer,
                            device=0 if self.device == 'cuda' and torch.cuda.is_available() else -1,
                            max_length=128
                        )
                        
                        # T5: format avec noms complets de langues (comme votre exemple)
                        source_name = self.language_names.get(source_lang, source_lang.capitalize())
                        target_name = self.language_names.get(target_lang, target_lang.capitalize())
                        instruction = f"translate {source_name} to {target_name}: {text}"
                        
                        logger.debug(f"T5 instruction: {instruction}")
                        
                        result = temp_pipeline(
                            instruction,
                            max_new_tokens=64,
                            num_beams=4,
                            do_sample=False,
                            early_stopping=True,
                            repetition_penalty=1.1,
                            length_penalty=1.0
                        )
                        
                        # T5 retourne generated_text
                        if result and len(result) > 0 and 'generated_text' in result[0]:
                            raw_text = result[0]['generated_text']
                            
                            # Nettoyer l'instruction si présente dans le résultat
                            instruction_prefix = f"translate {source_name} to {target_name}:"
                            if instruction_prefix in raw_text:
                                parts = raw_text.split(instruction_prefix, 1)
                                if len(parts) > 1:
                                    translated = parts[1].strip()
                                else:
                                    translated = raw_text.strip()
                            else:
                                translated = raw_text.strip()
                                
                            # Validation: si vide ou identique au texte original, utiliser fallback
                            if not translated or translated.lower() == text.lower() or "translate" in translated.lower():
                                logger.warning(f"T5 traduction invalide: '{translated}', utilisation fallback")
                                translated = f"[T5-Fallback] {text}"
                                
                        else:
                            translated = f"[T5-No-Result] {text}"
                            
                    else:
                        # NLLB: utiliser translation avec codes de langue
                        temp_pipeline = pipeline(
                            "translation",
                            model=model,
                            tokenizer=tokenizer,
                            device=0 if self.device == 'cuda' and torch.cuda.is_available() else -1,
                            max_length=128
                        )
                        
                        # NLLB: codes de langue spéciaux
                        nllb_source = self.lang_codes.get(source_lang, 'eng_Latn')
                        nllb_target = self.lang_codes.get(target_lang, 'fra_Latn')
                        
                        result = temp_pipeline(
                            text, 
                            src_lang=nllb_source, 
                            tgt_lang=nllb_target, 
                            max_length=128
                        )
                        
                        # NLLB retourne translation_text
                        if result and len(result) > 0 and 'translation_text' in result[0]:
                            translated = result[0]['translation_text']
                        else:
                            translated = f"[NLLB-No-Result] {text}"
                    
                    # Nettoyer le pipeline temporaire
                    del temp_pipeline
                    
                    return translated
                    
                except Exception as e:
                    logger.error(f"Erreur pipeline {model_name}: {e}")
                    return f"[ML-Pipeline-Error] {text}"
            
            # Exécuter de manière asynchrone
            loop = asyncio.get_event_loop()
            translated = await loop.run_in_executor(self.executor, translate)
            
            return translated
            
        except Exception as e:
            logger.error(f"❌ Erreur modèle ML {model_type}: {e}")
            return f"[ML-Error] {text}"
    
    def _detect_language(self, text: str) -> str:
        """Détection de langue simple"""
        text_lower = text.lower()
        
        # Mots caractéristiques par langue
        if any(word in text_lower for word in ['bonjour', 'comment', 'vous', 'merci', 'salut']):
            return 'fr'
        elif any(word in text_lower for word in ['hello', 'how', 'you', 'thank', 'hi']):
            return 'en'
        elif any(word in text_lower for word in ['hola', 'como', 'estas', 'gracias']):
            return 'es'
        elif any(word in text_lower for word in ['guten', 'wie', 'geht', 'danke', 'hallo']):
            return 'de'
        else:
            return 'en'  # Défaut
    
    async def _fallback_translate(self, text: str, source_lang: str, target_lang: str, 
                                 model_type: str, source_channel: str) -> Dict[str, Any]:
        """Traduction de fallback si ML non disponible"""
        logger.warning(f"Utilisation du fallback pour {model_type} [{source_channel}]")
        
        # Dictionnaire simple comme fallback
        translations = {
            ('fr', 'en'): {
                'bonjour': 'hello', 'comment': 'how', 'vous': 'you', 'allez': 'are',
                'êtes': 'are', 'tout': 'all', 'le': 'the', 'monde': 'world'
            },
            ('en', 'fr'): {
                'hello': 'bonjour', 'how': 'comment', 'you': 'vous', 'are': 'êtes',
                'all': 'tout', 'the': 'le', 'world': 'monde'
            },
            ('es', 'fr'): {
                'hola': 'bonjour', 'como': 'comment', 'estas': 'allez-vous'
            },
            ('en', 'de'): {
                'hello': 'hallo', 'how': 'wie', 'are': 'sind', 'you': 'sie'
            }
        }
        
        # Traduction simple mot par mot
        lang_pair = (source_lang, target_lang)
        if lang_pair in translations:
            words = text.lower().split()
            translated_words = []
            for word in words:
                translated_word = translations[lang_pair].get(word, word)
                translated_words.append(translated_word)
            translated_text = ' '.join(translated_words)
        else:
            translated_text = f"[FALLBACK-{source_lang}→{target_lang}] {text}"
        
        self._update_stats(0.001, source_channel)
        
        return {
            'translated_text': translated_text,
            'detected_language': source_lang,
            'confidence': 0.3,  # Faible confiance pour fallback
            'model_used': f"{model_type}_fallback",
            'from_cache': False,
            'processing_time': 0.001,
            'source_channel': source_channel
        }
    
    def _update_stats(self, processing_time: float, source_channel: str):
        """Met à jour les statistiques globales"""
        self.stats['translations_count'] += 1
        
        # Mettre à jour les stats par canal (canaux connus seulement)
        if source_channel in ['zmq', 'rest', 'websocket']:
            self.stats[f'{source_channel}_translations'] += 1
        
        self.request_times.append(processing_time)
        
        if len(self.request_times) > 200:
            self.request_times = self.request_times[-200:]
        
        if self.request_times:
            self.stats['avg_processing_time'] = sum(self.request_times) / len(self.request_times)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques globales du service"""
        return {
            'service_type': 'unified_ml',
            'is_singleton': True,
            'translations_count': self.stats['translations_count'],
            'zmq_translations': self.stats['zmq_translations'],
            'rest_translations': self.stats['rest_translations'], 
            'websocket_translations': self.stats['websocket_translations'],
            'avg_processing_time': self.stats['avg_processing_time'],
            'models_loaded': {
                model_type: {
                    'name': self.model_configs[model_type]['model_name'],
                    'description': self.model_configs[model_type]['description'],
                    'local_path': str(self.model_configs[model_type]['local_path']),
                    'is_local': self.model_configs[model_type]['local_path'].exists()
                } for model_type in self.models.keys()
            },
            'ml_available': ML_AVAILABLE,
            'is_initialized': self.is_initialized,
            'startup_time': self.stats['startup_time'],
            'supported_languages': list(self.lang_codes.keys()),
            'models_path': str(self.models_path),
            'device': self.device
        }
    
    async def get_health(self) -> Dict[str, Any]:
        """Health check du service unifié"""
        return {
            'status': 'healthy' if self.is_initialized else 'initializing',
            'models_count': len(self.models),
            'pipelines_count': len(self.pipelines),
            'ml_available': ML_AVAILABLE,
            'translations_served': self.stats['translations_count']
        }

# Instance globale du service (Singleton)
def get_unified_ml_service(max_workers: int = 4) -> UnifiedMLTranslationService:
    """Retourne l'instance unique du service ML"""
    return UnifiedMLTranslationService(max_workers=max_workers)
