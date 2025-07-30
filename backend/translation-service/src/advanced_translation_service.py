#!/usr/bin/env python3
"""
Service de traduction moderne pour Meeshy
Implémente 3 niveaux de modèles selon la complexité et difficulté
Traitement parallèle avec détection de langue avancée
"""

import asyncio
import logging
import os
import sys
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Imports ML et NLP
try:
    import torch
    from transformers import (
        AutoTokenizer, AutoModelForSeq2SeqLM,
        M2M100ForConditionalGeneration, M2M100Tokenizer,
        pipeline
    )
    from langdetect import detect, detect_langs
    import nltk
    from textstat import flesch_reading_ease, flesch_kincaid_grade
    logger.info("✅ Dépendances ML importées avec succès")
except ImportError as e:
    logger.error(f"❌ Erreur d'import ML: {e}")
    logger.error("Installer les dépendances: pip install torch transformers langdetect nltk textstat")
    sys.exit(1)

# Configuration des modèles
class ModelTier(Enum):
    BASIC = "basic"          # Messages simples, mots/phrases courtes
    MEDIUM = "medium"        # Messages moyens, conversations normales
    PREMIUM = "premium"      # Messages complexes, contenu riche

@dataclass
class TranslationConfig:
    """Configuration de traduction"""
    source_language: str
    target_language: str
    text: str
    complexity_score: float
    model_tier: ModelTier
    
@dataclass
class TranslationResult:
    """Résultat de traduction"""
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    model_tier: ModelTier
    confidence_score: float
    processing_time_ms: int
    from_cache: bool
    cache_key: str

class LanguageDetector:
    """Détecteur de langue avancé"""
    
    def __init__(self):
        self.supported_languages = {
            'fr', 'en', 'es', 'de', 'pt', 'it', 'nl', 'ru', 
            'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'pl', 'sv'
        }
        
    def detect_language(self, text: str, confidence_threshold: float = 0.7) -> Tuple[str, float]:
        """
        Détecte la langue d'un texte avec score de confiance
        
        Args:
            text: Texte à analyser
            confidence_threshold: Seuil de confiance minimum
            
        Returns:
            Tuple (langue, confiance)
        """
        try:
            # Nettoyer le texte
            clean_text = text.strip()
            if len(clean_text) < 3:
                return 'fr', 0.5  # Défaut français pour textes courts
            
            # Détection avec langdetect
            detected_langs = detect_langs(clean_text)
            
            if detected_langs:
                primary_lang = detected_langs[0]
                language_code = primary_lang.lang
                confidence = primary_lang.prob
                
                # Vérifier si la langue est supportée
                if language_code in self.supported_languages and confidence >= confidence_threshold:
                    return language_code, confidence
                
            # Fallback vers français si détection incertaine
            return 'fr', 0.5
            
        except Exception as e:
            logger.warning(f"Erreur détection langue: {e}")
            return 'fr', 0.5

class ComplexityAnalyzer:
    """Analyseur de complexité de texte"""
    
    def analyze_complexity(self, text: str, language: str = 'en') -> float:
        """
        Analyse la complexité d'un texte
        
        Args:
            text: Texte à analyser
            language: Langue du texte
            
        Returns:
            Score de complexité (0-1, 1 = très complexe)
        """
        try:
            # Métriques de base
            word_count = len(text.split())
            char_count = len(text)
            sentence_count = text.count('.') + text.count('!') + text.count('?') + 1
            
            # Score de longueur (normalisé)
            length_score = min(word_count / 50.0, 1.0)  # 50 mots = complexité max
            
            # Score de lisibilité (pour l'anglais principalement)
            readability_score = 0.5
            if language in ['en', 'fr']:
                try:
                    flesch_score = flesch_reading_ease(text)
                    # Conversion Flesch vers score 0-1 (inversé)
                    readability_score = max(0, (100 - flesch_score) / 100.0)
                except:
                    readability_score = 0.5
            
            # Détection de caractères spéciaux/emoji
            special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
            special_score = min(special_chars / len(text), 0.3) if text else 0
            
            # Score final pondéré
            complexity = (
                length_score * 0.4 +
                readability_score * 0.4 +
                special_score * 0.2
            )
            
            return min(complexity, 1.0)
            
        except Exception as e:
            logger.warning(f"Erreur analyse complexité: {e}")
            return 0.5  # Score moyen par défaut

