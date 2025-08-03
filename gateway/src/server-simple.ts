import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

// Configuration du logger
const logger = {
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
};

// Création de l'instance Fastify
const server: FastifyInstance = fastify({
  logger
});

// Configuration des plugins
async function registerPlugins() {
  // CORS
  await server.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:80'],
    credentials: true
  });

  // Helmet pour la sécurité
  await server.register(helmet);
}

// Routes de base
async function registerRoutes() {
  // Route de santé
  server.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'meeshy-backend-fastify',
      version: '1.0.0',
      uptime: process.uptime()
    };
  });

  // Route de test
  server.get('/api/test', async (request, reply) => {
    return {
      message: 'Meeshy Backend Fastify Service is running!',
      timestamp: new Date().toISOString()
    };
  });

  // Routes placeholder pour les autres modules
  server.get('/api/users', async (request, reply) => {
    return { message: 'Users endpoint - to be implemented' };
  });

  server.get('/api/conversations', async (request, reply) => {
    return { message: 'Conversations endpoint - to be implemented' };
  });

  server.get('/api/groups', async (request, reply) => {
    return { message: 'Groups endpoint - to be implemented' };
  });
}

// Fonction de démarrage
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT || '3001', 10);

    await server.listen({ host, port });
    
    server.log.info(`🚀 Server listening at http://${host}:${port}`);
    server.log.info('✅ Meeshy Backend Fastify Service started successfully');
    
    // Gestionnaire de signaux pour l'arrêt propre
    const gracefulShutdown = async (signal: string) => {
      server.log.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.close();
        server.log.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        server.log.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    server.log.error('Error starting server:', error);
    process.exit(1);
  }
}

// Démarrage du serveur
start();

export default server;
