"""
Service de base de données utilisant le client Prisma Python généré
Version officielle avec types et validations Prisma
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class DatabaseServicePrisma:
    """Service de base de données utilisant le client Prisma Python officiel"""
    
    def __init__(self):
        self.db = None
        self.is_connected = False
        self.connection_retries = 0
        self.max_retries = 5
        self.retry_delay = 2

    async def initialize(self) -> bool:
        """Initialise la connexion Prisma"""
        try:
            logger.info("🗄️  Initialisation du service Prisma Python...")
            
            # Import du client Prisma généré
            from prisma import Prisma
            self.db = Prisma()
            
            # Tentative de connexion avec retry
            for attempt in range(self.max_retries):
                try:
                    await self.db.connect()
                    logger.info("✅ Connexion Prisma Python réussie!")
                    self.is_connected = True
                    
                    # Afficher les informations de la base
                    await self._display_connection_info()
                    
                    # Afficher les statistiques
                    await self.display_statistics()
                    
                    return True
                    
                except Exception as e:
                    self.connection_retries += 1
                    logger.warning(f"⚠️  Tentative de connexion {attempt + 1}/{self.max_retries} échouée: {e}")
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self.retry_delay)
                    
            logger.error("❌ Impossible de se connecter à la base de données après plusieurs tentatives")
            return False
            
        except ImportError as e:
            logger.error(f"❌ Impossible d'importer le client Prisma: {e}")
            logger.error("💡 Assurez-vous d'avoir exécuté 'prisma generate'")
            return False
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation Prisma: {e}")
            return False

    async def _display_connection_info(self):
        """Affiche les informations de connexion"""
        try:
            # Test de connexion basique
            result = await self.db.query_raw("SELECT version() as version")
            if result and len(result) > 0:
                version = result[0].get('version', 'Unknown')
                logger.info(f"📊 Version PostgreSQL: {version.split()[1] if version else 'Unknown'}")
            
            # Compter les tables
            tables_result = await self.db.query_raw("""
                SELECT COUNT(*) as count FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            if tables_result and len(tables_result) > 0:
                table_count = tables_result[0].get('count', 0)
                logger.info(f"📋 Nombre de tables: {table_count}")
                
        except Exception as e:
            logger.warning(f"⚠️  Impossible d'obtenir les infos de connexion: {e}")

    async def display_statistics(self):
        """Affiche les statistiques de la base de données avec focus sur message_translations"""
        if not self.is_connected or not self.db:
            logger.warning("⚠️  Base de données non connectée")
            return
        
        try:
            # Bannière de début
            logger.info("")
            logger.info("=" * 80)
            logger.info("🗄️  STATISTIQUES PRISMA PYTHON - BASE DE DONNÉES")
            logger.info("=" * 80)
            
            # Lister toutes les tables Prisma
            tables_result = await self.db.query_raw("""
                SELECT table_name, 
                       (SELECT COUNT(*) FROM information_schema.columns 
                        WHERE table_name = t.table_name AND table_schema = 'public') as column_count
                FROM information_schema.tables t
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            
            logger.info(f"📋 TABLES PRISMA DISPONIBLES: {len(tables_result)} tables")
            for table in tables_result:
                logger.info(f"   📋 {table['table_name']} ({table['column_count']} colonnes)")
            
            # Focus sur message_translations
            logger.info("")
            logger.info("🎯 FOCUS: MESSAGE_TRANSLATIONS (via Prisma)")
            logger.info("-" * 50)
            
            try:
                # Utiliser le modèle Prisma pour les statistiques
                total_translations = await self.db.messagetranslation.count()
                logger.info(f"📝 Total des traductions: {total_translations:,}")
                
                if total_translations > 0:
                    # Langues uniques (requête avec Prisma)
                    languages_data = await self.db.query_raw("""
                        SELECT DISTINCT lang FROM (
                            SELECT "sourceLanguage" as lang FROM message_translations
                            WHERE "sourceLanguage" IS NOT NULL
                            UNION
                            SELECT "targetLanguage" as lang FROM message_translations
                            WHERE "targetLanguage" IS NOT NULL
                        ) all_langs
                        ORDER BY lang
                    """)
                    
                    unique_languages = [row['lang'] for row in languages_data]
                    logger.info(f"🌐 Langues uniques: {len(unique_languages)}")
                    if unique_languages:
                        logger.info(f"🗣️  Langues: {', '.join(unique_languages)}")
                    
                    # Top paires de langues
                    top_pairs = await self.db.query_raw("""
                        SELECT "sourceLanguage", "targetLanguage", COUNT(*) as count
                        FROM message_translations
                        WHERE "sourceLanguage" IS NOT NULL AND "targetLanguage" IS NOT NULL
                        GROUP BY "sourceLanguage", "targetLanguage"
                        ORDER BY count DESC
                        LIMIT 5
                    """)
                    
                    if top_pairs:
                        logger.info("🏆 Top 5 paires de langues:")
                        for pair in top_pairs:
                            logger.info(f"   {pair['sourceLanguage']} → {pair['targetLanguage']}: {pair['count']}")
                    
                    # Modèles utilisés
                    models = await self.db.query_raw("""
                        SELECT "translationModel", COUNT(*) as count, 
                               AVG("confidenceScore") as avg_confidence,
                               MAX("createdAt") as last_used
                        FROM message_translations
                        WHERE "translationModel" IS NOT NULL
                        GROUP BY "translationModel"
                        ORDER BY count DESC
                    """)
                    
                    if models:
                        logger.info("🤖 Modèles utilisés:")
                        for model in models:
                            name = model['translationModel']
                            count = model['count']
                            conf = model['avg_confidence'] or 0
                            last_used = model['last_used']
                            if last_used:
                                days_ago = (datetime.now() - last_used.replace(tzinfo=None)).days
                                logger.info(f"   {name}: {count:,} traductions (conf: {conf:.3f}, dernier: {days_ago}j)")
                            else:
                                logger.info(f"   {name}: {count:,} traductions (conf: {conf:.3f})")
                    
                    # Activité récente
                    recent_count = await self.db.query_raw("""
                        SELECT COUNT(*) as count FROM message_translations
                        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
                    """)
                    if recent_count:
                        logger.info(f"📈 Traductions dernières 24h: {recent_count[0]['count']:,}")
                
                else:
                    logger.info("�� Table message_translations vide")
                    
            except Exception as model_error:
                logger.warning(f"⚠️  Erreur lors de l'accès via Prisma: {model_error}")
                logger.info("💡 Table message_translations peut ne pas exister ou être inaccessible")
            
            # Autres tables importantes
            logger.info("")
            logger.info("📊 AUTRES TABLES PRINCIPALES:")
            for table_info in [('users', 'Utilisateurs'), ('messages', 'Messages'), ('conversations', 'Conversations')]:
                table_name, description = table_info
                try:
                    count_result = await self.db.query_raw(f'SELECT COUNT(*) as count FROM {table_name}')
                    if count_result:
                        count = count_result[0]['count']
                        logger.info(f"   📋 {table_name}: {count:,} {description.lower()}")
                except:
                    logger.info(f"   📋 {table_name}: Non accessible")
            
            # Bannière de fin
            logger.info("")
            logger.info("=" * 80)
            logger.info("🏁 FIN DES STATISTIQUES PRISMA PYTHON")
            logger.info("=" * 80)
            logger.info("")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'affichage des statistiques: {e}")

    async def record_translation(
        self, 
        source_lang: str, 
        target_lang: str, 
        model_used: str, 
        text_length: int, 
        confidence_score: float, 
        processing_time_ms: int,
        translated_content: str = "test_content",
        message_id: str = None
    ):
        """Enregistre une traduction en utilisant le modèle Prisma"""
        if not self.is_connected or not self.db:
            logger.warning("⚠️  Base de données non connectée - Impossible d'enregistrer")
            return
            
        try:
            # Générer un ID de message unique si non fourni
            if not message_id:
                import time
                message_id = f"ext_{int(time.time() * 1000)}"
            
            # Générer une clé de cache unique
            cache_key = f"{message_id}_{target_lang}_{hash(translated_content)}"
            
            # Créer l'enregistrement via Prisma
            translation = await self.db.messagetranslation.create(
                data={
                    'messageId': message_id,
                    'sourceLanguage': source_lang,
                    'targetLanguage': target_lang,
                    'translatedContent': translated_content,
                    'translationModel': model_used,
                    'cacheKey': cache_key,
                    'confidenceScore': confidence_score,
                    # createdAt est automatiquement défini par Prisma
                }
            )
            
            logger.debug(f"✅ Traduction enregistrée via Prisma: {translation.id}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'enregistrement Prisma: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé de la connexion Prisma"""
        try:
            if not self.is_connected or not self.db:
                return {
                    'database_connected': False,
                    'database_type': 'prisma_python',
                    'error': 'Non connecté',
                    'last_ping': datetime.now().isoformat()
                }
            
            # Test de connectivité
            start_time = datetime.now()
            result = await self.db.query_raw("SELECT 1 as test")
            ping_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                'database_connected': True,
                'database_responsive': True,
                'database_type': 'prisma_python',
                'ping_time_ms': round(ping_time, 2),
                'client_version': '0.15.0',  # Version Prisma Python
                'last_ping': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'database_connected': False,
                'database_responsive': False,
                'database_type': 'prisma_python',
                'error': str(e),
                'last_ping': datetime.now().isoformat()
            }

    async def cleanup(self):
        """Nettoie les ressources Prisma"""
        if self.db and self.is_connected:
            try:
                logger.info("🧹 Fermeture de la connexion Prisma Python")
                await self.db.disconnect()
                self.is_connected = False
            except Exception as e:
                logger.error(f"❌ Erreur lors de la fermeture Prisma: {e}")
