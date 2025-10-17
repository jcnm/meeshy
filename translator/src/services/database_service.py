"""
Service de base de données pour le Translator Meeshy
Gère la sauvegarde et la récupération des traductions
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from prisma import Prisma

logger = logging.getLogger(__name__)

class DatabaseService:
    """Service de base de données pour le Translator"""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url
        self.prisma = None
        self.is_connected = False
    
    async def connect(self):
        """Établit la connexion à la base de données"""
        try:
            if not self.prisma:
                # Le client Prisma est déjà généré dans l'image Docker
                self.prisma = Prisma()
            
            # Utiliser la configuration par défaut (le DATABASE_URL est dans .env)
            await self.prisma.connect()
            
            self.is_connected = True
            logger.info("✅ [TRANSLATOR-DB] Connexion à la base de données établie")
            return True
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR-DB] Erreur connexion base de données: {e}")
            self.is_connected = False
            return False
    
    async def disconnect(self):
        """Ferme la connexion à la base de données"""
        try:
            if self.prisma:
                await self.prisma.disconnect()
                self.is_connected = False
                logger.info("✅ [TRANSLATOR-DB] Connexion à la base de données fermée")
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR-DB] Erreur fermeture base de données: {e}")
    
    async def save_translation(self, translation_data: Dict[str, Any]) -> bool:
        """
        Sauvegarde une traduction en base de données (upsert)
        
        Args:
            translation_data: Dictionnaire contenant les données de traduction
                - messageId: ID du message
                - sourceLanguage: Langue source
                - targetLanguage: Langue cible
                - translatedText: Texte traduit
                - translatorModel: Modèle utilisé
                - confidenceScore: Score de confiance
                - processingTime: Temps de traitement
                - workerName: Nom du worker
                - poolType: Type de pool utilisée
        
        Returns:
            bool: True si la sauvegarde a réussi, False sinon
        """
        if not self.is_connected:
            logger.warning("⚠️ [TRANSLATOR-DB] Base de données non connectée, pas de sauvegarde")
            return False
        
        try:
            # Extraire les données
            message_id = translation_data.get('messageId')
            source_language = translation_data.get('sourceLanguage', 'fr')
            target_language = translation_data.get('targetLanguage')
            translated_text = translation_data.get('translatedText')
            translator_model = translation_data.get('translatorModel', translation_data.get('modelType', 'basic'))
            confidence_score = translation_data.get('confidenceScore', 0.9)
            processing_time = translation_data.get('processingTime', 0.0)
            worker_name = translation_data.get('workerName', 'unknown')
            pool_type = translation_data.get('poolType', 'normal')
            
            # Validation des données obligatoires
            if not all([message_id, target_language, translated_text]):
                logger.warning(f"⚠️ [TRANSLATOR-DB] Données de traduction incomplètes: {translation_data}")
                return False
            
            # Créer la clé de cache unique
            cache_key = f"{message_id}_{source_language}_{target_language}_{translator_model}"
            
            # Définir la hiérarchie des modèles
            model_hierarchy = {
                "basic": 1,
                "medium": 2,
                "premium": 3
            }
            current_model_level = model_hierarchy.get(translator_model, 1)
            
            # Vérifier si la traduction existe déjà
            existing_translation = await self.prisma.messagetranslation.find_unique(
                where={
                    "messageId_targetLanguage": {
                        "messageId": message_id,
                        "targetLanguage": target_language
                    }
                }
            )
            
            if existing_translation:
                # Vérifier le niveau du modèle existant
                existing_model_level = model_hierarchy.get(existing_translation.translationModel, 1)
                
                # Ne mettre à jour que si le nouveau modèle est de niveau supérieur ou égal
                if current_model_level >= existing_model_level:
                    await self.prisma.messagetranslation.update(
                        where={
                            "messageId_targetLanguage": {
                                "messageId": message_id,
                                "targetLanguage": target_language
                            }
                        },
                        data={
                            "translatedContent": translated_text,
                            "translationModel": translator_model,
                            "confidenceScore": confidence_score,
                            "cacheKey": cache_key
                        }
                    )
                    
                    if current_model_level > existing_model_level:
                        logger.info(f"⬆️ [TRANSLATOR-DB] Traduction améliorée: {message_id} -> {target_language} ({existing_translation.translationModel} → {translator_model})")
                    else:
                        logger.info(f"🔄 [TRANSLATOR-DB] Traduction mise à jour: {message_id} -> {target_language} ({translator_model})")
                else:
                    logger.info(f"⏭️ [TRANSLATOR-DB] Traduction existante de niveau supérieur ignorée: {message_id} -> {target_language} ({existing_translation.translationModel} > {translator_model})")
                    return True
                
            else:
                # Créer une nouvelle traduction
                await self.prisma.messagetranslation.create(
                    data={
                        "messageId": message_id,
                        "sourceLanguage": source_language,
                        "targetLanguage": target_language,
                        "translatedContent": translated_text,
                        "translationModel": translator_model,
                        "confidenceScore": confidence_score,
                        "cacheKey": cache_key
                    }
                )
                
                logger.info(f"✅ [TRANSLATOR-DB] Nouvelle traduction sauvegardée: {message_id} -> {target_language} ({translator_model})")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR-DB] Erreur sauvegarde traduction: {e}")
            return False
    
    def is_db_connected(self) -> bool:
        """Vérifie si la connexion à la base de données est active"""
        return self.is_connected
    
    async def get_translation(self, message_id: str, target_language: str) -> Optional[Dict[str, Any]]:
        """
        Récupère une traduction depuis la base de données
        
        Args:
            message_id: ID du message
            target_language: Langue cible
        
        Returns:
            Dict ou None: Données de traduction ou None si non trouvée
        """
        if not self.is_connected:
            logger.warning("⚠️ [TRANSLATOR-DB] Base de données non connectée")
            return None
        
        try:
            translation = await self.prisma.messagetranslation.find_unique(
                where={
                    "messageId_targetLanguage": {
                        "messageId": message_id,
                        "targetLanguage": target_language
                    }
                }
            )
            
            if translation:
                return {
                    "messageId": translation.messageId,
                    "sourceLanguage": translation.sourceLanguage,
                    "targetLanguage": translation.targetLanguage,
                    "translatedText": translation.translatedContent,
                    "translatorModel": translation.translationModel,
                    "confidenceScore": translation.confidenceScore,
                    "cacheKey": translation.cacheKey,
                    "createdAt": translation.createdAt.isoformat() if translation.createdAt else None
                }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR-DB] Erreur récupération traduction: {e}")
            return None
    
    async def invalidate_message_translations(self, message_id: str) -> bool:
        """
        Invalide toutes les traductions d'un message (pour forcer la retraduction)
        
        Args:
            message_id: ID du message
        
        Returns:
            bool: True si succès, False sinon
        """
        if not self.is_connected:
            logger.warning("⚠️ [TRANSLATOR-DB] Base de données non connectée")
            return False
        
        try:
            # Supprimer toutes les traductions existantes pour ce message
            deleted_count = await self.prisma.messagetranslation.delete_many(
                where={
                    "messageId": message_id
                }
            )
            
            logger.info(f"🗑️ [TRANSLATOR-DB] {deleted_count} traductions supprimées pour le message {message_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR-DB] Erreur invalidation traductions: {e}")
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé de la connexion à la base de données"""
        try:
            if not self.is_connected:
                return {
                    "connected": False,
                    "status": "disconnected",
                    "error": "Database not connected"
                }
            
            # Test simple de connexion (MongoDB ne supporte pas SELECT 1)
            # Utiliser une requête MongoDB valide à la place
            await self.prisma.user.count()
            
            return {
                "connected": True,
                "status": "healthy",
                "type": "mongodb"
            }
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR-DB] Erreur health check: {e}")
            return {
                "connected": False,
                "status": "error",
                "error": str(e)
            }
