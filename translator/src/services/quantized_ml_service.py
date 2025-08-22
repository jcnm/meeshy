"""
Service de traduction ML quantifié - Optimisations de performance
Optimisations: Float16, Int8 (sans ONNX pour simplifier)
"""

import os
import logging
import time
import asyncio
from typing import Dict, Optional, Any
from concurrent.futures import ThreadPoolExecutor
import threading

# Import des settings
from config.settings import get_settings

# Import des modèles ML optimisés
try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("⚠️ Dependencies ML non disponibles")

logger = logging.getLogger(__name__)

class QuantizedMLService:
    """
    Service de traduction ML quantifié - Compatible avec UnifiedMLService
    Utilise les mêmes interfaces et patterns
    """
    
    def __init__(self, model_type: str = "basic", quantization_level: str = "float16", max_workers: int = 4):
        self.settings = get_settings()
        self.model_type = model_type
        self.quantization_level = quantization_level
        self.max_workers = max_workers
        
        # Configuration selon le type de modèle (même que UnifiedMLService)
        self.model_configs = {
            'basic': {
                'model_name': 't5-small',
                'description': 'T5-small quantifié',
                'max_length': 128
            },
            'medium': {
                'model_name': 'facebook/nllb-200-distilled-600M',
                'description': 'NLLB-600M quantifié',
                'max_length': 256
            },
            'premium': {
                'model_name': 'facebook/nllb-200-distilled-1.3B',
                'description': 'NLLB-1.3B quantifié',
                'max_length': 512
            }
        }
        
        # Modèles chargés (comme UnifiedMLService)
        self.models = {}
        self.tokenizers = {}
        
        # Thread pool pour les traductions (comme UnifiedMLService)
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # Stats de performance
        self.stats = {
            'translations_count': 0,
            'avg_processing_time': 0.0,
            'memory_usage_mb': 0.0,
            'quantization_level': quantization_level,
            'models_loaded': False
        }
        
        # Mapping des codes de langues (comme UnifiedMLService)
        self.lang_codes = {
            'fr': 'fra_Latn', 'en': 'eng_Latn', 'es': 'spa_Latn', 'de': 'deu_Latn',
            'pt': 'por_Latn', 'zh': 'zho_Hans', 'ja': 'jpn_Jpan', 'ar': 'arb_Arab'
        }
        
        # Mapping des noms de langues pour T5 (comme UnifiedMLService)
        self.language_names = {
            'fr': 'French', 'en': 'English', 'es': 'Spanish', 'de': 'German',
            'pt': 'Portuguese', 'zh': 'Chinese', 'ja': 'Japanese', 'ar': 'Arabic'
        }
        
        logger.info(f"🤖 Service ML Quantifié créé: {model_type} avec {quantization_level} ({max_workers} workers)")
    
    async def initialize(self) -> bool:
        """Initialise le(s) modèle(s) quantifié(s) (comme UnifiedMLService)"""
        if not ML_AVAILABLE:
            logger.error("❌ Dependencies ML non disponibles")
            return False
        
        try:
            logger.info(f"🚀 Initialisation modèle(s) quantifié(s): {self.model_type} ({self.quantization_level})")
            
            # Charger un ou plusieurs modèles
            if self.model_type == "all":
                # Charger tous les modèles
                for model_type in self.model_configs.keys():
                    config = self.model_configs[model_type]
                    model_name = config['model_name']
                    await self._load_quantized_model(model_name, model_type)
                logger.info(f"✅ Tous les modèles quantifiés chargés ({self.quantization_level})")
            else:
                # Charger un modèle spécifique
                config = self.model_configs[self.model_type]
                model_name = config['model_name']
                await self._load_quantized_model(model_name, self.model_type)
                logger.info(f"✅ Modèle quantifié chargé: {self.model_type} ({self.quantization_level})")
            
            self.stats['models_loaded'] = True
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation modèle(s) quantifié(s): {e}")
            return False
    
    async def _load_quantized_model(self, model_name: str, model_type: str = None):
        """Charge un modèle avec quantification"""
        if model_type is None:
            model_type = self.model_type
            
        logger.info(f"📥 Chargement modèle {model_type} ({self.quantization_level}): {model_name}")
        
        # Charger le tokenizer
        self.tokenizers[model_type] = AutoTokenizer.from_pretrained(model_name)
        
        # Vérifier si accelerate est disponible pour device_map
        try:
            import accelerate
            device_map_available = True
        except ImportError:
            device_map_available = False
            logger.warning("⚠️ accelerate non installé, device_map désactivé")
        
        # Charger le modèle selon le niveau de quantification
        if self.quantization_level == "float16":
            if device_map_available:
                self.models[model_type] = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    torch_dtype=torch.float16,
                    low_cpu_mem_usage=True,
                    device_map="auto"
                )
            else:
                # Fallback sans device_map
                self.models[model_type] = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    torch_dtype=torch.float16,
                    low_cpu_mem_usage=True
                )
        elif self.quantization_level == "int8":
            try:
                # Charger en float32 puis quantifier
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True
                )
                # Quantification dynamique
                self.models[model_type] = torch.quantization.quantize_dynamic(
                    model, {torch.nn.Linear}, dtype=torch.qint8
                )
            except Exception as e:
                logger.warning(f"⚠️ Quantification int8 non supportée: {e}")
                logger.info("🔄 Fallback vers float32")
                self.quantization_level = "float32"
                self.models[model_type] = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True
                )
        else:
            # Standard float32
            self.models[model_type] = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True
            )
        
        # Mesurer l'utilisation mémoire
        if torch.cuda.is_available():
            self.stats['memory_usage_mb'] = torch.cuda.memory_allocated() / 1024 / 1024
        else:
            import psutil
            process = psutil.Process()
            self.stats['memory_usage_mb'] = process.memory_info().rss / 1024 / 1024
    
    async def translate(self, text: str, source_language: str, target_language: str, model_type: str = None, source_channel: str = "quantized") -> Dict[str, Any]:
        """
        Traduit un texte (interface compatible avec UnifiedMLService)
        """
        if model_type is None:
            model_type = self.model_type
            
        start_time = time.time()
        
        try:
            # Vérifier que le modèle est chargé
            if model_type not in self.models:
                raise Exception(f"Modèle {model_type} non chargé")
            
            # Effectuer la traduction
            translated_text = await self._ml_translate(text, source_language, target_language, model_type)
            
            processing_time = time.time() - start_time
            
            # Mettre à jour les stats
            self.stats['translations_count'] += 1
            self.stats['avg_processing_time'] = (
                (self.stats['avg_processing_time'] * (self.stats['translations_count'] - 1) + processing_time) 
                / self.stats['translations_count']
            )
            
            # Retourner le résultat au format UnifiedMLService
            return {
                'translated_text': translated_text,
                'detected_language': source_language,
                'confidence': 0.95,
                'model_used': f"{model_type}_{self.quantization_level}",
                'from_cache': False,
                'processing_time': processing_time,
                'source_channel': source_channel
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction quantifiée: {e}")
            processing_time = time.time() - start_time
            
            return {
                'translated_text': f"[QUANTIZED-ERROR] {text}",
                'detected_language': source_language,
                'confidence': 0.0,
                'model_used': f"{model_type}_{self.quantization_level}_error",
                'from_cache': False,
                'processing_time': processing_time,
                'source_channel': source_channel,
                'error': str(e)
            }
    
    async def _ml_translate(self, text: str, source_language: str, target_language: str, model_type: str) -> str:
        """Traduction avec le modèle quantifié (comme UnifiedMLService)"""
        def translate_sync():
            try:
                import gc
                import torch
                from transformers import pipeline
                
                # Nettoyage de la mémoire avant traduction
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                # Récupérer le modèle et tokenizer
                model = self.models[model_type]
                tokenizer = self.tokenizers[model_type]
                model_name = self.model_configs[model_type]['model_name']
                
                # Créer le pipeline selon le type de modèle
                if "t5" in model_name.lower():
                    # T5: utiliser text2text-generation
                    # Ne pas spécifier device si accelerate est utilisé
                    try:
                        import accelerate
                        # Pas de device avec accelerate
                        pipe = pipeline(
                            "text2text-generation",
                            model=model,
                            tokenizer=tokenizer,
                            max_length=128
                        )
                    except ImportError:
                        # Device spécifié si pas d'accelerate
                        pipe = pipeline(
                            "text2text-generation",
                            model=model,
                            tokenizer=tokenizer,
                            device=0 if torch.cuda.is_available() else -1,
                            max_length=128
                        )
                    
                    # Format T5
                    source_name = self.language_names.get(source_language, source_language.capitalize())
                    target_name = self.language_names.get(target_language, target_language.capitalize())
                    instruction = f"translate {source_name} to {target_name}: {text}"
                    
                    result = pipe(instruction, max_new_tokens=64)
                    
                    if result and len(result) > 0:
                        return result[0]['generated_text']
                    else:
                        return f"[T5-QUANTIZED-ERROR] {text}"
                        
                else:
                    # NLLB: utiliser translation
                    try:
                        import accelerate
                        # Pas de device avec accelerate
                        pipe = pipeline(
                            "translation",
                            model=model,
                            tokenizer=tokenizer,
                            max_length=256
                        )
                    except ImportError:
                        # Device spécifié si pas d'accelerate
                        pipe = pipeline(
                            "translation",
                            model=model,
                            tokenizer=tokenizer,
                            device=0 if torch.cuda.is_available() else -1,
                            max_length=256
                        )
                    
                    # Codes de langue NLLB
                    nllb_source = self.lang_codes.get(source_language, 'eng_Latn')
                    nllb_target = self.lang_codes.get(target_language, 'fra_Latn')
                    
                    result = pipe(text, src_lang=nllb_source, tgt_lang=nllb_target)
                    
                    if result and len(result) > 0:
                        return result[0]['translation_text']
                    else:
                        return f"[NLLB-QUANTIZED-ERROR] {text}"
                        
            except Exception as e:
                logger.error(f"Erreur pipeline quantifié {model_name}: {e}")
                return f"[ML-Pipeline-Error] {text}"
        
        # Utiliser le thread pool pour la traduction (comme UnifiedMLService)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, translate_sync)
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques de performance"""
        return {
            **self.stats,
            'model_type': self.model_type,
            'quantization_level': self.quantization_level
        }
    
    def get_available_models(self) -> list:
        """Retourne les modèles disponibles (comme UnifiedMLService)"""
        return list(self.models.keys())
    
    async def cleanup(self):
        """Nettoie les ressources"""
        if self.models:
            for model in self.models.values():
                del model
        if self.tokenizers:
            for tokenizer in self.tokenizers.values():
                del tokenizer
        
        # Nettoyer la mémoire
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        self.executor.shutdown(wait=True)
