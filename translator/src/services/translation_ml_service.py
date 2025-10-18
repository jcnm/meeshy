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

# Import des modèles ML optimisés
try:
    import torch
    
    # SOLUTION: Désactiver les tensors meta avant d'importer les autres modules
    torch._C._disable_meta = True  # Désactiver les tensors meta au niveau PyTorch
    
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
    ML_AVAILABLE = True
    
    # Suppression des warnings de retry Xet
    import warnings
    warnings.filterwarnings("ignore", message=".*Retry attempt.*")
    warnings.filterwarnings("ignore", message=".*reqwest.*")
    warnings.filterwarnings("ignore", message=".*xethub.*")
    warnings.filterwarnings("ignore", message=".*IncompleteMessage.*")
    warnings.filterwarnings("ignore", message=".*SendRequest.*")
    
except ImportError:
    ML_AVAILABLE = False
    print("⚠️ Dependencies ML non disponibles")

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

class TranslationMLService:
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
    
    def __init__(self, settings, model_type: str = "all", max_workers: int = 4, quantization_level: str = "float16"):
        if self._initialized:
            return
            
        # Charger les settings
        self.settings = settings
        
        self.model_type = model_type
        # OPTIMISATION CPU: Limiter les workers pour éviter le context switching
        # Sur CPU, 2-4 workers suffisent largement
        import os
        cpu_workers = min(max_workers, int(os.getenv('ML_MAX_WORKERS', '4')))
        self.max_workers = cpu_workers
        self.quantization_level = quantization_level
        self.executor = ThreadPoolExecutor(max_workers=cpu_workers)
        
        # Modèles ML chargés (partagés entre tous les canaux)
        self.models = {}
        self.tokenizers = {}
        self.pipelines = {}
        
        # Cache thread-local de tokenizers pour éviter "Already borrowed"
        self._thread_local_tokenizers = {}
        self._tokenizer_lock = threading.Lock()
        
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
        self._configure_environment()
        logger.info(f"🤖 Service ML Unifié créé (Singleton) avec {max_workers} workers")
    
    def _configure_environment(self):
        """Configure les variables d'environnement basées sur les settings"""
        import os
        
        # OPTIMISATION XET: Configuration pour réduire les warnings du nouveau système
        os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
        os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
        os.environ['TOKENIZERS_PARALLELISM'] = 'false'
        
        # OPTIMISATION RÉSEAU: Configuration pour améliorer la connectivité Docker
        os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '1'
        os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = str(self.settings.huggingface_timeout)
        os.environ['HF_HUB_DOWNLOAD_RETRY_DELAY'] = '5'
        os.environ['HF_HUB_DOWNLOAD_MAX_RETRIES'] = str(self.settings.model_download_max_retries)
        
        # SOLUTION: Désactiver les tensors meta pour éviter l'erreur Tensor.item()
        os.environ['PYTORCH_DISABLE_META'] = '1'
        os.environ['PYTORCH_FORCE_CUDA'] = '0'  # Forcer CPU si pas de GPU
        os.environ['PYTORCH_NO_CUDA_MEMORY_CACHING'] = '1'
        
        # Configuration pour éviter les problèmes de proxy/corporate network
        # Vérifier si le fichier de certificats existe, sinon utiliser le système par défaut
        if os.path.exists('/etc/ssl/certs/ca-certificates.crt'):
            os.environ['REQUESTS_CA_BUNDLE'] = '/etc/ssl/certs/ca-certificates.crt'
            os.environ['CURL_CA_BUNDLE'] = '/etc/ssl/certs/ca-certificates.crt'
        elif os.path.exists('/etc/ssl/certs/ca-bundle.crt'):
            os.environ['REQUESTS_CA_BUNDLE'] = '/etc/ssl/certs/ca-bundle.crt'
            os.environ['CURL_CA_BUNDLE'] = '/etc/ssl/certs/ca-bundle.crt'
        else:
            # Utiliser le système par défaut
            logger.info("⚠️ Fichier de certificats SSL non trouvé, utilisation du système par défaut")
        
        # Option pour désactiver temporairement la vérification SSL si nécessaire
        if os.getenv('HF_HUB_DISABLE_SSL_VERIFICATION', '0') == '1':
            os.environ['REQUESTS_CA_BUNDLE'] = ''
            os.environ['CURL_CA_BUNDLE'] = ''
            logger.info("⚠️ Vérification SSL désactivée pour Hugging Face (HF_HUB_DISABLE_SSL_VERIFICATION=1)")
    
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
    
    def _get_thread_local_tokenizer(self, model_type: str) -> Optional[AutoTokenizer]:
        """Obtient ou crée un tokenizer pour le thread actuel (évite 'Already borrowed')"""
        import threading
        thread_id = threading.current_thread().ident
        cache_key = f"{model_type}_{thread_id}"
        
        # Vérifier le cache thread-local
        if cache_key in self._thread_local_tokenizers:
            return self._thread_local_tokenizers[cache_key]
        
        # Créer un nouveau tokenizer pour ce thread
        with self._tokenizer_lock:
            # Double-check après acquisition du lock
            if cache_key in self._thread_local_tokenizers:
                return self._thread_local_tokenizers[cache_key]
            
            try:
                model_name = self.model_configs[model_type]['model_name']
                tokenizer = AutoTokenizer.from_pretrained(
                    model_name,
                    cache_dir=str(self.models_path),
                    use_fast=True
                )
                self._thread_local_tokenizers[cache_key] = tokenizer
                logger.debug(f"✅ Tokenizer thread-local créé: {cache_key}")
                return tokenizer
            except Exception as e:
                logger.error(f"❌ Erreur création tokenizer thread-local: {e}")
                return None
    
    async def _load_model(self, model_type: str):
        """Charge un modèle spécifique depuis local ou HuggingFace"""
        if model_type in self.models:
            return  # Déjà chargé
        
        config = self.model_configs[model_type]
        model_name = config['model_name']
        local_path = config['local_path']
        device = config['device']
        
        logger.info(f"📥 Chargement {model_type}: {model_name}")
        
        # Charger dans un thread pour éviter de bloquer
        def load_model():
            try:
                # Tokenizer
                tokenizer = AutoTokenizer.from_pretrained(
                    model_name, 
                    cache_dir=str(self.models_path),
                    use_fast=True,  # Tokenizer rapide
                    model_max_length=512  # Limiter la taille
                )
                
                # Modèle avec quantification
                # OPTIMISATION CPU: Utiliser float32 au lieu de float16 sur CPU pour éviter les erreurs
                # et améliorer la compatibilité. Sur CPU, float16 n'apporte pas d'accélération.
                dtype = torch.float32 if device == "cpu" else (
                    getattr(torch, self.quantization_level) if hasattr(torch, self.quantization_level) else torch.float32
                )
                
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    cache_dir=str(self.models_path), 
                    torch_dtype=dtype,
                    low_cpu_mem_usage=True,  # Optimisation mémoire
                    device_map="auto" if device == "cuda" else None
                )
                
                # OPTIMISATION CPU: Mettre le modèle en mode eval pour désactiver dropout
                model.eval()
                
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
            logger.info(f"✅ Modèle {model_type} chargé: {model_name}")
            if local_path.exists():
                logger.info(f"📁 Modèle disponible en local: {local_path}")
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
        """Traduction avec le vrai modèle ML - tokenizers thread-local pour éviter 'Already borrowed'"""
        try:
            if model_type not in self.models:
                raise Exception(f"Modèle {model_type} non chargé")
            
            # CORRECTION: Sauvegarder le model_name original pour éviter les collisions dans la boucle de fallback
            original_model_name = self.model_configs[model_type]['model_name']
            
            # Traduction dans un thread - OPTIMISATION: tokenizer thread-local caché
            def translate():
                try:
                    from transformers import pipeline
                    import threading
                    
                    # Modèle partagé (thread-safe en lecture)
                    shared_model = self.models[model_type]
                    
                    # OPTIMISATION: Utiliser le tokenizer thread-local caché (évite recréation)
                    thread_tokenizer = self._get_thread_local_tokenizer(model_type)
                    if thread_tokenizer is None:
                        raise Exception(f"Impossible d'obtenir le tokenizer pour {model_type}")
                    
                    # Différencier T5 et NLLB avec pipelines appropriés
                    if "t5" in original_model_name.lower():
                        # T5: utiliser text2text-generation avec tokenizer thread-local
                        # OPTIMISATION CPU: Réduire max_length pour accélérer les inférences
                        temp_pipeline = pipeline(
                            "text2text-generation",
                            model=shared_model,
                            tokenizer=thread_tokenizer,  # ← TOKENIZER THREAD-LOCAL
                            device=0 if self.device == 'cuda' and torch.cuda.is_available() else -1,
                            max_length=64,  # Réduit de 128 à 64 pour la vitesse
                            batch_size=1  # Traiter un texte à la fois sur CPU
                        )
                        
                        # T5: format avec noms complets de langues
                        source_name = self.language_names.get(source_lang, source_lang.capitalize())
                        target_name = self.language_names.get(target_lang, target_lang.capitalize())
                        instruction = f"translate {source_name} to {target_name}: {text}"
                        
                        logger.debug(f"T5 instruction: {instruction}")
                        
                        # OPTIMISATION CPU: Réduire num_beams pour accélérer considérablement
                        # num_beams=1 (greedy) est 4x plus rapide que num_beams=4
                        result = temp_pipeline(
                            instruction,
                            max_new_tokens=32,  # Réduit de 64 à 32
                            num_beams=1,  # Réduit de 4 à 1 (greedy search = 4x plus rapide)
                            do_sample=False,
                            early_stopping=True,
                            repetition_penalty=1.1,
                            length_penalty=1.0
                        )
                        
                        # T5 retourne generated_text
                        t5_success = False
                        translated = None  # CORRECTION: Initialiser translated pour éviter UnboundLocalError
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
                                
                            # Validation: vérifier si T5 a vraiment traduit (pas juste répété l'instruction)
                            # Rejeter SEULEMENT si:
                            # 1. Vide
                            # 2. Identique à l'original
                            # 3. Contient l'instruction complète T5 (ex: "translate French to Spanish:")
                            has_instruction = f"translate {source_name} to {target_name}:" in translated.lower()
                            
                            if not translated or translated.lower() == text.lower() or has_instruction:
                                logger.warning(f"T5 traduction invalide: '{translated}', fallback vers NLLB")
                                t5_success = False
                            else:
                                t5_success = True
                                
                        # Si T5 échoue, fallback automatique vers NLLB
                        if not t5_success:
                            logger.info(f"🔄 Fallback automatique: T5 → NLLB pour {source_lang}→{target_lang}")
                            # Nettoyer le pipeline T5 (tokenizer reste en cache)
                            del temp_pipeline
                            
                            # CORRECTION: Chercher un modèle NLLB parmi les modèles chargés
                            # Les clés sont 'basic', 'medium', 'premium', pas les noms de modèles
                            nllb_model_type = None
                            nllb_model_name = None
                            
                            # Chercher medium ou premium (qui sont des modèles NLLB)
                            # CORRECTION: Utiliser un nom de variable différent pour éviter la collision
                            for fallback_model_type in ['medium', 'premium']:
                                if fallback_model_type in self.models:
                                    config = self.model_configs.get(fallback_model_type, {})
                                    fallback_model_name = config.get('model_name', '')
                                    if 'nllb' in fallback_model_name.lower():
                                        nllb_model_type = fallback_model_type
                                        nllb_model_name = fallback_model_name
                                        break
                            
                            if nllb_model_type is None:
                                logger.warning(f"Modèle NLLB non chargé, impossible de faire le fallback")
                                translated = f"[Translation-Failed] {text}"
                            else:
                                nllb_model = self.models[nllb_model_type]
                                # OPTIMISATION: Utiliser tokenizer thread-local caché
                                nllb_tokenizer = self._get_thread_local_tokenizer(nllb_model_type)
                                if nllb_tokenizer is None:
                                    logger.warning(f"Impossible d'obtenir tokenizer NLLB")
                                    translated = f"[Translation-Failed] {text}"
                                    return translated
                                
                                # OPTIMISATION CPU: Paramètres optimisés pour la vitesse
                                nllb_pipeline = pipeline(
                                    "translation",
                                    model=nllb_model,
                                    tokenizer=nllb_tokenizer,
                                    device=0 if self.device == 'cuda' and torch.cuda.is_available() else -1,
                                    max_length=64,  # Réduit de 128 à 64
                                    batch_size=1  # Traiter un texte à la fois sur CPU
                                )
                                
                                nllb_source = self.lang_codes.get(source_lang, 'eng_Latn')
                                nllb_target = self.lang_codes.get(target_lang, 'fra_Latn')
                                
                                nllb_result = nllb_pipeline(
                                    text, 
                                    src_lang=nllb_source, 
                                    tgt_lang=nllb_target, 
                                    max_length=64,  # Réduit de 128 à 64
                                    num_beams=1,  # Greedy search = 4x plus rapide
                                    early_stopping=True
                                )
                                
                                if nllb_result and len(nllb_result) > 0 and 'translation_text' in nllb_result[0]:
                                    translated = nllb_result[0]['translation_text']
                                    logger.info(f"✅ Fallback NLLB réussi: '{text}' → '{translated}'")
                                else:
                                    translated = f"[NLLB-Fallback-Failed] {text}"
                                
                                # Nettoyer le pipeline (tokenizer reste en cache)
                                del nllb_pipeline
                            
                            return translated
                            
                    else:
                        # NLLB: utiliser translation avec tokenizer thread-local
                        # OPTIMISATION CPU: Réduire max_length et batch_size
                        temp_pipeline = pipeline(
                            "translation",
                            model=shared_model,
                            tokenizer=thread_tokenizer,  # ← TOKENIZER THREAD-LOCAL
                            device=0 if self.device == 'cuda' and torch.cuda.is_available() else -1,
                            max_length=64,  # Réduit de 128 à 64
                            batch_size=1  # Traiter un texte à la fois sur CPU
                        )
                        
                        # NLLB: codes de langue spéciaux
                        nllb_source = self.lang_codes.get(source_lang, 'eng_Latn')
                        nllb_target = self.lang_codes.get(target_lang, 'fra_Latn')
                        
                        # OPTIMISATION CPU: Paramètres optimisés pour la vitesse
                        result = temp_pipeline(
                            text, 
                            src_lang=nllb_source, 
                            tgt_lang=nllb_target, 
                            max_length=64,  # Réduit de 128 à 64
                            num_beams=1,  # Greedy search = 4x plus rapide
                            early_stopping=True
                        )
                        
                        # NLLB retourne translation_text
                        if result and len(result) > 0 and 'translation_text' in result[0]:
                            translated = result[0]['translation_text']
                        else:
                            translated = f"[NLLB-No-Result] {text}"
                    
                    # Nettoyer tokenizer et pipeline temporaires
                    del thread_tokenizer
                    del temp_pipeline
                    
                    return translated
                    
                except Exception as e:
                    logger.error(f"Erreur pipeline {original_model_name}: {e}")
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
def get_unified_ml_service(max_workers: int = 4) -> TranslationMLService:
    """Retourne l'instance unique du service ML"""
    return TranslationMLService(get_settings(), max_workers=max_workers)
