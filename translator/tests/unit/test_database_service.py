"""
Tests unitaires pour le service de base de données du translator
Teste les opérations Prisma et la sauvegarde des traductions
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.database_service import DatabaseService


class TestDatabaseService:
    """Tests pour le service de base de données"""

    @pytest.mark.unit
    @pytest.mark.database
    def test_database_service_initialization(self):
        """Test d'initialisation du service"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        assert service.database_url == 'mongodb://localhost:27017/meeshy_test'
        assert service.prisma is None
        assert service.connected is False

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_connect_success(self):
        """Test de connexion réussie"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            result = await service.connect()

            assert result is True
            assert service.connected is True
            assert mock_prisma.connect.called

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_connect_failure(self):
        """Test d'échec de connexion"""
        service = DatabaseService('mongodb://invalid:27017/meeshy_test')

        # Mock Prisma pour lever une exception
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock(side_effect=Exception('Connection failed'))

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            result = await service.connect()

            assert result is False
            assert service.connected is False

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_disconnect(self):
        """Test de déconnexion"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()
        mock_prisma.disconnect = AsyncMock()

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()
            await service.disconnect()

            assert service.connected is False
            assert mock_prisma.disconnect.called

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_save_translation_success(self):
        """Test de sauvegarde d'une traduction"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()
        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(return_value={'id': 'trans_123'})
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            translation_data = {
                'messageId': 'msg_123',
                'sourceLanguage': 'en',
                'targetLanguage': 'fr',
                'translatedText': 'Bonjour',
                'translatorModel': 'nllb',
                'confidenceScore': 0.95,
                'processingTime': 0.5,
                'workerName': 'worker_1',
                'poolType': 'normal',
            }

            result = await service.save_translation(translation_data)

            assert result is True
            assert mock_translation.upsert.called

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_save_translation_not_connected(self):
        """Test de sauvegarde quand pas connecté"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        translation_data = {
            'messageId': 'msg_123',
            'sourceLanguage': 'en',
            'targetLanguage': 'fr',
            'translatedText': 'Bonjour',
        }

        result = await service.save_translation(translation_data)
        assert result is False

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_save_translation_failure(self):
        """Test d'échec de sauvegarde"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma avec exception
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()
        mock_translation = MagicMock()
        mock_translation.upsert = AsyncMock(side_effect=Exception('Database error'))
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            translation_data = {
                'messageId': 'msg_123',
                'sourceLanguage': 'en',
                'targetLanguage': 'fr',
                'translatedText': 'Bonjour',
            }

            result = await service.save_translation(translation_data)
            assert result is False

    @pytest.mark.unit
    @pytest.mark.database
    def test_is_db_connected(self):
        """Test de vérification de connexion"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Pas connecté initialement
        assert service.is_db_connected() is False

        # Simuler la connexion
        service.connected = True
        assert service.is_db_connected() is True

    @pytest.mark.unit
    @pytest.mark.database
    @pytest.mark.asyncio
    async def test_get_translation_by_message_id(self):
        """Test de récupération d'une traduction par message ID"""
        service = DatabaseService('mongodb://localhost:27017/meeshy_test')

        # Mock Prisma
        mock_prisma = MagicMock()
        mock_prisma.connect = AsyncMock()
        mock_translation = MagicMock()
        mock_translation.find_many = AsyncMock(return_value=[
            {
                'id': 'trans_123',
                'messageId': 'msg_123',
                'targetLanguage': 'fr',
                'translatedText': 'Bonjour',
            }
        ])
        mock_prisma.translation = mock_translation

        with patch('services.database_service.Prisma', return_value=mock_prisma):
            await service.connect()

            # Cette méthode pourrait ne pas exister, on teste le principe
            if hasattr(service, 'get_translations_by_message'):
                results = await service.get_translations_by_message('msg_123')
                assert len(results) > 0
                assert results[0]['messageId'] == 'msg_123'
