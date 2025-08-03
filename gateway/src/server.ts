import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { PrismaClient } from '../../shared/generated';
import winston from 'winston';

// Déclarations TypeScript pour Fastify
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { conversationRoutes } from './routes/conversations';
import { groupRoutes } from './routes/groups';
import { friendRequestRoutes } from './routes/friends';
import { notificationRoutes } from './routes/notifications';
import { shareLinksRoutes } from './routes/share-links';
import { adminRoutes } from './routes/admin';
import { translationRoutes } from './routes/translation';
import { MeeshyWebSocketHandler } from './websocket/handler';
import { GrpcClient } from './grpc/client';

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Initialisation de Prisma
const prisma = new PrismaClient();

// Initialisation du client gRPC
const grpcClient = new GrpcClient();

// Création du serveur Fastify
const server = fastify({
  logger: {
    level: 'info',
    stream: {
      write: (msg: string) => {
        logger.info(msg.trim());
      }
    }
  }
});

// Middleware d'authentification
server.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ 
      success: false, 
      message: 'Token invalide ou expiré' 
    });
  }
});

// Décoration des plugins
server.decorate('prisma', prisma);
server.decorate('grpcClient', grpcClient);

async function start() {
  try {
    // Configuration de la sécurité
    await server.register(helmet, {
      contentSecurityPolicy: false
    });

    // Configuration CORS
    await server.register(cors, {
      origin: [process.env.CORS_ORIGIN || 'http://localhost:3100'],
      credentials: true
    });

    // Configuration JWT
    await server.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key'
    });

    // Configuration du rate limiting
    await server.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
    });

    // Configuration WebSocket
    await server.register(websocket);

    // Enregistrement de toutes les routes
    await server.register(authRoutes, { prefix: '/api/auth' });
    await server.register(userRoutes, { prefix: '/api/users' });
    await server.register(conversationRoutes, { prefix: '/api/conversations' });
    await server.register(groupRoutes, { prefix: '/api/groups' });
    await server.register(friendRequestRoutes, { prefix: '/api' });
    await server.register(notificationRoutes, { prefix: '/api' });
    await server.register(shareLinksRoutes, { prefix: '/api' });
    await server.register(adminRoutes, { prefix: '/api' });
    await server.register(translationRoutes, { prefix: '/api' });

    // Configuration WebSocket avec notre nouveau gestionnaire
    const wsHandler = new MeeshyWebSocketHandler(prisma, process.env.JWT_SECRET!);
    wsHandler.setupWebSocket(server);

    // Route de santé complète
    server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Test de la base de données
        await prisma.$queryRaw`SELECT 1`;
        const dbStatus = 'ok';

        // Test du service gRPC
        const grpcStatus = await grpcClient.healthCheck() ? 'ok' : 'error';

        // Statistiques système
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        // Statistiques de base de données
        const [userCount, conversationCount, messageCount] = await Promise.all([
          prisma.user.count(),
          prisma.conversation.count(),
          prisma.message.count({ where: { isDeleted: false } })
        ]);

        return {
          status: dbStatus === 'ok' && grpcStatus === 'ok' ? 'ok' : 'error',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(uptime),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          services: {
            database: dbStatus,
            grpc: grpcStatus,
            memory: {
              rss: Math.round(memoryUsage.rss / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              external: Math.round(memoryUsage.external / 1024 / 1024)
            }
          },
          statistics: {
            users: userCount,
            conversations: conversationCount,
            messages: messageCount
          }
        };
      } catch (error) {
        logger.error('Health check error:', error);
        return {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: 'Database connection failed'
        };
      }
    });

    // Route d'information sur l'API
    server.get('/api/info', async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        name: 'Meeshy Fastify API',
        version: '1.0.0',
        description: 'API Backend pour Meeshy - Service de chat multilingue',
        endpoints: {
          auth: '/api/auth/*',
          users: '/api/users/*',
          conversations: '/api/conversations/*',
          groups: '/api/groups/*',
          friends: '/api/friend-requests/*',
          notifications: '/api/notifications/*',
          shareLinks: '/api/share-links/*',
          admin: '/api/admin/*',
          websocket: '/ws'
        },
        services: {
          database: 'SQLite with Prisma ORM',
          translation: 'gRPC service (FastAPI)',
          websocket: 'Real-time messaging',
          authentication: 'JWT tokens'
        },
        timestamp: new Date().toISOString()
      };
    });

    // Gestionnaire d'erreurs globales
    server.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
      logger.error('Global error handler:', error);
      
      // Erreurs de validation Zod
      if (error.validation) {
        return reply.status(400).send({
          success: false,
          message: 'Données de requête invalides',
          errors: error.validation
        });
      }

      // Erreurs JWT
      if (error.code === 'FST_JWT_BAD_REQUEST') {
        return reply.status(401).send({
          success: false,
          message: 'Token JWT invalide'
        });
      }

      // Erreurs de rate limiting
      if (error.statusCode === 429) {
        return reply.status(429).send({
          success: false,
          message: 'Trop de requêtes, veuillez patienter'
        });
      }

      // Erreur générique
      reply.status(error.statusCode || 500).send({
        success: false,
        message: error.message || 'Erreur interne du serveur',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });

    // Démarrage du serveur
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.FASTIFY_HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info(`🚀 Fastify service started on ${host}:${port}`);
    logger.info(`🔗 WebSocket available at ws://${host}:${port}/ws`);
    logger.info(`🏥 Health check at http://${host}:${port}/health`);
    logger.info(`📚 API info at http://${host}:${port}/api/info`);
    
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  try {
    await prisma.$disconnect();
    await grpcClient.close();
    await server.close();
    logger.info('✅ Fastify service stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  await grpcClient.close();
  await server.close();
  process.exit(0);
});

start();
