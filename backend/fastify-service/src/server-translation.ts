/**
 * Serveur Fastify simplifié avec WebSocket et traduction
 * Version optimisée pour Meeshy
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '../../shared/generated';
import { webSocketManager } from './websocket/websocket-manager';
import { logger } from './utils/logger';

// Configuration du serveur
const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Initialisation de Prisma
const prisma = new PrismaClient();

// Configuration CORS
server.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true
});

// Configuration WebSocket avec traduction
webSocketManager.setupWebSocket(server);

// Routes de base
server.get('/', async (request, reply) => {
  return { 
    message: 'Meeshy API Gateway with Translation',
    version: '2.0.0',
    features: ['WebSocket', 'Real-time Translation', 'Multi-language Chat'],
    endpoints: {
      websocket: '/ws',
      health: '/health',
      stats: '/stats'
    },
    translation: {
      service: 'Python gRPC Translation Service',
      models: ['basic', 'medium', 'premium'],
      languages: ['fr', 'en', 'es', 'de', 'pt', 'it', 'nl', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'pl', 'sv']
    }
  };
});

// Route de santé
server.get('/health', async (request, reply) => {
  try {
    // Vérifier la connexion à la base de données
    await prisma.$queryRaw`SELECT 1`;
    
    // Vérifier le service WebSocket
    const wsStats = webSocketManager.getStats();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        websocket: 'active',
        translation: wsStats.translationServiceReady ? 'ready' : 'loading'
      },
      connections: {
        total: wsStats.totalConnections,
        authenticated: wsStats.authenticatedConnections,
        users: wsStats.uniqueUsers
      }
    };
  } catch (error) {
    logger.error('❌ Erreur health check:', error);
    reply.status(503);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    };
  }
});

// Route des statistiques WebSocket et traduction
server.get('/stats', async (request, reply) => {
  const stats = webSocketManager.getStats();
  
  return {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version,
      timestamp: new Date().toISOString()
    },
    websocket: stats,
    database: {
      status: 'connected'
    }
  };
});

// Route de test de traduction (pour debug)
server.get('/test-translation', async (request, reply) => {
  try {
    const { text = 'Hello, how are you?', languages = 'fr,es' } = request.query as any;
    const targetLanguages = languages.split(',');
    
    // Simuler une traduction pour le test
    return {
      original: text,
      translations: targetLanguages.map((lang: string) => ({
        language: lang,
        text: `[${lang.toUpperCase()}] ${text}`, // Simulation
        model: 'test'
      })),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Erreur test traduction:', error);
    reply.status(500);
    return { error: 'Translation test failed' };
  }
});

// Route pour récupérer l'historique des messages d'une conversation
server.get('/conversations/:id/messages', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const { limit = 50, offset = 0 } = request.query as any;

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      include: {
        sender: {
          select: { id: true, username: true }
        },
        translations: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    return {
      messages: messages.reverse(), // Ordre chronologique
      count: messages.length,
      hasMore: messages.length === parseInt(limit)
    };
  } catch (error) {
    logger.error('❌ Erreur récupération messages:', error);
    reply.status(500);
    return { error: 'Failed to fetch messages' };
  }
});

// Route pour récupérer les traductions d'un message
server.get('/messages/:id/translations', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };

    const translations = await prisma.messageTranslation.findMany({
      where: { messageId: id },
      orderBy: { createdAt: 'desc' }
    });

    return {
      messageId: id,
      translations,
      count: translations.length
    };
  } catch (error) {
    logger.error('❌ Erreur récupération traductions:', error);
    reply.status(500);
    return { error: 'Failed to fetch translations' };
  }
});

// Middleware d'authentification JWT pour les routes protégées
server.addHook('preHandler', async (request, reply) => {
  // Routes publiques (pas d'authentification requise)
  const publicRoutes = ['/', '/health', '/stats', '/test-translation', '/ws'];
  const isPublicRoute = publicRoutes.some(route => request.url === route || request.url.startsWith(route + '?'));
  
  if (isPublicRoute) {
    return;
  }

  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      reply.status(401).send({ error: 'Token required' });
      return;
    }

    // TODO: Vérifier le JWT ici pour les routes protégées
    // Pour maintenant, on laisse passer
  } catch (error) {
    reply.status(401).send({ error: 'Invalid token' });
  }
});

// Gestionnaire d'erreur global
server.setErrorHandler((error, request, reply) => {
  logger.error('❌ Erreur serveur:', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method
  });
  
  reply.status(500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Démarrage du serveur
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080');
    const host = process.env.HOST || '0.0.0.0';
    
    logger.info('🚀 Démarrage du serveur Meeshy avec traduction...');
    
    // Vérifier la connexion à la base de données
    await prisma.$connect();
    logger.info('✅ Connexion à la base de données établie');
    
    // Démarrer le serveur
    await server.listen({ port, host });
    
    logger.info(`✅ Serveur Meeshy démarré sur http://${host}:${port}`);
    logger.info(`🔌 WebSocket disponible sur ws://${host}:${port}/ws`);
    logger.info(`📊 Statistiques disponibles sur http://${host}:${port}/stats`);
    logger.info(`🌐 Test traduction disponible sur http://${host}:${port}/test-translation`);
    logger.info(`🔧 Routes API:`);
    logger.info(`   GET /conversations/:id/messages - Historique des messages`);
    logger.info(`   GET /messages/:id/translations - Traductions d'un message`);
    
  } catch (error) {
    logger.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
};

// Gestion propre de l'arrêt
const gracefulShutdown = async (signal: string) => {
  logger.info(`📡 Signal ${signal} reçu, arrêt en cours...`);
  
  try {
    await server.close();
    await prisma.$disconnect();
    logger.info('✅ Serveur arrêté proprement');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
};

// Écouter les signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection:', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Démarrer le serveur
if (require.main === module) {
  start();
}

export default server;
