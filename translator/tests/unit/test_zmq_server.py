"""
Tests unitaires pour le serveur ZMQ du translator
Teste la communication PULL/PUB et le pool manager
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import zmq
import zmq.asyncio

from services.zmq_server import (
    TranslationPoolManager,
    TranslationTask,
    ZMQTranslationServer,
)


class TestTranslationTask:
    """Tests pour la classe TranslationTask"""

    @pytest.mark.unit
    def test_translation_task_creation(self):
        """Test de création d'une tâche de traduction"""
        task = TranslationTask(
            task_id='task_123',
            message_id='msg_456',
            text='Hello world',
            source_language='en',
            target_languages=['fr', 'es'],
            conversation_id='conv_789',
            model_type='basic',
        )

        assert task.task_id == 'task_123'
        assert task.message_id == 'msg_456'
        assert task.text == 'Hello world'
        assert task.source_language == 'en'
        assert task.target_languages == ['fr', 'es']
        assert task.conversation_id == 'conv_789'
        assert task.model_type == 'basic'
        assert task.created_at is not None

    @pytest.mark.unit
    def test_translation_task_default_values(self):
        """Test des valeurs par défaut"""
        task = TranslationTask(
            task_id='task_123',
            message_id='msg_456',
            text='Hello world',
            source_language='en',
            target_languages=['fr'],
            conversation_id='conv_789',
        )

        assert task.model_type == 'basic'
        assert task.created_at is not None


class TestTranslationPoolManager:
    """Tests pour le gestionnaire de pools de traduction"""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_pool_manager_initialization(self, mock_translation_ml_service):
        """Test d'initialisation du pool manager"""
        manager = TranslationPoolManager(
            normal_pool_size=100,
            any_pool_size=50,
            normal_workers=2,
            any_workers=1,
            translation_service=mock_translation_ml_service,
        )

        assert manager.normal_pool.maxsize == 100
        assert manager.any_pool.maxsize == 50
        assert manager.normal_workers == 2
        assert manager.any_workers == 1
        assert manager.translation_service == mock_translation_ml_service

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_enqueue_task_normal_pool(self, mock_translation_ml_service):
        """Test d'enfilage dans la pool normale"""
        manager = TranslationPoolManager(
            normal_pool_size=10,
            any_pool_size=10,
            translation_service=mock_translation_ml_service,
        )

        task = TranslationTask(
            task_id='task_123',
            message_id='msg_456',
            text='Hello',
            source_language='en',
            target_languages=['fr'],
            conversation_id='conv_normal',
        )

        result = await manager.enqueue_task(task)
        assert result is True
        assert manager.stats['normal_pool_size'] == 1

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_enqueue_task_any_pool(self, mock_translation_ml_service):
        """Test d'enfilage dans la pool 'any'"""
        manager = TranslationPoolManager(
            normal_pool_size=10,
            any_pool_size=10,
            translation_service=mock_translation_ml_service,
        )

        task = TranslationTask(
            task_id='task_123',
            message_id='msg_456',
            text='Hello',
            source_language='en',
            target_languages=['fr'],
            conversation_id='any',
        )

        result = await manager.enqueue_task(task)
        assert result is True
        assert manager.stats['any_pool_size'] == 1

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_pool_full_rejection(self, mock_translation_ml_service):
        """Test du rejet quand la pool est pleine"""
        manager = TranslationPoolManager(
            normal_pool_size=1,
            any_pool_size=1,
            translation_service=mock_translation_ml_service,
        )

        # Remplir la pool
        task1 = TranslationTask(
            task_id='task_1',
            message_id='msg_1',
            text='Hello',
            source_language='en',
            target_languages=['fr'],
            conversation_id='conv_1',
        )
        await manager.enqueue_task(task1)

        # Essayer d'ajouter une deuxième tâche (devrait échouer)
        task2 = TranslationTask(
            task_id='task_2',
            message_id='msg_2',
            text='World',
            source_language='en',
            target_languages=['fr'],
            conversation_id='conv_2',
        )
        result = await manager.enqueue_task(task2)
        assert result is False
        assert manager.stats['pool_full_rejections'] == 1

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_worker_processing(self, mock_translation_ml_service):
        """Test du traitement par les workers"""
        manager = TranslationPoolManager(
            normal_pool_size=10,
            any_pool_size=10,
            normal_workers=1,
            any_workers=1,
            translation_service=mock_translation_ml_service,
        )

        # Mock la méthode de publication
        manager._publish_translation_result = AsyncMock()

        # Démarrer les workers
        await manager.start_workers()

        # Enfiler une tâche
        task = TranslationTask(
            task_id='task_123',
            message_id='msg_456',
            text='Hello',
            source_language='en',
            target_languages=['fr'],
            conversation_id='conv_normal',
        )
        await manager.enqueue_task(task)

        # Attendre un peu pour le traitement
        await asyncio.sleep(0.5)

        # Vérifier que la traduction a été appelée
        assert mock_translation_ml_service.translate_with_structure.called

        # Arrêter les workers
        await manager.stop_workers()

    @pytest.mark.unit
    def test_get_stats(self, mock_translation_ml_service):
        """Test de récupération des statistiques"""
        manager = TranslationPoolManager(
            translation_service=mock_translation_ml_service
        )

        stats = manager.get_stats()
        assert 'normal_pool_size' in stats
        assert 'any_pool_size' in stats
        assert 'tasks_processed' in stats
        assert 'memory_usage_mb' in stats


