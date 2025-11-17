"""
Configuration globale pytest pour les tests du translator
Fixtures et configuration partagées
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import zmq.asyncio
from prisma import Prisma

# Ajouter le répertoire src au path pour les imports
src_path = Path(__file__).parent / 'src'
sys.path.insert(0, str(src_path))

# Configuration des variables d'environnement pour les tests
os.environ['MODELS_PATH'] = '/tmp/test_models'
os.environ['NODE_ENV'] = 'test'
os.environ['DATABASE_URL'] = 'mongodb://localhost:27017/meeshy_test'
os.environ['TRANSLATOR_ZMQ_PULL_PORT'] = '15555'
os.environ['TRANSLATOR_ZMQ_PUB_PORT'] = '15558'
os.environ['TRANSLATION_WORKERS'] = '2'
os.environ['NORMAL_WORKERS_DEFAULT'] = '2'
os.environ['ANY_WORKERS_DEFAULT'] = '1'


# Fixtures pour la configuration
@pytest.fixture
def mock_settings():
    """Mock des settings du translator"""
    from config.settings import Settings

    with patch.object(Settings, '__init__', lambda x: None):
        settings = Settings()
        settings.fastapi_port = 18000
        settings.zmq_pull_port = 15555
        settings.zmq_pub_port = 15558
        settings.models_path = '/tmp/test_models'
        settings.redis_url = 'redis://localhost:6379/1'
        settings.database_url = 'mongodb://localhost:27017/meeshy_test'
        yield settings


# Fixtures pour les contextes ZMQ
@pytest.fixture
def zmq_context() -> Generator[zmq.asyncio.Context, None, None]:
    """Context ZMQ pour les tests"""
    context = zmq.asyncio.Context()
    yield context
    context.term()


@pytest.fixture
async def zmq_push_socket(zmq_context) -> AsyncGenerator:
    """Socket PUSH pour envoyer des messages au translator"""
    socket = zmq_context.socket(zmq.PUSH)
    socket.connect('tcp://localhost:15555')
    yield socket
    socket.close()


@pytest.fixture
async def zmq_sub_socket(zmq_context) -> AsyncGenerator:
    """Socket SUB pour recevoir des messages du translator"""
    socket = zmq_context.socket(zmq.SUB)
    socket.connect('tcp://localhost:15558')
    socket.setsockopt_string(zmq.SUBSCRIBE, '')
    yield socket
    socket.close()


# Fixtures pour les services ML
@pytest.fixture
def mock_translation_ml_service():
    """Mock du service de traduction ML"""
    service = MagicMock()
    service.initialize = AsyncMock(return_value=True)
    service.translate_with_structure = AsyncMock(return_value={
        'translated_text': 'Hello world',
        'detected_language': 'fr',
        'confidence': 0.95,
        'segments_count': 1,
        'emojis_count': 0,
    })
    service.get_stats = AsyncMock(return_value={
        'models_loaded': {'nllb': True, 't5': True},
        'translations_count': 0,
    })
    service.close = AsyncMock()
    return service


@pytest.fixture
def mock_database_service():
    """Mock du service de base de données"""
    service = MagicMock()
    service.connect = AsyncMock(return_value=True)
    service.disconnect = AsyncMock()
    service.save_translation = AsyncMock(return_value=True)
    service.is_db_connected = MagicMock(return_value=True)
    return service


# Fixtures pour Prisma
@pytest.fixture
async def prisma_client() -> AsyncGenerator[Prisma, None]:
    """Client Prisma pour les tests d'intégration"""
    # Utiliser une base de données de test
    prisma = Prisma()

    # Mock la connexion pour éviter de vraiment se connecter
    with patch.object(prisma, 'connect', new_callable=AsyncMock):
        with patch.object(prisma, 'disconnect', new_callable=AsyncMock):
            yield prisma


@pytest.fixture
async def clean_database(prisma_client: Prisma):
    """Nettoie la base de données avant et après chaque test"""
    # Nettoyage avant le test
    # Note: En mode test, on utilise des mocks donc pas de vraie DB à nettoyer
    yield
    # Nettoyage après le test
    pass


# Fixtures pour les données de test
@pytest.fixture
def sample_translation_task():
    """Tâche de traduction exemple"""
    return {
        'messageId': 'msg_123',
        'text': 'Bonjour le monde',
        'sourceLanguage': 'fr',
        'targetLanguages': ['en', 'es'],
        'conversationId': 'conv_456',
        'modelType': 'basic',
    }


@pytest.fixture
def sample_message_data():
    """Données de message exemple"""
    return {
        'id': 'msg_123',
        'content': 'Bonjour le monde',
        'conversationId': 'conv_456',
        'authorId': 'user_789',
        'createdAt': '2025-11-17T12:00:00Z',
    }


# Fixtures pour les mocks de modèles ML
@pytest.fixture
def mock_torch():
    """Mock de PyTorch pour éviter de charger les vrais modèles"""
    with patch('torch.load', return_value=MagicMock()):
        with patch('torch.cuda.is_available', return_value=False):
            with patch('torch.device', return_value='cpu'):
                yield


@pytest.fixture
def mock_transformers():
    """Mock de Transformers pour éviter de charger les vrais modèles"""
    mock_model = MagicMock()
    mock_model.generate = MagicMock(return_value=[[1, 2, 3]])

    mock_tokenizer = MagicMock()
    mock_tokenizer.encode = MagicMock(return_value=[1, 2, 3])
    mock_tokenizer.decode = MagicMock(return_value='Hello world')
    mock_tokenizer.batch_decode = MagicMock(return_value=['Hello world'])

    with patch('transformers.AutoModelForSeq2SeqLM.from_pretrained', return_value=mock_model):
        with patch('transformers.AutoTokenizer.from_pretrained', return_value=mock_tokenizer):
            with patch('transformers.M2M100ForConditionalGeneration.from_pretrained', return_value=mock_model):
                with patch('transformers.M2M100Tokenizer.from_pretrained', return_value=mock_tokenizer):
                    yield {'model': mock_model, 'tokenizer': mock_tokenizer}


# Hook pour configurer l'event loop asyncio
@pytest.fixture(scope='session')
def event_loop_policy():
    """Configure la policy d'event loop pour les tests async"""
    return asyncio.get_event_loop_policy()


# Configuration des markers pytest
def pytest_configure(config):
    """Configuration pytest custom"""
    config.addinivalue_line('markers', 'unit: Mark test as unit test')
    config.addinivalue_line('markers', 'integration: Mark test as integration test')
    config.addinivalue_line('markers', 'e2e: Mark test as end-to-end test')
    config.addinivalue_line('markers', 'slow: Mark test as slow running')
    config.addinivalue_line('markers', 'zmq: Mark test as ZMQ related')
    config.addinivalue_line('markers', 'ml: Mark test as ML related')
    config.addinivalue_line('markers', 'database: Mark test as database related')
