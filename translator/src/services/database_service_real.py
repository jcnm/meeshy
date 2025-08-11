"""
Service de base de données PostgreSQL avec schéma Prisma
Utilise asyncpg pour interroger directement les tables générées par Prisma
"""

import logging
import asyncio
import asyncpg
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
import json
import os
import hashlib

logger = logging.getLogger(__name__)

class DatabaseServiceReal:
    """Service de base de données PostgreSQL utilisant le schéma Prisma"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.is_connected = False
        # Utiliser la DATABASE_URL du .env
        self.connection_string = os.getenv(
            "DATABASE_URL", 
            "postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy"
        )
        
    async def initialize(self) -> bool:
        """Initialise la connexion à PostgreSQL"""
        try:
            logger.info("🗄️  Initialisation de la base de données PostgreSQL (Prisma)...")
            
            # Créer le pool de connexions
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=2,
                max_size=10,
                command_timeout=30
            )
            
            # Tester la connexion
            async with self.pool.acquire() as conn:
                version = await conn.fetchval('SELECT version()')
                logger.info(f"✅ Connexion PostgreSQL réussie!")
                logger.info(f"Version: {version.split()[1] if version else 'unknown'}")
            
            self.is_connected = True
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation PostgreSQL: {e}")
            return False
    
    async def display_statistics(self):
        """Affiche les statistiques de traduction en interrogeant les tables Prisma"""
        try:
            # Bannière de début avec design distinctif
            logger.info("")
            logger.info("=" * 80)
            logger.info("🗄️  STATISTIQUES DE LA BASE DE DONNÉES POSTGRESQL")
            logger.info("=" * 80)
            
            async with self.pool.acquire() as conn:
                # Vérifier quelles tables existent (selon le schéma Prisma)
                tables_query = """
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = ANY($1)
                    ORDER BY table_name
                """
                expected_tables = ['message_translations', 'messages', 'users', 'conversations']
                tables = await conn.fetch(tables_query, expected_tables)
                
                existing_tables = [table['table_name'] for table in tables]
                
                # Affichage de toutes les tables disponibles en premier
                all_tables = await conn.fetch("""
                    SELECT table_name, 
                           (SELECT COUNT(*) FROM information_schema.columns 
                            WHERE table_name = t.table_name AND table_schema = 'public') as column_count
                    FROM information_schema.tables t
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                
                logger.info(f"📋 SCHEMA PRISMA - TABLES DISPONIBLES: {len(all_tables)} tables")
                for table in all_tables:
                    logger.info(f"   📋 {table['table_name']} ({table['column_count']} colonnes)")
                
                logger.info("")
                logger.info("🎯 FOCUS: TABLE MESSAGE_TRANSLATIONS")
                logger.info("-" * 50)
                
                if 'message_translations' in existing_tables:
                    # Total des traductions
                    total_translations = await conn.fetchval(
                        'SELECT COUNT(*) FROM message_translations'
                    )
                    logger.info(f"📝 Total des traductions: {total_translations:,}")
                    
                    if total_translations > 0:
                        # Langues source et cible uniques
                        languages_query = """
                            SELECT DISTINCT lang FROM (
                                SELECT "sourceLanguage" as lang FROM message_translations
                                WHERE "sourceLanguage" IS NOT NULL
                                UNION
                                SELECT "targetLanguage" as lang FROM message_translations
                                WHERE "targetLanguage" IS NOT NULL
                            ) all_langs
                            ORDER BY lang
                        """
                        languages = await conn.fetch(languages_query)
                        unique_languages = [lang['lang'] for lang in languages]
                        
                        logger.info(f"🌐 Langues uniques utilisées: {len(unique_languages)}")
                        if unique_languages:
                            logger.info(f"🗣️  Langues: {', '.join(unique_languages)}")
                        
                        # Top 5 paires de langues les plus utilisées
                        top_pairs = await conn.fetch("""
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
                                src, tgt, count = pair['sourceLanguage'], pair['targetLanguage'], pair['count']
                                logger.info(f"   {src} → {tgt}: {count:,}")
                        
                        # Modèles utilisés avec statistiques
                        models = await conn.fetch("""
                            SELECT 
                                "translationModel", 
                                COUNT(*) as count, 
                                AVG("confidenceScore") as avg_confidence,
                                MAX("createdAt") as last_used
                            FROM message_translations
                            WHERE "translationModel" IS NOT NULL
                            GROUP BY "translationModel"
                            ORDER BY count DESC
                        """)
                        
                        if models:
                            logger.info(f"🤖 Modèles utilisés: {len(models)}")
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
                        
                        # Statistiques temporelles
                        recent_count = await conn.fetchval("""
                            SELECT COUNT(*) FROM message_translations
                            WHERE "createdAt" > NOW() - INTERVAL '24 hours'
                        """)
                        logger.info(f"📈 Traductions des dernières 24h: {recent_count:,}")
                        
                        # Performance moyenne globale
                        avg_confidence = await conn.fetchval("""
                            SELECT AVG("confidenceScore") FROM message_translations
                            WHERE "confidenceScore" IS NOT NULL
                        """)
                        if avg_confidence:
                            logger.info(f"⚡ Confiance moyenne globale: {avg_confidence:.3f}")
                        
                        # Activité par semaine (dernières 4 semaines)
                        weekly_activity = await conn.fetch("""
                            SELECT 
                                DATE_TRUNC('week', "createdAt") as week,
                                COUNT(*) as translations
                            FROM message_translations
                            WHERE "createdAt" > NOW() - INTERVAL '4 weeks'
                            GROUP BY week
                            ORDER BY week DESC
                        """)
                        
                        if weekly_activity:
                            logger.info("📊 Activité hebdomadaire (4 dernières semaines):")
                            for activity in weekly_activity:
                                week_start = activity['week'].strftime('%Y-%m-%d')
                                count = activity['translations']
                                logger.info(f"   Semaine du {week_start}: {count:,} traductions")
                
                else:
                    logger.info("📊 Table MessageTranslation non trouvée - Base vide ou première utilisation")
                
                # Messages totaux si disponible
                if 'Message' in existing_tables:
                    total_messages = await conn.fetchval('SELECT COUNT(*) FROM "Message"')
                    logger.info(f"💬 Total des messages: {total_messages:,}")
                    
                    # Messages récents
                    recent_messages = await conn.fetchval("""
                        SELECT COUNT(*) FROM "Message"
                        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
                    """)
                    logger.info(f"💬 Messages des dernières 24h: {recent_messages:,}")
                
                # Utilisateurs totaux si disponible
                if 'User' in existing_tables:
                    total_users = await conn.fetchval('SELECT COUNT(*) FROM "User"')
                    logger.info(f"👥 Total des utilisateurs: {total_users:,}")
                    
                    # Utilisateurs actifs récents
                    active_users = await conn.fetchval("""
                        SELECT COUNT(*) FROM "User"
                        WHERE "lastActiveAt" > NOW() - INTERVAL '7 days'
                    """)
                    logger.info(f"👥 Utilisateurs actifs (7j): {active_users:,}")
                
                # Conversations si disponible
                if 'Conversation' in existing_tables:
                    total_conversations = await conn.fetchval('SELECT COUNT(*) FROM "Conversation"')
                    logger.info(f"💬 Total des conversations: {total_conversations:,}")
            
            # Bannière de fin
            logger.info("")
            logger.info("=" * 80)
            logger.info("🏁 FIN DES STATISTIQUES DE LA BASE DE DONNÉES")
            logger.info("=" * 80)
            logger.info("")
            
        except Exception as e:
            logger.warning(f"⚠️  Impossible d'afficher les statistiques: {e}")
            logger.info("📊 Base de données: Statistiques non disponibles")
    
    async def record_translation(
        self, 
        source_lang: str, 
        target_lang: str, 
        model_used: str,
        text_length: int,
        confidence_score: float,
        processing_time_ms: int,
        original_text: str = "",
        translated_text: str = "",
        message_id: Optional[str] = None
    ):
        """Enregistre une traduction dans MessageTranslation (schéma Prisma)"""
        try:
            async with self.pool.acquire() as conn:
                # Générer un ID CUID-like et une clé de cache
                import time
                timestamp = int(time.time() * 1000)
                text_hash = hashlib.sha256(original_text.encode()).hexdigest()[:8]
                translation_id = f"cm{timestamp}_{text_hash}"
                
                cache_data = f"{source_lang}:{target_lang}:{text_hash}"
                cache_key = hashlib.sha256(cache_data.encode()).hexdigest()[:32]
                
                # Insérer dans MessageTranslation selon le schéma Prisma
                await conn.execute("""
                    INSERT INTO message_translations 
                    (id, "messageId", "sourceLanguage", "targetLanguage", 
                     "translatedContent", "translationModel", "cacheKey", 
                     "confidenceScore", "createdAt")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT ("cacheKey") DO UPDATE SET
                        "confidenceScore" = EXCLUDED."confidenceScore",
                        "translationModel" = EXCLUDED."translationModel",
                        "createdAt" = NOW()
                """, 
                translation_id,
                message_id or f"ext_{timestamp}",
                source_lang, 
                target_lang, 
                translated_text,
                model_used, 
                cache_key, 
                confidence_score
                )
                
                logger.debug(f"✅ Traduction enregistrée: {source_lang} → {target_lang} ({model_used})")
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'enregistrement: {e}")
    
    async def get_statistics_summary(self) -> Dict[str, Any]:
        """Retourne un résumé des statistiques pour l'API"""
        try:
            async with self.pool.acquire() as conn:
                stats = {}
                
                # Vérifier si les tables existent
                table_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'MessageTranslation'
                    )
                """)
                
                if table_exists:
                    # Statistiques de base
                    stats['total_translations'] = await conn.fetchval(
                        'SELECT COUNT(*) FROM message_translations'
                    )
                    
                    # Langues uniques
                    unique_langs = await conn.fetchval("""
                        SELECT COUNT(DISTINCT lang) FROM (
                            SELECT "sourceLanguage" as lang FROM message_translations
                            UNION
                            SELECT "targetLanguage" as lang FROM message_translations
                        ) langs WHERE lang IS NOT NULL
                    """)
                    stats['unique_languages'] = unique_langs or 0
                    
                    # Modèles utilisés
                    stats['models_used'] = await conn.fetchval("""
                        SELECT COUNT(DISTINCT "translationModel") 
                        FROM message_translations 
                        WHERE "translationModel" IS NOT NULL
                    """) or 0
                    
                    # Performance moyenne
                    avg_confidence = await conn.fetchval("""
                        SELECT AVG("confidenceScore") FROM message_translations
                        WHERE "confidenceScore" IS NOT NULL
                    """)
                    if avg_confidence:
                        stats['average_confidence'] = round(float(avg_confidence), 3)
                    
                    # Activité récente
                    stats['recent_translations_24h'] = await conn.fetchval("""
                        SELECT COUNT(*) FROM message_translations
                        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
                    """) or 0
                
                # Autres tables
                try:
                    stats['total_messages'] = await conn.fetchval('SELECT COUNT(*) FROM "Message"') or 0
                    stats['total_users'] = await conn.fetchval('SELECT COUNT(*) FROM "User"') or 0
                except:
                    pass
                
                return stats
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de la récupération des statistiques: {e}")
            return {'error': str(e)}
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé de la base de données"""
        try:
            async with self.pool.acquire() as conn:
                version = await conn.fetchval('SELECT version()')
                
                # Test de performance
                start_time = datetime.now()
                await conn.fetchval('SELECT 1')
                ping_time = (datetime.now() - start_time).total_seconds() * 1000
                
            return {
                'database_connected': True,
                'database_responsive': True,
                'database_type': 'postgresql_prisma',
                'database_version': version.split()[1] if version else 'unknown',
                'connection_pool_size': len(self.pool._holders) if self.pool else 0,
                'ping_time_ms': round(ping_time, 2),
                'last_ping': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'database_connected': False,
                'database_responsive': False,
                'error': str(e),
                'last_ping': datetime.now().isoformat()
            }
    
    async def cleanup(self):
        """Nettoie les ressources de base de données"""
        if self.pool:
            logger.info("🧹 Fermeture du pool de connexions PostgreSQL")
            await self.pool.close()
        self.is_connected = False
