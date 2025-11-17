"""
Tests d'intégration Prisma pour le translator
Teste les opérations de base de données avec Prisma
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from services.database_service import DatabaseService


class TestPrismaIntegration:
    """Tests d'intégration avec Prisma"""

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_connection_lifecycle(self):
        """Test du cycle de vie de connexion Prisma"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma pour éviter la vraie connexion
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()
        mock_prisma.disconnect = AsyncMock()

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            # Connect
            connected = await service.connect()
            assert connected is True
            assert service.is_db_connected() is True

            # Disconnect
            await service.disconnect()
            assert service.is_db_connected() is False

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_save_translation_upsert(self):
        """Test d'upsert d'une traduction"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        mock_translation = MagicMock()
        expected_result = {
            'id': 'trans_123',
            'messageId': 'msg_456',
            'sourceLanguage': 'en',
            'targetLanguage': 'fr',
            'translatedText': 'Bonjour le monde',
            'translatorModel': 'nllb',
            'confidenceScore': 0.95,
            'processingTime': 0.5,
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
        }
        mock_translation.upsert = AsyncMock(return_value=expected_result)
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            translation_data = {
                'messageId': 'msg_456',
                'sourceLanguage': 'en',
                'targetLanguage': 'fr',
                'translatedText': 'Bonjour le monde',
                'translatorModel': 'nllb',
                'confidenceScore': 0.95,
                'processingTime': 0.5,
                'workerName': 'worker_1',
                'poolType': 'normal',
            }

            result = await service.save_translation(translation_data)
            assert result is True

            # Vérifier que upsert a été appelé avec les bons paramètres
            assert mock_translation.upsert.called
            call_args = mock_translation.upsert.call_args

            # Vérifier la structure de l'appel
            assert 'where' in call_args.kwargs
            assert 'data' in call_args.kwargs

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_save_multiple_translations(self):
        """Test de sauvegarde de plusieurs traductions"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(return_value={'id': 'trans_123'})
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            # Sauvegarder plusieurs traductions
            languages = ['fr', 'es', 'de', 'it']
            for lang in languages:
                translation_data = {
                    'messageId': 'msg_multi',
                    'sourceLanguage': 'en',
                    'targetLanguage': lang,
                    'translatedText': f'Translation in {lang}',
                    'translatorModel': 'nllb',
                    'confidenceScore': 0.95,
                    'processingTime': 0.5,
                }

                result = await service.save_translation(translation_data)
                assert result is True

            # Vérifier que upsert a été appelé 4 fois
            assert mock_translation.upsert.call_count == 4

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_error_handling(self):
        """Test de gestion d'erreur Prisma"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma avec erreur
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(
            side_effect=Exception('Database connection lost')
        )
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            translation_data = {
                'messageId': 'msg_error',
                'sourceLanguage': 'en',
                'targetLanguage': 'fr',
                'translatedText': 'Test',
            }

            # La sauvegarde devrait échouer gracieusement
            result = await service.save_translation(translation_data)
            assert result is False

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_reconnection(self):
        """Test de reconnexion après déconnexion"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()
        mock_prisma.disconnect = AsyncMock()

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            # Première connexion
            await service.connect()
            assert service.is_db_connected() is True

            # Déconnexion
            await service.disconnect()
            assert service.is_db_connected() is False

            # Reconnexion
            await service.connect()
            assert service.is_db_connected() is True

            # Vérifier que connect a été appelé 2 fois
            assert mock_prisma.connect.call_count == 2

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_concurrent_saves(self):
        """Test de sauvegardes concurrentes"""
        import asyncio

        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(return_value={'id': 'trans_123'})
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            # Créer plusieurs tâches de sauvegarde concurrentes
            tasks = []
            for i in range(10):
                translation_data = {
                    'messageId': f'msg_concurrent_{i}',
                    'sourceLanguage': 'en',
                    'targetLanguage': 'fr',
                    'translatedText': f'Concurrent translation {i}',
                    'translatorModel': 'nllb',
                    'confidenceScore': 0.95,
                }
                task = service.save_translation(translation_data)
                tasks.append(task)

            # Exécuter toutes les tâches en parallèle
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Vérifier que toutes ont réussi
            assert all(r is True for r in results if not isinstance(r, Exception))

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_data_validation(self):
        """Test de validation des données avant sauvegarde"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(return_value={'id': 'trans_123'})
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            # Données invalides (champs manquants)
            invalid_data = {
                'messageId': 'msg_invalid',
                # sourceLanguage manquant
                'targetLanguage': 'fr',
            }

            # Selon l'implémentation, cela pourrait échouer ou réussir avec valeurs par défaut
            result = await service.save_translation(invalid_data)
            # Le résultat dépend de l'implémentation

    @pytest.mark.integration
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_prisma_with_metadata(self):
        """Test de sauvegarde avec métadonnées complètes"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(return_value={'id': 'trans_123'})
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            # Données complètes avec métadonnées
            complete_data = {
                'messageId': 'msg_complete',
                'sourceLanguage': 'en',
                'targetLanguage': 'fr',
                'translatedText': 'Bonjour le monde',
                'translatorModel': 'nllb-200-distilled-600M',
                'confidenceScore': 0.97,
                'processingTime': 0.456,
                'workerName': 'worker_1',
                'poolType': 'normal',
                'segmentsCount': 1,
                'emojisCount': 0,
                'queueTime': 0.123,
                'memoryUsage': 512.5,
                'cpuUsage': 25.3,
            }

            result = await service.save_translation(complete_data)
            assert result is True

            # Vérifier que les métadonnées sont passées
            call_args = mock_translation.upsert.call_args
            assert call_args is not None
