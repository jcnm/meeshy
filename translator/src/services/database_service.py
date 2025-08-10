"""
Service de gestion de la base de données avec Prisma
Interface de connexion et test de la base de données pour le service Translator
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import sys
import os

# Import du client Prisma généré
sys.path.append(os.path.join(os.path.dirname(__file__), '../../generated'))
from client import Prisma

logger = logging.getLogger(__name__)

class DatabaseService:
    """Service de gestion de la connexion à la base de données avec Prisma"""
    
    def __init__(self):
        self.prisma: Optional[Prisma] = None
        self.is_connected = False
        self.connection_retries = 0
        self.max_retries = 5
        self.retry_delay = 2  # secondes
        
    async def initialize(self) -> bool:
        """
        Initialise la connexion à la base de données avec tests de connectivité
        Retourne True si la connexion est établie, False sinon
        """
        logger.info("🗄️  Initialisation du service de base de données Prisma...")
        
        try:
            # Créer l'instance Prisma
            self.prisma = Prisma(
                log_queries=True,  # Activer les logs de requêtes en développement
                connect_timeout=timedelta(seconds=30)
            )
            
            # Tenter la connexion avec retry
            connected = await self._connect_with_retry()
            
            if connected:
                # Tester la connexion avec une requête simple
                await self._test_database_connection()
                self.is_connected = True
                logger.info("✅ Service de base de données Prisma initialisé avec succès")
                logger.info(f"📊 Base de données connectée après {self.connection_retries + 1} tentative(s)")
                return True
            else:
                logger.error("❌ Impossible de se connecter à la base de données après plusieurs tentatives")
                return False
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation de la base de données: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def _connect_with_retry(self) -> bool:
        """Tente de se connecter à la base de données avec retry"""
        for attempt in range(self.max_retries):
            try:
                self.connection_retries = attempt
                logger.info(f"🔄 Tentative de connexion à la base de données ({attempt + 1}/{self.max_retries})...")
                
                await self.prisma.connect()
                logger.info("✅ Connexion Prisma établie")
                return True
                
            except Exception as e:
                logger.warning(f"⚠️  Tentative {attempt + 1} échouée: {e}")
                
                if attempt < self.max_retries - 1:
                    logger.info(f"⏳ Nouvelle tentative dans {self.retry_delay} secondes...")
                    await asyncio.sleep(self.retry_delay)
                    # Augmenter le délai pour le prochain retry
                    self.retry_delay = min(self.retry_delay * 1.5, 10)
                else:
                    logger.error("❌ Toutes les tentatives de connexion ont échoué")
                    
        return False
    
    async def _test_database_connection(self):
        """Teste la connexion à la base de données avec des requêtes de test"""
        try:
            logger.info("🧪 Test de la connexion à la base de données...")
            
            # Test 1: Requête raw simple pour vérifier la connexion
            await self.prisma.execute_raw('SELECT 1')
            logger.info("✅ Test 1: Requête raw réussie")
            
            # Test 2: Compter les utilisateurs (sans erreur si la table est vide)
            try:
                user_count = await self.prisma.user.count()
                logger.info(f"✅ Test 2: Comptage des utilisateurs réussi ({user_count} utilisateurs)")
            except Exception as e:
                logger.warning(f"⚠️  Test 2: Impossible de compter les utilisateurs: {e}")
            
            # Test 3: Compter les messages (sans erreur si la table est vide)
            try:
                message_count = await self.prisma.message.count()
                logger.info(f"✅ Test 3: Comptage des messages réussi ({message_count} messages)")
            except Exception as e:
                logger.warning(f"⚠️  Test 3: Impossible de compter les messages: {e}")
                
            # Test 4: Compter les traductions (sans erreur si la table est vide)
            try:
                translation_count = await self.prisma.messagetranslation.count()
                logger.info(f"✅ Test 4: Comptage des traductions réussi ({translation_count} traductions)")
            except Exception as e:
                logger.warning(f"⚠️  Test 4: Impossible de compter les traductions: {e}")
            
            logger.info("🎯 Tous les tests de connexion à la base de données sont terminés")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du test de la base de données: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé de la connexion à la base de données"""
        health_data = {
            'database_connected': self.is_connected,
            'prisma_client_initialized': self.prisma is not None,
            'connection_retries': self.connection_retries,
            'timestamp': datetime.now().isoformat()
        }
        
        if self.is_connected and self.prisma:
            try:
                # Test rapide de connexion
                await self.prisma.execute_raw('SELECT 1')
                health_data['database_responsive'] = True
                health_data['last_ping'] = datetime.now().isoformat()
            except Exception as e:
                health_data['database_responsive'] = False
                health_data['ping_error'] = str(e)
                logger.warning(f"⚠️  Base de données non responsive lors du health check: {e}")
        else:
            health_data['database_responsive'] = False
        
        return health_data
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques de connexion"""
        return {
            'is_connected': self.is_connected,
            'connection_retries': self.connection_retries,
            'max_retries': self.max_retries,
            'prisma_initialized': self.prisma is not None
        }
    
    async def cleanup(self):
        """Nettoie et ferme la connexion à la base de données"""
        if self.prisma and self.is_connected:
            try:
                logger.info("🧹 Fermeture de la connexion à la base de données...")
                await self.prisma.disconnect()
                self.is_connected = False
                logger.info("✅ Connexion à la base de données fermée proprement")
            except Exception as e:
                logger.error(f"❌ Erreur lors de la fermeture de la base de données: {e}")
        
        self.prisma = None
    
    def get_prisma_client(self) -> Optional[Prisma]:
        """Retourne le client Prisma si connecté"""
        if self.is_connected and self.prisma:
            return self.prisma
        return None
    
    async def reconnect(self) -> bool:
        """Tente de reconnecter à la base de données"""
        logger.info("🔄 Tentative de reconnexion à la base de données...")
        
        # Nettoyer la connexion existante
        await self.cleanup()
        
        # Réinitialiser les compteurs
        self.connection_retries = 0
        self.retry_delay = 2
        
        # Retenter l'initialisation
        return await self.initialize()
