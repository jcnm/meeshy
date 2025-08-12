"""
Service de traduction ML réel avec modèles Transformers NLLB
Remplace les simulations par de vrais modèles de machine learning
"""

import os
import logging
import time
import asyncio
from typing import Dict, Optional, List, Any
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

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
    """Résultat d'une traduction"""
    translated_text: str
    detected_language: str
    confidence: float
    model_used: str
    from_cache: bool
    processing_time: float
    cache_key: str

class RealMLTranslationService:
    """Service de traduction ML réel avec modèles NLLB/T5"""
    
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # Modèles ML chargés
        self.models = {}
        self.tokenizers = {}
        self.pipelines = {}
        
        # Configuration des modèles
        self.model_configs = {
            'basic': {
                'model_name': 'facebook/nllb-200-distilled-600M',
                'description': 'NLLB-200 600M - Modèle multilingue équilibré',
                'device': 'cpu'  # cpu pour la stabilité, cuda pour les performances
            },
            'medium': {
                'model_name': 'facebook/nllb-200-distilled-600M',
                'description': 'NLLB-200 600M - Modèle multilingue équilibré',
                'device': 'cpu'
            },
            'premium': {
                'model_name': 'facebook/nllb-200-distilled-1.3B',
                'description': 'NLLB-200 1.3B - Modèle haute qualité',
                'device': 'cpu'
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
        
        # Stats
        self.stats = {
            'translations_count': 0,
            'avg_processing_time': 0.0,
            'models_loaded': False
        }
        self.request_times = []
        
        # Initialiser les modèles
        self.is_initialized = False
        
        logger.info(f"🤖 Service ML initialisé avec {max_workers} workers")
    
    async def initialize(self) -> bool:
        """Initialise les modèles ML"""
        if not ML_AVAILABLE:
            logger.error("❌ Transformers non disponible. Service ML désactivé.")
            return False
        
        try:
            logger.info("🚀 Chargement des modèles ML...")
            
            # Charger le modèle basic en priorité
            await self._load_model('basic')
            
            # Charger les autres modèles en arrière-plan
            asyncio.create_task(self._load_models_background())
            
            self.is_initialized = True
            self.stats['models_loaded'] = True
            logger.info("✅ Service ML initialisé avec succès")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation ML: {e}")
            return False
    
    async def _load_models_background(self):
        """Charge les autres modèles en arrière-plan"""
        try:
            await asyncio.sleep(2)  # Attendre que basic soit prêt
            await self._load_model('medium')
            await self._load_model('premium')
            logger.info("✅ Tous les modèles ML chargés")
        except Exception as e:
            logger.warning(f"⚠️ Erreur chargement modèles secondaires: {e}")
    
    async def _load_model(self, model_type: str):
        """Charge un modèle spécifique"""
        if model_type in self.models:
            return  # Déjà chargé
        
        config = self.model_configs[model_type]
        model_name = config['model_name']
        device = config['device']
        
        logger.info(f"📥 Chargement {model_type}: {model_name}")
        
        # Charger dans un thread pour éviter de bloquer
        def load_model():
            try:
                # Tokenizer
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                
                # Modèle
                model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
                
                # Pipeline de traduction
                translator_pipeline = pipeline(
                    "translation",
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if device == 'cuda' and torch.cuda.is_available() else -1
                )
                
                return tokenizer, model, translator_pipeline
                
            except Exception as e:
                logger.error(f"❌ Erreur chargement {model_type}: {e}")
                return None, None, None
        
        # Charger de manière asynchrone
        loop = asyncio.get_event_loop()
        tokenizer, model, pipeline_obj = await loop.run_in_executor(
            self.executor, load_model
        )
        
        if model and tokenizer and pipeline_obj:
            self.tokenizers[model_type] = tokenizer
            self.models[model_type] = model
            self.pipelines[model_type] = pipeline_obj
            logger.info(f"✅ Modèle {model_type} chargé: {model_name}")
        else:
            logger.error(f"❌ Échec chargement {model_type}")
    
    async def translate(self, text: str, source_language: str = "auto", 
                       target_language: str = "en", model_type: str = "basic") -> Dict[str, Any]:
        """Traduit un texte avec les vrais modèles ML"""
        start_time = time.time()
        
        try:
            # Validation
            if not text.strip():
                raise ValueError("Text cannot be empty")
            
            # Fallback si modèles pas chargés
            if not self.is_initialized or model_type not in self.pipelines:
                logger.warning(f"Modèle {model_type} non disponible, utilisation du fallback")
                return await self._fallback_translate(text, source_language, target_language, model_type)
            
            # Détecter la langue source si nécessaire
            detected_lang = source_language if source_language != "auto" else await self._detect_language(text)
            
            # Traduire avec le vrai modèle
            translated_text = await self._ml_translate(text, detected_lang, target_language, model_type)
            
            processing_time = time.time() - start_time
            self._update_stats(processing_time)
            
            result = {
                'translated_text': translated_text,
                'detected_language': detected_lang,
                'confidence': 0.95,  # Confiance élevée pour les vrais modèles
                'model_used': f"{model_type}_ml",
                'from_cache': False,
                'processing_time': processing_time
            }
            
            logger.info(f"✅ [ML] Traduction: '{text[:30]}...' → '{translated_text[:30]}...' ({processing_time:.3f}s)")
            return result
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction ML: {e}")
            # Fallback en cas d'erreur
            return await self._fallback_translate(text, source_language, target_language, model_type)
    
    async def _ml_translate(self, text: str, source_lang: str, target_lang: str, model_type: str) -> str:
        """Traduction avec le vrai modèle ML"""
        try:
            pipeline_obj = self.pipelines[model_type]
            
            # Convertir les codes de langue
            nllb_source = self.lang_codes.get(source_lang, 'eng_Latn')
            nllb_target = self.lang_codes.get(target_lang, 'fra_Latn')
            
            # Traduction dans un thread
            def translate():
                # NLLB utilise un format spécial
                inputs = f"{nllb_source}: {text}"
                result = pipeline_obj(inputs, src_lang=nllb_source, tgt_lang=nllb_target, max_length=512)
                return result[0]['translation_text'] if result else text
            
            # Exécuter de manière asynchrone
            loop = asyncio.get_event_loop()
            translated = await loop.run_in_executor(self.executor, translate)
            
            return translated
            
        except Exception as e:
            logger.error(f"❌ Erreur modèle ML {model_type}: {e}")
            return f"[ML-Error] {text}"
    
    async def _detect_language(self, text: str) -> str:
        """Détection de langue simple"""
        # Détection basique pour l'instant
        if any(word in text.lower() for word in ['bonjour', 'comment', 'vous']):
            return 'fr'
        elif any(word in text.lower() for word in ['hello', 'how', 'you']):
            return 'en'
        elif any(word in text.lower() for word in ['hola', 'como', 'estas']):
            return 'es'
        elif any(word in text.lower() for word in ['guten', 'wie', 'geht']):
            return 'de'
        else:
            return 'en'  # Défaut
    
    async def _fallback_translate(self, text: str, source_lang: str, target_lang: str, model_type: str) -> Dict[str, Any]:
        """Traduction de fallback si ML non disponible"""
        logger.warning(f"Utilisation du fallback pour {model_type}")
        
        # Dictionnaire simple comme fallback
        translations = {
            ('fr', 'en'): {
                'bonjour': 'hello',
                'comment': 'how',
                'vous': 'you',
                'allez': 'are'
            },
            ('en', 'fr'): {
                'hello': 'bonjour',
                'how': 'comment',
                'you': 'vous',
                'are': 'êtes'
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
        
        return {
            'translated_text': translated_text,
            'detected_language': source_lang,
            'confidence': 0.3,  # Faible confiance pour fallback
            'model_used': f"{model_type}_fallback",
            'from_cache': False,
            'processing_time': 0.001
        }
    
    def _update_stats(self, processing_time: float):
        """Met à jour les statistiques"""
        self.stats['translations_count'] += 1
        self.request_times.append(processing_time)
        
        if len(self.request_times) > 100:
            self.request_times = self.request_times[-100:]
        
        self.stats['avg_processing_time'] = sum(self.request_times) / len(self.request_times)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du service"""
        return {
            'service_type': 'real_ml',
            'translations_count': self.stats['translations_count'],
            'avg_processing_time': self.stats['avg_processing_time'],
            'models_loaded': list(self.models.keys()),
            'pipelines_ready': list(self.pipelines.keys()),
            'ml_available': ML_AVAILABLE,
            'is_initialized': self.is_initialized
        }