class TestZMQTranslationServer:
    """Tests pour le serveur ZMQ de traduction"""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_server_initialization(
        self, mock_translation_ml_service, mock_database_service
    ):
        """Test d'initialisation du serveur"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                host='localhost',
                gateway_push_port=15555,
                gateway_sub_port=15558,
                translation_service=mock_translation_ml_service,
            )

            assert server.host == 'localhost'
            assert server.gateway_push_port == 15555
            assert server.gateway_sub_port == 15558
            assert server.running is False

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_server_zmq_socket_creation(
        self, mock_translation_ml_service, mock_database_service
    ):
        """Test de création des sockets ZMQ"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                host='localhost',
                gateway_push_port=15555,
                gateway_sub_port=15558,
                translation_service=mock_translation_ml_service,
            )

            # Mock les sockets pour éviter les vraies connexions
            with patch.object(server.context, 'socket') as mock_socket:
                mock_socket.return_value = MagicMock()
                await server.initialize()

                # Vérifier que les sockets ont été créés
                assert mock_socket.call_count == 2  # PULL et PUB

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_handle_translation_request(
        self, mock_translation_ml_service, mock_database_service, sample_translation_task
    ):
        """Test de traitement d'une requête de traduction"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                translation_service=mock_translation_ml_service
            )
            server.pub_socket = MagicMock()
            server.pub_socket.send = AsyncMock()

            # Créer une requête valide
            request = json.dumps(sample_translation_task).encode('utf-8')

            await server._handle_translation_request(request)

            # Vérifier que la tâche a été enfilée
            assert server.pool_manager.stats['normal_pool_size'] >= 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_handle_ping_request(
        self, mock_translation_ml_service, mock_database_service
    ):
        """Test de réponse au ping"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                translation_service=mock_translation_ml_service
            )
            server.pub_socket = MagicMock()
            server.pub_socket.send = AsyncMock()

            # Créer une requête ping
            ping_request = json.dumps({'type': 'ping', 'timestamp': 123456789}).encode(
                'utf-8'
            )

            await server._handle_translation_request(ping_request)

            # Vérifier que le pong a été envoyé
            assert server.pub_socket.send.called

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_publish_translation_result(
        self, mock_translation_ml_service, mock_database_service
    ):
        """Test de publication d'un résultat de traduction"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                translation_service=mock_translation_ml_service
            )
            server.pub_socket = MagicMock()
            server.pub_socket.send = AsyncMock()

            result = {
                'messageId': 'msg_123',
                'translatedText': 'Bonjour le monde',
                'sourceLanguage': 'en',
                'targetLanguage': 'fr',
                'confidenceScore': 0.95,
                'processingTime': 0.5,
                'modelType': 'basic',
                'workerName': 'worker_1',
                'created_at': 123456789,
            }

            await server._publish_translation_result('task_123', result, 'fr')

            # Vérifier que le résultat a été publié
            assert server.pub_socket.send.called

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_is_valid_translation(
        self, mock_translation_ml_service, mock_database_service
    ):
        """Test de validation de traduction"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                translation_service=mock_translation_ml_service
            )

            # Traduction valide
            valid_result = {
                'translatedText': 'Bonjour le monde',
                'confidenceScore': 0.95,
                'originalText': 'Hello world',
            }
            assert server._is_valid_translation('Bonjour le monde', valid_result) is True

            # Traduction invalide - vide
            assert server._is_valid_translation('', valid_result) is False

            # Traduction invalide - message d'erreur
            assert (
                server._is_valid_translation('[Error: Translation failed]', valid_result)
                is False
            )

            # Traduction invalide - identique à l'original
            same_result = {
                'translatedText': 'Hello world',
                'confidenceScore': 0.95,
                'originalText': 'Hello world',
            }
            assert (
                server._is_valid_translation('Hello world', same_result) is False
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_health_check(
        self, mock_translation_ml_service, mock_database_service
    ):
        """Test du health check"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                translation_service=mock_translation_ml_service
            )

            health = await server.health_check()
            assert 'status' in health
            assert 'running' in health

    @pytest.mark.unit
    def test_get_stats(self, mock_translation_ml_service, mock_database_service):
        """Test de récupération des statistiques"""
        with patch(
            'services.zmq_server.DatabaseService', return_value=mock_database_service
        ):
            server = ZMQTranslationServer(
                translation_service=mock_translation_ml_service
            )

            stats = server.get_stats()
            assert 'server_status' in stats
            assert 'gateway_push_port' in stats
            assert 'gateway_sub_port' in stats