class ModelManager:
    """Gestionnaire des modèles de traduction"""
    
    def __init__(self):
        self.models = {}
        self.tokenizers = {}
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Device utilisé: {self.device}")
        
    async def initialize_models(self):
        """Initialise tous les modèles de traduction"""
        logger.info("🔄 Initialisation des modèles de traduction...")
        
        try:
            # Modèle BASIC - M2M100 418M (rapide)
            logger.info("📦 Chargement modèle BASIC (M2M100-418M)...")
            self.models[ModelTier.BASIC] = M2M100ForConditionalGeneration.from_pretrained(
                "facebook/m2m100_418M"
            ).to(self.device)
            self.tokenizers[ModelTier.BASIC] = M2M100Tokenizer.from_pretrained(
                "facebook/m2m100_418M"
            )
            
            # Modèle MEDIUM - M2M100 1.2B (équilibré)
            logger.info("📦 Chargement modèle MEDIUM (M2M100-1.2B)...")
            self.models[ModelTier.MEDIUM] = M2M100ForConditionalGeneration.from_pretrained(
                "facebook/m2m100_1.2B"
            ).to(self.device)
            self.tokenizers[ModelTier.MEDIUM] = M2M100Tokenizer.from_pretrained(
                "facebook/m2m100_1.2B"
            )
            
            # Modèle PREMIUM - NLLB-200 3.3B (précis)
            logger.info("📦 Chargement modèle PREMIUM (NLLB-200-3.3B)...")
            self.models[ModelTier.PREMIUM] = AutoModelForSeq2SeqLM.from_pretrained(
                "facebook/nllb-200-3.3B"
            ).to(self.device)
            self.tokenizers[ModelTier.PREMIUM] = AutoTokenizer.from_pretrained(
                "facebook/nllb-200-3.3B"
            )
            
            logger.info("✅ Tous les modèles initialisés avec succès")
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation modèles: {e}")
            raise
    
    def get_model_tier(self, complexity_score: float) -> ModelTier:
        """
        Détermine le niveau de modèle selon la complexité
        
        Args:
            complexity_score: Score de complexité (0-1)
            
        Returns:
            Niveau de modèle approprié
        """
        if complexity_score < 0.3:
            return ModelTier.BASIC
        elif complexity_score < 0.7:
            return ModelTier.MEDIUM
        else:
            return ModelTier.PREMIUM
    
    async def translate_text(self, config: TranslationConfig) -> str:
        """
        Traduit un texte avec le modèle approprié
        
        Args:
            config: Configuration de traduction
            
        Returns:
            Texte traduit
        """
        try:
            model = self.models[config.model_tier]
            tokenizer = self.tokenizers[config.model_tier]
            
            # Préparer les langues selon le modèle
            if config.model_tier == ModelTier.PREMIUM:
                # NLLB utilise des codes spéciaux
                src_lang = self._get_nllb_language_code(config.source_language)
                tgt_lang = self._get_nllb_language_code(config.target_language)
            else:
                # M2M100 utilise des codes standards
                src_lang = config.source_language
                tgt_lang = config.target_language
            
            # Tokenisation
            if config.model_tier == ModelTier.PREMIUM:
                tokenizer.src_lang = src_lang
                inputs = tokenizer(config.text, return_tensors="pt", padding=True, truncation=True, max_length=512)
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                
                # Génération
                with torch.no_grad():
                    generated_tokens = model.generate(
                        **inputs,
                        forced_bos_token_id=tokenizer.lang_code_to_id[tgt_lang],
                        max_length=512,
                        num_beams=4,
                        length_penalty=1.0,
                        early_stopping=True
                    )
                
                translated_text = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
                
            else:
                # M2M100
                tokenizer.src_lang = src_lang
                inputs = tokenizer(config.text, return_tensors="pt", padding=True, truncation=True, max_length=512)
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                
                with torch.no_grad():
                    generated_tokens = model.generate(
                        **inputs,
                        forced_bos_token_id=tokenizer.get_lang_id(tgt_lang),
                        max_length=512,
                        num_beams=3,
                        length_penalty=1.0,
                        early_stopping=True
                    )
                
                translated_text = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
            
            return translated_text.strip()
            
        except Exception as e:
            logger.error(f"Erreur traduction avec {config.model_tier.value}: {e}")
            return config.text  # Retourner le texte original en cas d'erreur
    
    def _get_nllb_language_code(self, lang_code: str) -> str:
        """Convertit un code langue en code NLLB"""
        nllb_mapping = {
            'fr': 'fra_Latn',
            'en': 'eng_Latn',
            'es': 'spa_Latn',
            'de': 'deu_Latn',
            'pt': 'por_Latn',
            'it': 'ita_Latn',
            'nl': 'nld_Latn',
            'ru': 'rus_Cyrl',
            'zh': 'zho_Hans',
            'ja': 'jpn_Jpan',
            'ko': 'kor_Hang',
            'ar': 'arb_Arab',
            'hi': 'hin_Deva',
            'tr': 'tur_Latn',
            'pl': 'pol_Latn',
            'sv': 'swe_Latn'
        }
        return nllb_mapping.get(lang_code, 'eng_Latn')

