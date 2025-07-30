"""
Configuration du service de traduction Meeshy
"""

import os
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    """Configuration du service de traduction"""
    
    # Configuration générale
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    workers: int = int(os.getenv("WORKERS", "4"))
    
    # Configuration des ports
    fastapi_port: int = int(os.getenv("FASTAPI_PORT", "8000"))
    grpc_port: int = int(os.getenv("GRPC_PORT", "50051"))
    zmq_port: int = int(os.getenv("ZMQ_PORT", "5555"))
    
    # Configuration base de données
    database_url: str = os.getenv("DATABASE_URL", "file:../shared/dev.db")
    prisma_pool_size: int = int(os.getenv("PRISMA_POOL_SIZE", "15"))
    
    # Configuration Redis (cache)
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    translation_cache_ttl: int = int(os.getenv("TRANSLATION_CACHE_TTL", "3600"))
    cache_max_entries: int = int(os.getenv("CACHE_MAX_ENTRIES", "10000"))
    
    # Configuration ML
    ml_batch_size: int = int(os.getenv("ML_BATCH_SIZE", "32"))
    gpu_memory_fraction: float = float(os.getenv("GPU_MEMORY_FRACTION", "0.8"))
    models_path: str = os.getenv("MODELS_PATH", "../../../public/models")
    
    # Configuration des langues
    default_language: str = os.getenv("DEFAULT_LANGUAGE", "fr")
    supported_languages: str = os.getenv("SUPPORTED_LANGUAGES", "fr,en,es,de,pt,zh,ja,ar")
    auto_detect_language: bool = os.getenv("AUTO_DETECT_LANGUAGE", "true").lower() == "true"
    
    # Configuration des modèles de traduction
    basic_model: str = os.getenv("BASIC_MODEL", "mt5-small")
    medium_model: str = os.getenv("MEDIUM_MODEL", "nllb-200-distilled-600M")
    premium_model: str = os.getenv("PREMIUM_MODEL", "nllb-200-distilled-1.3B")
    
    # Configuration des performances
    translation_timeout: int = int(os.getenv("TRANSLATION_TIMEOUT", "30"))
    max_text_length: int = int(os.getenv("MAX_TEXT_LENGTH", "1000"))
    concurrent_translations: int = int(os.getenv("CONCURRENT_TRANSLATIONS", "10"))
    
    @property
    def supported_languages_list(self) -> list[str]:
        """Retourne la liste des langues supportées"""
        return [lang.strip() for lang in self.supported_languages.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    """Retourne une instance singleton des paramètres"""
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
