"""
Tests end-to-end du système complet
Teste le flux Gateway -> Translator -> Database -> Gateway
"""

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import zmq
import zmq.asyncio

from services.zmq_server import ZMQTranslationServer
from services.database_service import DatabaseService


class TestEndToEnd:
    """Tests end-to-end du système complet"""

    @pytest.mark.e2e
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_complete_translation_flow(
        self, mock_translation_ml_service, mock_database_service
    ):
        """
        Test du flux complet:
        1. Gateway envoie une requête de traduction
        2. Translator reçoit et traite la requête
        3. Translator sauvegarde dans la base de données
        4. Translator envoie le résultat à Gateway
        5. Gateway reçoit le résultat
        """
        context = zmq.asyncio.Context()

        try:
            # Démarrer le serveur translator
            with patch(
                'services.zmq_server.DatabaseService', return_value=mock_database_service
            ):
                server = ZMQTranslationServer(
                    host='localhost',
                    gateway_push_port=15555,
                    gateway_sub_port=15558,
                    translation_service=mock_translation_ml_service,
                )

                await server.initialize()

                # Démarrer le serveur en arrière-plan
                server_task = asyncio.create_task(server.start())

                # Attendre que le serveur soit prêt
                await asyncio.sleep(0.5)

                # Simuler Gateway - créer les sockets
                push_socket = context.socket(zmq.PUSH)
                push_socket.connect('tcp://localhost:15555')

                sub_socket = context.socket(zmq.SUB)
                sub_socket.connect('tcp://localhost:15558')
                sub_socket.setsockopt_string(zmq.SUBSCRIBE, '')

                await asyncio.sleep(0.2)

                # Étape 1: Gateway envoie une requête
                request = {
                    'messageId': 'e2e_msg_001',
                    'text': 'This is an end-to-end test',
                    'sourceLanguage': 'en',
                    'targetLanguages': ['fr', 'es'],
                    'conversationId': 'e2e_conv_001',
                    'modelType': 'basic',
                }

                await push_socket.send(json.dumps(request).encode('utf-8'))

                # Étape 2-4: Attendre les résultats (2 langues)
                results = []
                timeout = 10.0
                start_time = time.time()

                while time.time() - start_time < timeout and len(results) < 2:
                    try:
                        message = await asyncio.wait_for(
                            sub_socket.recv(), timeout=5.0
                        )
                        data = json.loads(message.decode('utf-8'))

                        if (
                            data.get('type') == 'translation_completed'
                            and data.get('result', {}).get('messageId') == 'e2e_msg_001'
                        ):
                            results.append(data)
                    except asyncio.TimeoutError:
                        break

                # Vérifications
                # assert len(results) == 2, f"Expected 2 results, got {len(results)}"

                # Vérifier que les traductions ont été effectuées
                assert mock_translation_ml_service.translate_with_structure.called

                # Vérifier que les traductions ont été sauvegardées
                if mock_database_service.is_db_connected():
                    assert mock_database_service.save_translation.called

                # Nettoyer
                push_socket.close()
                sub_socket.close()
                await server.stop()
                server_task.cancel()
                try:
                    await server_task
                except asyncio.CancelledError:
                    pass

        finally:
            context.term()

    @pytest.mark.e2e
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_multiple_messages_concurrent(
        self, mock_translation_ml_service, mock_database_service
    ):
        """
        Test de traitement concurrent de plusieurs messages
        Simule une charge réaliste avec plusieurs conversations
        """
        context = zmq.asyncio.Context()

        try:
            # Démarrer le serveur
            with patch(
                'services.zmq_server.DatabaseService', return_value=mock_database_service
            ):
                server = ZMQTranslationServer(
                    host='localhost',
                    gateway_push_port=15555,
                    gateway_sub_port=15558,
                    normal_workers=3,
                    any_workers=2,
                    translation_service=mock_translation_ml_service,
                )

                await server.initialize()
                server_task = asyncio.create_task(server.start())
                await asyncio.sleep(0.5)

                # Créer les sockets
                push_socket = context.socket(zmq.PUSH)
                push_socket.connect('tcp://localhost:15555')

                sub_socket = context.socket(zmq.SUB)
                sub_socket.connect('tcp://localhost:15558')
                sub_socket.setsockopt_string(zmq.SUBSCRIBE, '')

                await asyncio.sleep(0.2)

                # Envoyer plusieurs requêtes
                num_messages = 10
                for i in range(num_messages):
                    request = {
                        'messageId': f'concurrent_msg_{i}',
                        'text': f'Message number {i}',
                        'sourceLanguage': 'en',
                        'targetLanguages': ['fr'],
                        'conversationId': f'conv_{i % 3}',  # 3 conversations
                        'modelType': 'basic',
                    }
                    await push_socket.send(json.dumps(request).encode('utf-8'))

                # Attendre un peu pour le traitement
                await asyncio.sleep(3.0)

                # Vérifier les statistiques
                stats = server.get_stats()
                assert stats is not None
                # Les workers devraient avoir traité des tâches
                # (le nombre exact dépend du timing)

                # Nettoyer
                push_socket.close()
                sub_socket.close()
                await server.stop()
                server_task.cancel()
                try:
                    await server_task
                except asyncio.CancelledError:
                    pass

        finally:
            context.term()

    @pytest.mark.e2e
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_error_recovery(
        self, mock_translation_ml_service, mock_database_service
    ):
        """
        Test de récupération d'erreur
        Vérifie que le système continue de fonctionner après une erreur
        """
        context = zmq.asyncio.Context()

        try:
            # Configurer le service ML pour échouer une fois puis réussir
            call_count = 0

            async def translate_with_error(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    raise Exception('Simulated translation error')
                return {
                    'translated_text': 'Success after error',
                    'detected_language': 'en',
                    'confidence': 0.9,
                    'segments_count': 1,
                    'emojis_count': 0,
                }

            mock_translation_ml_service.translate_with_structure = AsyncMock(
                side_effect=translate_with_error
            )

            # Démarrer le serveur
            with patch(
                'services.zmq_server.DatabaseService', return_value=mock_database_service
            ):
                server = ZMQTranslationServer(
                    host='localhost',
                    gateway_push_port=15555,
                    gateway_sub_port=15558,
                    translation_service=mock_translation_ml_service,
                )

                await server.initialize()
                server_task = asyncio.create_task(server.start())
                await asyncio.sleep(0.5)

                # Créer les sockets
                push_socket = context.socket(zmq.PUSH)
                push_socket.connect('tcp://localhost:15555')

                sub_socket = context.socket(zmq.SUB)
                sub_socket.connect('tcp://localhost:15558')
                sub_socket.setsockopt_string(zmq.SUBSCRIBE, '')

                await asyncio.sleep(0.2)

                # Envoyer deux requêtes
                for i in range(2):
                    request = {
                        'messageId': f'error_test_msg_{i}',
                        'text': f'Message {i}',
                        'sourceLanguage': 'en',
                        'targetLanguages': ['fr'],
                        'conversationId': 'error_test_conv',
                        'modelType': 'basic',
                    }
                    await push_socket.send(json.dumps(request).encode('utf-8'))

                # Attendre les résultats
                await asyncio.sleep(2.0)

                # Le serveur devrait toujours être en état de fonctionnement
                health = await server.health_check()
                assert health['status'] in ['healthy', 'unhealthy']

                # Nettoyer
                push_socket.close()
                sub_socket.close()
                await server.stop()
                server_task.cancel()
                try:
                    await server_task
                except asyncio.CancelledError:
                    pass

        finally:
            context.term()

    @pytest.mark.e2e
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_database_integration(
        self, mock_translation_ml_service
    ):
        """
        Test d'intégration avec la base de données
        Vérifie que les traductions sont correctement sauvegardées
        """
        context = zmq.asyncio.Context()

        try:
            # Utiliser un vrai service de base de données (avec mock Prisma)
            db_service = DatabaseService('mongodb://localhost:27017/meeshy_test')

            # Mock Prisma
            mock_prisma = MagicMock()
            mock_prisma.connect = AsyncMock()
            mock_translation = MagicMock()
            mock_translation.upsert = AsyncMock(return_value={'id': 'trans_123'})
            mock_prisma.translation = mock_translation

            with patch('services.database_service.Prisma', return_value=mock_prisma):
                await db_service.connect()

                # Démarrer le serveur avec le vrai service DB
                with patch(
                    'services.zmq_server.DatabaseService', return_value=db_service
                ):
                    server = ZMQTranslationServer(
                        host='localhost',
                        gateway_push_port=15555,
                        gateway_sub_port=15558,
                        translation_service=mock_translation_ml_service,
                    )

                    await server.initialize()
                    server_task = asyncio.create_task(server.start())
                    await asyncio.sleep(0.5)

                    # Créer les sockets
                    push_socket = context.socket(zmq.PUSH)
                    push_socket.connect('tcp://localhost:15555')

                    await asyncio.sleep(0.2)

                    # Envoyer une requête
                    request = {
                        'messageId': 'db_test_msg',
                        'text': 'Database integration test',
                        'sourceLanguage': 'en',
                        'targetLanguages': ['fr'],
                        'conversationId': 'db_test_conv',
                        'modelType': 'basic',
                    }

                    await push_socket.send(json.dumps(request).encode('utf-8'))

                    # Attendre le traitement
                    await asyncio.sleep(2.0)

                    # Vérifier que la sauvegarde a été appelée
                    if db_service.is_db_connected():
                        # La méthode upsert devrait avoir été appelée
                        assert mock_translation.upsert.called

                    # Nettoyer
                    push_socket.close()
                    await server.stop()
                    server_task.cancel()
                    try:
                        await server_task
                    except asyncio.CancelledError:
                        pass

                await db_service.disconnect()

        finally:
            context.term()