class TranslationCache:
    """Cache intelligent pour les traductions"""
    
    def __init__(self):
        self.cache = {}  # En production, utiliser Redis
        self.max_cache_size = 10000
        
    def generate_cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Génère une clé de cache unique"""
        content = f"{text}|{source_lang}|{target_lang}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, cache_key: str) -> Optional[str]:
        """Récupère une traduction du cache"""
        return self.cache.get(cache_key)
    
    def set(self, cache_key: str, translation: str):
        """Stocke une traduction dans le cache"""
        if len(self.cache) >= self.max_cache_size:
            # Supprimer les anciens éléments (FIFO simple)
            old_key = next(iter(self.cache))
            del self.cache[old_key]
        
        self.cache[cache_key] = translation

class MeeshyTranslationService:
    """
    Service de traduction principal pour Meeshy
    Gère la détection de langue, analyse de complexité et traduction multi-niveaux
    """
    
    def __init__(self):
        self.language_detector = LanguageDetector()
        self.complexity_analyzer = ComplexityAnalyzer()
        self.model_manager = ModelManager()
        self.cache = TranslationCache()
        self.executor = ThreadPoolExecutor(max_workers=4)  # Traitement parallèle
        
    async def initialize(self):
        """Initialise le service de traduction"""
        logger.info("🚀 Initialisation du service de traduction Meeshy...")
        await self.model_manager.initialize_models()
        logger.info("✅ Service de traduction prêt")
    
    async def translate_message(
        self, 
        text: str, 
        target_languages: List[str],
        source_language: Optional[str] = None
    ) -> List[TranslationResult]:
        """
        Traduit un message vers plusieurs langues cibles
        
        Args:
            text: Texte à traduire
            target_languages: Liste des langues cibles
            source_language: Langue source (détectée automatiquement si None)
            
        Returns:
            Liste des résultats de traduction
        """
        start_time = datetime.now()
        
        # 1. Détection de langue si nécessaire
        if source_language is None:
            detected_lang, confidence = self.language_detector.detect_language(text)
            source_language = detected_lang
            logger.info(f"Langue détectée: {source_language} (confiance: {confidence:.2f})")
        
        # 2. Analyse de complexité
        complexity_score = self.complexity_analyzer.analyze_complexity(text, source_language)
        model_tier = self.model_manager.get_model_tier(complexity_score)
        
        logger.info(f"Complexité: {complexity_score:.2f} -> Modèle: {model_tier.value}")
        
        # 3. Traduction parallèle vers toutes les langues cibles
        translation_tasks = []
        
        for target_lang in target_languages:
            if target_lang == source_language:
                # Pas besoin de traduire vers la même langue
                continue
                
            # Vérifier le cache
            cache_key = self.cache.generate_cache_key(text, source_language, target_lang)
            cached_translation = self.cache.get(cache_key)
            
            if cached_translation:
                # Utiliser la traduction en cache
                result = TranslationResult(
                    original_text=text,
                    translated_text=cached_translation,
                    source_language=source_language,
                    target_language=target_lang,
                    model_tier=model_tier,
                    confidence_score=0.95,  # Cache = haute confiance
                    processing_time_ms=0,
                    from_cache=True,
                    cache_key=cache_key
                )
                translation_tasks.append(asyncio.create_task(self._return_cached_result(result)))
            else:
                # Nouvelle traduction
                config = TranslationConfig(
                    source_language=source_language,
                    target_language=target_lang,
                    text=text,
                    complexity_score=complexity_score,
                    model_tier=model_tier
                )
                translation_tasks.append(self._translate_single(config, cache_key))
        
        # 4. Attendre toutes les traductions
        results = await asyncio.gather(*translation_tasks, return_exceptions=True)
        
        # 5. Filtrer les erreurs et retourner les résultats valides
        valid_results = []
        for result in results:
            if isinstance(result, TranslationResult):
                valid_results.append(result)
            elif isinstance(result, Exception):
                logger.error(f"Erreur de traduction: {result}")
        
        total_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.info(f"Traduction terminée en {total_time:.2f}ms pour {len(valid_results)} langues")
        
        return valid_results
    
    async def _return_cached_result(self, result: TranslationResult) -> TranslationResult:
        """Retourne un résultat en cache"""
        return result
    
    async def _translate_single(self, config: TranslationConfig, cache_key: str) -> TranslationResult:
        """
        Traduit un texte vers une langue cible
        
        Args:
            config: Configuration de traduction
            cache_key: Clé de cache
            
        Returns:
            Résultat de traduction
        """
        start_time = datetime.now()
        
        try:
            # Traduction avec le modèle approprié
            translated_text = await self.model_manager.translate_text(config)
            
            # Calculer le temps de traitement
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Stocker en cache
            self.cache.set(cache_key, translated_text)
            
            # Créer le résultat
            result = TranslationResult(
                original_text=config.text,
                translated_text=translated_text,
                source_language=config.source_language,
                target_language=config.target_language,
                model_tier=config.model_tier,
                confidence_score=0.85,  # Score par défaut
                processing_time_ms=processing_time,
                from_cache=False,
                cache_key=cache_key
            )
            
            logger.info(f"Traduit {config.source_language}->{config.target_language} en {processing_time}ms avec {config.model_tier.value}")
            
            return result
            
        except Exception as e:
            logger.error(f"Erreur traduction {config.source_language}->{config.target_language}: {e}")
            
            # Retourner le texte original en cas d'erreur
            return TranslationResult(
                original_text=config.text,
                translated_text=config.text,
                source_language=config.source_language,
                target_language=config.target_language,
                model_tier=config.model_tier,
                confidence_score=0.0,
                processing_time_ms=0,
                from_cache=False,
                cache_key=cache_key
            )
    
    def get_supported_languages(self) -> List[str]:
        """Retourne la liste des langues supportées"""
        return list(self.language_detector.supported_languages)
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du service"""
        return {
            "cache_size": len(self.cache.cache),
            "supported_languages": len(self.get_supported_languages()),
            "models_loaded": len(self.model_manager.models),
            "device": str(self.model_manager.device)
        }

# Instance globale du service
translation_service = MeeshyTranslationService()

async def initialize_translation_service():
    """Initialise le service de traduction global"""
    await translation_service.initialize()

if __name__ == "__main__":
    # Test du service
    async def test_service():
        await initialize_translation_service()
        
        # Test de traduction
        results = await translation_service.translate_message(
            text="Bonjour, comment allez-vous ?",
            target_languages=["en", "es", "de"]
        )
        
        for result in results:
            print(f"{result.source_language} -> {result.target_language}: {result.translated_text}")
            print(f"Modèle: {result.model_tier.value}, Temps: {result.processing_time_ms}ms, Cache: {result.from_cache}")
            print("---")
    
    asyncio.run(test_service())
