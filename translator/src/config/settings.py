"""
Configuration du service de traduction Meeshy - Version simplifiée
"""

import os
from pathlib import Path

class Settings:
    """Configuration du service de traduction"""
    
    def __init__(self):
        # Configuration générale
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.workers = int(os.getenv("WORKERS", "4"))
        
        # Configuration des ports
        self.fastapi_port = int(os.getenv("FASTAPI_PORT", "8000"))
        self.grpc_port = int(os.getenv("GRPC_PORT", "50051"))
        self.zmq_port = int(os.getenv("ZMQ_PORT", "5555"))
        
        # Configuration base de données
        self.database_url = os.getenv("DATABASE_URL", "file:../shared/dev.db")
        self.prisma_pool_size = int(os.getenv("PRISMA_POOL_SIZE", "15"))
        
        # Configuration Redis (cache)
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.translation_cache_ttl = int(os.getenv("TRANSLATION_CACHE_TTL", "3600"))
        self.cache_max_entries = int(os.getenv("CACHE_MAX_ENTRIES", "10000"))
        
        # Configuration ML
        self.ml_batch_size = int(os.getenv("ML_BATCH_SIZE", "32"))
        self.gpu_memory_fraction = float(os.getenv("GPU_MEMORY_FRACTION", "0.8"))
        self.models_path = os.getenv("MODELS_PATH", "/Users/smpceo/Downloads/Meeshy/meeshy/public/models")
        
        # Configuration des langues
        self.default_language = os.getenv("DEFAULT_LANGUAGE", "fr")
        self.supported_languages = os.getenv("SUPPORTED_LANGUAGES", "fr,en,es,de,pt,zh,ja,ar")
        self.auto_detect_language = os.getenv("AUTO_DETECT_LANGUAGE", "true").lower() == "true"
        
        # Configuration des modèles de traduction - CORRIGÉ
        # T5-small fonctionne mieux que MT5-small pour la traduction
        self.basic_model = os.getenv("BASIC_MODEL", "t5-small")  # Corrigé: t5-small au lieu de mt5-small
        self.medium_model = os.getenv("MEDIUM_MODEL", "nllb-200-distilled-600M")
        self.premium_model = os.getenv("PREMIUM_MODEL", "nllb-200-distilled-1.3B")
        
        # Configuration des performances
        self.translation_timeout = int(os.getenv("TRANSLATION_TIMEOUT", "30"))
        self.max_text_length = int(os.getenv("MAX_TEXT_LENGTH", "1000"))
        self.concurrent_translations = int(os.getenv("CONCURRENT_TRANSLATIONS", "10"))
    
    @property
    def supported_languages_list(self):
        """Retourne la liste des langues supportées"""
        return [lang.strip() for lang in self.supported_languages.split(",")]

def get_settings():
    """Retourne une instance des paramètres"""
    return Settings()

# Mappings des langues pour les modèles
LANGUAGE_MAPPINGS = {
    # Codes ISO 639-1 vers codes modèles
    'fr': 'fra_Latn',
    'en': 'eng_Latn', 
    'es': 'spa_Latn',
    'de': 'deu_Latn',
    'pt': 'por_Latn',
    'zh': 'zho_Hans',
    'ja': 'jpn_Jpan',
    'ar': 'arb_Arab'
}

def get_model_language_code(iso_code: str) -> str:
    """Convertit un code ISO vers un code modèle"""
    return LANGUAGE_MAPPINGS.get(iso_code, iso_code)

def get_iso_language_code(model_code: str) -> str:
    """Convertit un code modèle vers un code ISO"""
    reverse_mapping = {v: k for k, v in LANGUAGE_MAPPINGS.items()}
    return reverse_mapping.get(model_code, model_code.split('_')[0] if '_' in model_code else model_code)

# Mappings des langues pour les modèles
LANGUAGE_MAPPINGS = {
    # Codes ISO 639-1 vers codes modèles
    'fr': 'fra_Latn',
    'en': 'eng_Latn', 
    'es': 'spa_Latn',
    'de': 'deu_Latn',
    'pt': 'por_Latn',
    'zh': 'zho_Hans',
    'ja': 'jpn_Jpan',
    'ar': 'arb_Arab'
}

def get_model_language_code(iso_code: str) -> str:
    """Convertit un code ISO vers un code modèle"""
    return LANGUAGE_MAPPINGS.get(iso_code, iso_code)

def get_iso_language_code(model_code: str) -> str:
    """Convertit un code modèle vers un code ISO"""
    reverse_mapping = {v: k for k, v in LANGUAGE_MAPPINGS.items()}
    return reverse_mapping.get(model_code, model_code.split('_')[0] if '_' in model_code else model_code)
