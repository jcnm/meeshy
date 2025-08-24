"""
Service de traduction simple - Fallback ultime
Utilise des traductions basiques quand aucun modèle ML n'est disponible
"""

import logging
import time
from typing import Dict, Any

logger = logging.getLogger(__name__)

class SimpleTranslationService:
    """
    Service de traduction simple comme fallback ultime
    Utilise des traductions basiques pré-définies
    """
    
    def __init__(self):
        self.stats = {
            'translations_count': 0,
            'avg_processing_time': 0.0,
            'fallback_mode': True
        }
        
        # Dictionnaire de traductions basiques pour les phrases courantes
        self.basic_translations = {
            # Salutations
            'hello': {'fr': 'bonjour', 'es': 'hola', 'de': 'hallo', 'pt': 'olá'},
            'hi': {'fr': 'salut', 'es': 'hola', 'de': 'hallo', 'pt': 'oi'},
            'goodbye': {'fr': 'au revoir', 'es': 'adiós', 'de': 'auf wiedersehen', 'pt': 'adeus'},
            'bye': {'fr': 'salut', 'es': 'chao', 'de': 'tschüss', 'pt': 'tchau'},
            
            # Réponses basiques
            'yes': {'fr': 'oui', 'es': 'sí', 'de': 'ja', 'pt': 'sim'},
            'no': {'fr': 'non', 'es': 'no', 'de': 'nein', 'pt': 'não'},
            'ok': {'fr': 'd\'accord', 'es': 'vale', 'de': 'okay', 'pt': 'ok'},
            'thanks': {'fr': 'merci', 'es': 'gracias', 'de': 'danke', 'pt': 'obrigado'},
            'thank you': {'fr': 'merci', 'es': 'gracias', 'de': 'danke', 'pt': 'obrigado'},
            
            # Questions basiques
            'how are you': {'fr': 'comment allez-vous', 'es': 'cómo estás', 'de': 'wie geht es dir', 'pt': 'como você está'},
            'what is your name': {'fr': 'quel est votre nom', 'es': 'cuál es tu nombre', 'de': 'wie heißt du', 'pt': 'qual é o seu nome'},
            
            # Messages d'erreur
            'error': {'fr': 'erreur', 'es': 'error', 'de': 'fehler', 'pt': 'erro'},
            'not available': {'fr': 'non disponible', 'es': 'no disponible', 'de': 'nicht verfügbar', 'pt': 'não disponível'},
            'service unavailable': {'fr': 'service indisponible', 'es': 'servicio no disponible', 'de': 'dienst nicht verfügbar', 'pt': 'serviço indisponível'},
        }
        
        logger.info("🔄 Service de traduction simple initialisé (mode fallback)")
    
    async def translate(self, text: str, source_language: str, target_language: str, model_type: str = None, source_channel: str = "simple") -> Dict[str, Any]:
        """
        Traduit un texte en utilisant des traductions basiques
        """
        start_time = time.time()
        
        # OPTIMISATION: Éviter la traduction si source = target
        if source_language == target_language:
            logger.info(f"🔄 [SIMPLE] Langues identiques ({source_language} → {target_language}), pas de traduction nécessaire")
            return {
                'translated_text': text,
                'detected_language': source_language,
                'confidence': 1.0,
                'model_used': 'no_translation_needed',
                'from_cache': False,
                'processing_time': 0.0,
                'source_channel': source_channel
            }
        
        try:
            # Normaliser le texte
            normalized_text = text.lower().strip()
            
            # Chercher une traduction basique
            translated_text = self._basic_translate(normalized_text, target_language)
            
            # Si pas de traduction basique trouvée, retourner le texte original avec un indicateur
            if translated_text == normalized_text:
                translated_text = f"[SIMPLE-FALLBACK] {text}"
                logger.warning(f"⚠️ Traduction basique non trouvée pour: {text}")
            
            processing_time = time.time() - start_time
            
            # Mettre à jour les stats
            self.stats['translations_count'] += 1
            self.stats['avg_processing_time'] = (
                (self.stats['avg_processing_time'] * (self.stats['translations_count'] - 1) + processing_time) 
                / self.stats['translations_count']
            )
            
            return {
                'translated_text': translated_text,
                'detected_language': source_language,
                'confidence': 0.3,  # Confiance faible car traduction basique
                'model_used': 'simple_fallback',
                'from_cache': False,
                'processing_time': processing_time,
                'source_channel': source_channel
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction simple: {e}")
            processing_time = time.time() - start_time
            
            return {
                'translated_text': f"[SIMPLE-ERROR] {text}",
                'detected_language': source_language,
                'confidence': 0.0,
                'model_used': 'simple_fallback_error',
                'from_cache': False,
                'processing_time': processing_time,
                'source_channel': source_channel,
                'error': str(e)
            }
    
    def _basic_translate(self, text: str, target_language: str) -> str:
        """
        Effectue une traduction basique
        """
        # Chercher dans les traductions basiques
        if text in self.basic_translations:
            translations = self.basic_translations[text]
            if target_language in translations:
                return translations[target_language]
        
        # Si pas trouvé, retourner le texte original
        return text
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques"""
        return self.stats
    
    def get_available_models(self) -> list:
        """Retourne les modèles disponibles"""
        return ['simple_fallback']
    
    async def cleanup(self):
        """Nettoie les ressources"""
        logger.info("🧹 Nettoyage du service de traduction simple")
