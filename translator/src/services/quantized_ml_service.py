"""
Service de traduction ML quantifié - Version optimisée
Optimisations: Réduction des boucles, cache intelligent, chargement concurrent
"""

import os
import logging
import time
import asyncio
from typing import Dict, Optional, Any, Set, Tuple
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from functools import lru_cache
import threading

# Import des settings
from config.settings import get_settings

# Import des utilitaires de gestion des modèles
from utils.model_utils import create_model_manager

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
    Service de traduction ML quantifié optimisé
    - Réduction drastique des boucles
    - Chargement concurrent des modèles
    - Cache intelligent pour les configurations
    - Optimisations mémoire
    """
    
    def __init__(self, model_type: str = "basic", quantization_level: str = "float16", max_workers: int = 4):
        self.settings = get_settings()
        self.model_type = model_type
        self.quantization_level = quantization_level
        self.max_workers = max_workers
        
        # Gestionnaire de modèles
        self.model_manager = create_model_manager(self.settings.models_path)
        
        # Cache des configurations avec lazy loading
        self._model_configs = None
        self._shared_models_analysis = None
        
        # Modèles et états
        self.models = {}
        self.tokenizers = {}
        self.shared_models = {}
        self.model_to_shared = {}
        
        # Thread pool optimisé
        self.executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="MLQuantized"
        )
        
        # Stats optimisées
        self.stats = {
            'translations_count': 0,
            'avg_processing_time': 0.0,
            'memory_usage_mb': 0.0,
            'quantization_level': quantization_level,
            'models_loaded': False,
            'shared_models_count': 0,
            'memory_saved_mb': 0.0,
            'cache_hits': 0,
            'concurrent_loads': 0
        }
        
        # Caches pour éviter les recalculs
        self._lang_codes_cache = None
        self._language_names_cache = None
        
        logger.info(f"🤖 Service ML Quantifié Optimisé créé: {model_type} avec {quantization_level}")
    
    @property
    def model_configs(self) -> Dict:
        """Configuration des modèles avec cache lazy"""
        if self._model_configs is None:
            self._model_configs = {
                'basic': {
                    'model_name': self.settings.basic_model,
                    'description': f'{self.settings.basic_model} quantifié',
                    'max_length': 128
                },
                'medium': {
                    'model_name': self.settings.medium_model,
                    'description': f'{self.settings.medium_model} quantifié',
                    'max_length': 256
                },
                'premium': {
                    'model_name': self.settings.premium_model,
                    'description': f'{self.settings.premium_model} quantifié',
                    'max_length': 512
                }
            }
        return self._model_configs
    
    @property
    def lang_codes(self) -> Dict:
        """Codes de langues avec cache"""
        if self._lang_codes_cache is None:
            self._lang_codes_cache = {
                'fr': 'fra_Latn', 'en': 'eng_Latn', 'es': 'spa_Latn', 'de': 'deu_Latn',
                'pt': 'por_Latn', 'zh': 'zho_Hans', 'ja': 'jpn_Jpan', 'ar': 'arb_Arab'
            }
        return self._lang_codes_cache
    
    @property
    def language_names(self) -> Dict:
        """Noms de langues avec cache"""
        if self._language_names_cache is None:
            self._language_names_cache = {
                'fr': 'French', 'en': 'English', 'es': 'Spanish', 'de': 'German',
                'pt': 'Portuguese', 'zh': 'Chinese', 'ja': 'Japanese', 'ar': 'Arabic'
            }
        return self._language_names_cache
    
    @lru_cache(maxsize=1)
    def _get_shared_models_analysis(self) -> Tuple[Dict[str, list], Set[str]]:
        """Analyse des modèles partagés avec cache LRU"""
        model_name_to_types = defaultdict(list)
        
        # Une seule boucle pour construire le mapping
        for model_type, config in self.model_configs.items():
            model_name_to_types[config['model_name']].append(model_type)
        
        # Identifier les modèles partagés en une passe
        shared_models_info = {
            model_name: types for model_name, types in model_name_to_types.items() 
            if len(types) > 1
        }
        
        unique_model_names = set(model_name_to_types.keys())
        
        return shared_models_info, unique_model_names
    
    async def initialize(self) -> bool:
        """Initialisation optimisée avec chargement concurrent"""
        if not ML_AVAILABLE:
            logger.error("❌ Dependencies ML non disponibles")
            return False
        
        try:
            logger.info(f"🚀 Initialisation optimisée: {self.model_type} ({self.quantization_level})")
            
            # Nettoyer les téléchargements incomplets
            cleaned = self.model_manager.cleanup_incomplete_downloads()
            if cleaned > 0:
                logger.info(f"🧹 {cleaned} téléchargement(s) incomplet(s) nettoyé(s)")
            
            if self.model_type == "all":
                # Chargement concurrent de tous les modèles
                await self._load_all_models_concurrently()
            else:
                # Chargement optimisé d'un modèle avec fallback
                await self._load_model_with_optimized_fallback()
            
            self.stats['models_loaded'] = True
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation optimisée: {e}")
            return False
    
    async def _load_all_models_concurrently(self):
        """Charge tous les modèles de façon concurrente avec vérification préalable"""
        shared_models_info, _ = self._get_shared_models_analysis()
        
        # Vérifier et télécharger les modèles manquants
        await self._ensure_models_available()
        
        # Créer les tâches de chargement
        load_tasks = []
        processed_models = set()
        
        for model_type, config in self.model_configs.items():
            model_name = config['model_name']
            
            if model_name in shared_models_info and model_name not in processed_models:
                # Charger comme modèle partagé
                task = asyncio.create_task(
                    self._load_shared_model_async(model_name, shared_models_info[model_name])
                )
                load_tasks.append(task)
                processed_models.add(model_name)
            elif model_name not in shared_models_info:
                # Charger comme modèle unique
                task = asyncio.create_task(
                    self._load_unique_model_async(model_name, model_type)
                )
                load_tasks.append(task)
        
        # Attendre tous les chargements en parallèle
        if load_tasks:
            self.stats['concurrent_loads'] = len(load_tasks)
            results = await asyncio.gather(*load_tasks, return_exceptions=True)
            
            # Vérifier les résultats
            failed_loads = [r for r in results if isinstance(r, Exception)]
            if failed_loads:
                logger.warning(f"⚠️ {len(failed_loads)} chargements échoués sur {len(results)}")
            
            logger.info(f"✅ Chargement concurrent terminé: {len(results) - len(failed_loads)}/{len(results)} succès")
    
    async def _ensure_models_available(self):
        """Vérifie et télécharge les modèles manquants"""
        logger.info("🔍 Vérification de la disponibilité des modèles...")
        
        # Récupérer tous les modèles nécessaires
        model_names = set()
        for config in self.model_configs.values():
            model_names.add(config['model_name'])
        
        # Vérifier le statut de chaque modèle
        models_status = self.model_manager.get_models_status(list(model_names))
        
        # Identifier les modèles manquants
        missing_models = []
        for model_name, status in models_status.items():
            if not status['local']:
                missing_models.append(model_name)
                logger.info(f"📥 Modèle manquant: {model_name} ({status.get('size_mb', 0):.1f} MB)")
            else:
                logger.info(f"✅ Modèle disponible: {model_name}")
        
        # Télécharger les modèles manquants
        if missing_models:
            logger.info(f"🚀 Téléchargement de {len(missing_models)} modèle(s) manquant(s)...")
            
            download_tasks = []
            for model_name in missing_models:
                task = asyncio.create_task(
                    self._download_model_async(model_name)
                )
                download_tasks.append(task)
            
            # Attendre tous les téléchargements
            if download_tasks:
                results = await asyncio.gather(*download_tasks, return_exceptions=True)
                
                # Vérifier les résultats
                failed_downloads = [r for r in results if isinstance(r, Exception)]
                if failed_downloads:
                    logger.error(f"❌ {len(failed_downloads)} téléchargement(s) échoué(s)")
                    for error in failed_downloads:
                        logger.error(f"   - {error}")
                else:
                    logger.info(f"✅ Tous les modèles téléchargés avec succès")
        else:
            logger.info("✅ Tous les modèles sont disponibles localement")
    
    async def _download_model_async(self, model_name: str):
        """Télécharge un modèle de façon asynchrone"""
        try:
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(
                self.executor,
                self.model_manager.download_model_if_needed,
                model_name,
                False  # force_download
            )
            
            if not success:
                raise Exception(f"Échec du téléchargement de {model_name}")
                
        except Exception as e:
            logger.error(f"❌ Erreur téléchargement {model_name}: {e}")
            raise
    
    async def _load_model_with_optimized_fallback(self):
        """Fallback optimisé sans boucles multiples avec vérification préalable"""
        fallback_order = ['basic', 'medium', 'premium']
        
        # Vérifier et télécharger les modèles manquants
        await self._ensure_models_available()
        
        # Calculer les modèles candidats en une seule passe
        try:
            user_index = fallback_order.index(self.model_type)
            candidate_models = fallback_order[user_index::-1]  # Du demandé vers le plus léger
        except ValueError:
            candidate_models = fallback_order
        
        # Essayer les candidats séquentiellement (nécessaire pour le fallback)
        last_error = None
        for model_type in candidate_models:
            if model_type not in self.model_configs:
                continue
                
            try:
                await self._load_model_with_sharing_optimized(model_type)
                if model_type != self.model_type:
                    logger.info(f"🔄 Fallback vers {model_type} (demandé: {self.model_type})")
                    self.model_type = model_type
                return
            except Exception as e:
                last_error = e
                logger.warning(f"⚠️ Échec {model_type}: {e}")
        
        raise Exception(f"Aucun modèle chargeable: {last_error}")
    
    async def _load_model_with_sharing_optimized(self, model_type: str):
        """Chargement optimisé avec gestion du partage"""
        config = self.model_configs[model_type]
        model_name = config['model_name']
        
        # Vérifier le cache partagé
        if model_name in self.shared_models:
            self._link_to_shared_model(model_name, model_type)
            return
        
        shared_models_info, _ = self._get_shared_models_analysis()
        
        if model_name in shared_models_info:
            # Charger comme modèle partagé
            await self._load_shared_model_async(model_name, shared_models_info[model_name])
        else:
            # Charger comme modèle unique
            await self._load_unique_model_async(model_name, model_type)
    
    def _link_to_shared_model(self, model_name: str, model_type: str):
        """Lie un type de modèle à un modèle partagé existant"""
        self.shared_models[model_name]['users'].add(model_type)
        self.model_to_shared[model_type] = model_name
        self.models[model_type] = self.shared_models[model_name]['model']
        self.tokenizers[model_type] = self.shared_models[model_name]['tokenizer']
        self.stats['cache_hits'] += 1
        logger.info(f"🔗 {model_type} lié au modèle partagé {model_name}")
    
    async def _load_shared_model_async(self, model_name: str, model_types: list):
        """Charge un modèle partagé de façon asynchrone"""
        logger.info(f"📥 Chargement modèle partagé: {model_name} pour {model_types}")
        
        try:
            model, tokenizer = await self._load_model_and_tokenizer_optimized(model_name)
            
            # Créer l'entrée partagée
            self.shared_models[model_name] = {
                'model': model,
                'tokenizer': tokenizer,
                'users': set(model_types),
                'loaded_at': time.time()
            }
            
            # Lier tous les types en une passe
            for model_type in model_types:
                self.model_to_shared[model_type] = model_name
                self.models[model_type] = model
                self.tokenizers[model_type] = tokenizer
            
            logger.info(f"✅ Modèle partagé chargé: {model_name}")
            
        except Exception as e:
            logger.error(f"❌ Erreur modèle partagé {model_name}: {e}")
            raise
    
    async def _load_unique_model_async(self, model_name: str, model_type: str):
        """Charge un modèle unique de façon asynchrone"""
        logger.info(f"📥 Chargement modèle unique: {model_type} ({model_name})")
        
        try:
            model, tokenizer = await self._load_model_and_tokenizer_optimized(model_name)
            self.models[model_type] = model
            self.tokenizers[model_type] = tokenizer
            logger.info(f"✅ Modèle unique chargé: {model_type}")
            
        except Exception as e:
            logger.error(f"❌ Erreur modèle unique {model_type}: {e}")
            raise
    
    async def _load_model_and_tokenizer_optimized(self, model_name: str) -> Tuple:
        """Chargement optimisé depuis le stockage local"""
        try:
            loop = asyncio.get_event_loop()
            model, tokenizer = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    self.model_manager.load_model_locally,
                    model_name,
                    self.quantization_level
                ),
                timeout=self.settings.model_load_timeout
            )
            return model, tokenizer
            
        except asyncio.TimeoutError:
            raise Exception(f"Timeout chargement modèle {model_name} après {self.settings.model_load_timeout}s")
        except Exception as e:
            raise Exception(f"Erreur chargement modèle {model_name}: {e}")
    

    
    async def translate(self, text: str, source_language: str, target_language: str, 
                       model_type: str = None, source_channel: str = "quantized") -> Dict[str, Any]:
        """Traduction optimisée avec fallback intelligent"""
        if model_type is None:
            model_type = self.model_type
        
        start_time = time.time()
        
        try:
            # Fallback optimisé sans boucles multiples
            best_model = self._find_best_available_model(model_type)
            if best_model != model_type:
                logger.info(f"🔄 Utilisation modèle {best_model} au lieu de {model_type}")
            
            # Traduction
            translated_text = await self._ml_translate_optimized(
                text, source_language, target_language, best_model
            )
            
            # Mise à jour des stats optimisée
            processing_time = time.time() - start_time
            self._update_stats(processing_time)
            
            return {
                'translated_text': translated_text,
                'detected_language': source_language,
                'confidence': 0.95,
                'model_used': f"{best_model}_{self.quantization_level}",
                'from_cache': False,
                'processing_time': processing_time,
                'source_channel': source_channel
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction: {e}")
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
    
    def _find_best_available_model(self, requested_model: str) -> str:
        """Trouve le meilleur modèle disponible sans boucles multiples"""
        if requested_model in self.models:
            return requested_model
        
        # Ordre de qualité décroissante
        quality_order = ['premium', 'medium', 'basic']
        
        try:
            requested_index = quality_order.index(requested_model)
            # Chercher depuis le modèle demandé vers les moins performants
            candidates = quality_order[requested_index:]
        except ValueError:
            candidates = quality_order
        
        # Retourner le premier modèle disponible
        for model_type in candidates:
            if model_type in self.models:
                return model_type
        
        raise Exception(f"Aucun modèle disponible pour {requested_model}")
    
    def _update_stats(self, processing_time: float):
        """Mise à jour optimisée des statistiques"""
        count = self.stats['translations_count']
        self.stats['translations_count'] = count + 1
        
        # Moyenne mobile optimisée
        if count > 0:
            current_avg = self.stats['avg_processing_time']
            self.stats['avg_processing_time'] = (current_avg * count + processing_time) / (count + 1)
        else:
            self.stats['avg_processing_time'] = processing_time
    
    async def _ml_translate_optimized(self, text: str, source_language: str, 
                                    target_language: str, model_type: str) -> str:
        """Traduction ML optimisée"""
        def translate_sync():
            try:
                # Nettoyage mémoire optimisé
                self._cleanup_memory()
                
                model = self.models[model_type]
                tokenizer = self.tokenizers[model_type]
                model_name = self.model_configs[model_type]['model_name']
                
                # Détection automatique du type de modèle
                is_t5_model = "t5" in model_name.lower()
                
                # Configuration du pipeline optimisée
                pipeline_config = self._get_pipeline_config(model, tokenizer, is_t5_model)
                
                if is_t5_model:
                    return self._translate_t5(pipeline_config, text, source_language, target_language)
                else:
                    return self._translate_nllb(pipeline_config, text, source_language, target_language)
                    
            except Exception as e:
                logger.error(f"❌ Erreur pipeline: {e}")
                return f"[ML-Error] {text}"
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, translate_sync)
    
    def _cleanup_memory(self):
        """Nettoyage mémoire optimisé"""
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    def _get_pipeline_config(self, model, tokenizer, is_t5_model: bool) -> Dict:
        """Configuration optimisée du pipeline"""
        config = {
            'model': model,
            'tokenizer': tokenizer,
            'max_length': 256 if not is_t5_model else 128
        }
        
        # Device automatique si pas d'accelerate
        try:
            import accelerate
        except ImportError:
            config['device'] = 0 if torch.cuda.is_available() else -1
        
        return config
    
    def _translate_t5(self, pipeline_config: Dict, text: str, source_lang: str, target_lang: str) -> str:
        """Traduction T5 optimisée"""
        pipe = pipeline("text2text-generation", **pipeline_config)
        
        source_name = self.language_names.get(source_lang, source_lang.capitalize())
        target_name = self.language_names.get(target_lang, target_lang.capitalize())
        instruction = f"translate {source_name} to {target_name}: {text}"
        
        result = pipe(instruction, max_new_tokens=64)
        return result[0]['generated_text'] if result else f"[T5-Error] {text}"
    
    def _translate_nllb(self, pipeline_config: Dict, text: str, source_lang: str, target_lang: str) -> str:
        """Traduction NLLB optimisée"""
        pipe = pipeline("translation", **pipeline_config)
        
        nllb_source = self.lang_codes.get(source_lang, 'eng_Latn')
        nllb_target = self.lang_codes.get(target_lang, 'fra_Latn')
        
        result = pipe(text, src_lang=nllb_source, tgt_lang=nllb_target)
        return result[0]['translation_text'] if result else f"[NLLB-Error] {text}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Stats optimisées avec calculs en cache"""
        shared_models_count = len(self.shared_models)
        unique_models = len(set(self.model_to_shared.values())) + len([
            t for t in self.models.keys() if t not in self.model_to_shared
        ])
        
        return {
            **self.stats,
            'model_type': self.model_type,
            'shared_models_count': shared_models_count,
            'unique_models_loaded': unique_models,
            'models_saved': len(self.model_configs) - unique_models,
            'optimization_ratio': f"{unique_models}/{len(self.model_configs)}"
        }
    
    def get_available_models(self) -> list:
        """Retourne les modèles disponibles"""
        return list(self.models.keys())
    
    async def cleanup(self):
        """Nettoyage optimisé"""
        logger.info("🧹 Nettoyage optimisé des ressources")
        
        # Nettoyage groupé des ressources
        resources_to_clean = [
            (self.shared_models, "modèles partagés"),
            (self.models, "modèles"),
            (self.tokenizers, "tokenizers")
        ]
        
        for resource_dict, resource_type in resources_to_clean:
            if resource_dict:
                logger.info(f"🧹 Nettoyage {len(resource_dict)} {resource_type}")
                resource_dict.clear()
        
        # Nettoyage des mappings
        self.model_to_shared.clear()
        
        # Nettoyage mémoire et thread pool
        self._cleanup_memory()
        self.executor.shutdown(wait=True)
        
        logger.info("✅ Nettoyage optimisé terminé")
    
    def get_models_status(self) -> Dict[str, Dict]:
        """Retourne le statut détaillé de tous les modèles"""
        model_names = set()
        for config in self.model_configs.values():
            model_names.add(config['model_name'])
        
        return self.model_manager.get_models_status(list(model_names))
    
    def get_model_path(self, model_name: str) -> str:
        """Retourne le chemin local d'un modèle"""
        return str(self.model_manager.get_model_local_path(model_name))