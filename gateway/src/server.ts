/**
 * Meeshy Fastify Gateway Server
 * 
 * A clean, professional WebSocket + REST API gateway for translation services
 * Architecture: Frontend (WebSocket/REST) ↔ Gateway (Fastify) ↔ Translation Service (ZMQ)
 * 
 * @version 1.0.0
 * @author Meeshy Team
 */

// Load environment configuration first
import './env';

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible'; // Ajout pour httpErrors
import multipart from '@fastify/multipart';
import { PrismaClient } from '../shared/prisma/client';
import winston from 'winston';
import { TranslationService } from './services/TranslationService';
import { MessagingService } from './services/MessagingService';
import { AuthMiddleware, createUnifiedAuthMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { conversationRoutes } from './routes/conversations';
import { linksRoutes } from './routes/links';
import { trackingLinksRoutes } from './routes/tracking-links';
import { anonymousRoutes } from './routes/anonymous';
import { communityRoutes } from './routes/communities';
import { adminRoutes } from './routes/admin';
import { userRoutes } from './routes/users';
import userPreferencesRoutes from './routes/user-preferences';
import { translationRoutes } from './routes/translation-non-blocking';
import { translationRoutes as translationBlockingRoutes } from './routes/translation';
import { maintenanceRoutes } from './routes/maintenance';
import { authTestRoutes } from './routes/auth-test';
import affiliateRoutes from './routes/affiliate';
import messageRoutes from './routes/messages';
import { notificationRoutes } from './routes/notifications';
import { friendRequestRoutes } from './routes/friends';
import { attachmentRoutes } from './routes/attachments';
import { InitService } from './services/init.service';
import { MeeshySocketIOHandler } from './socketio/MeeshySocketIOHandler';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================

interface Config {
  isDev: boolean;
  jwtSecret: string;
  port: number;
  databaseUrl: string;
  nodeEnv: string;
}

function loadConfiguration(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDev = nodeEnv === 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`[GATEWAY] Loading configuration for environment: ${dbUrl}`);
  return {
    nodeEnv,
    isDev,
    jwtSecret: process.env.JWT_SECRET || 'meeshy-secret-key-dev',
    port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || '3000'),
    databaseUrl: process.env.DATABASE_URL || ''
  };
}

const config = loadConfiguration();

// ============================================================================
// LOGGER SETUP
// ============================================================================

const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'warn', // Production: seulement warn et error
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    config.isDev 
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            return `${timestamp} [GWY] [${level}] ${message}${stack ? '\n' + stack : ''}`;
          })
        )
      : winston.format.combine(
          winston.format.printf(({ timestamp, level, message, stack }) => {
            const logObj: any = {
              timestamp,
              service: 'GWY',
              level,
              message
            };
            if (stack) {
              logObj.stack = stack;
            }
            return JSON.stringify(logObj);
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
    ...(!config.isDev ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ]
});

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

class AuthenticationError extends Error {
  public statusCode: number;
  
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class ValidationError extends Error {
  public statusCode: number;
  
  constructor(message: string = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class TranslationError extends Error {
  public statusCode: number;
  
  constructor(message: string = 'Translation failed') {
    super(message);
    this.name = 'TranslationError';
    this.statusCode = 500;
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface WebSocketMessage {
  type: 'translate' | 'translate_multi' | 'typing' | 'stop_typing' | 'new_message' | 'join_conversation' | 'leave_conversation' | 'user_typing';
  messageId?: string;
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  targetLanguages?: string[];
  conversationId?: string;
  userId?: string;
  data?: any; // Pour les données spécifiques au type de message
}

interface WebSocketResponse {
  type: 'translation' | 'translation_multi' | 'error' | 'typing' | 'stop_typing' | 'message_sent' | 'conversation_joined' | 'conversation_left';
  messageId?: string;
  originalText?: string;
  translatedText?: string;
  translations?: Array<{
    language: string;
    text: string;
    confidence: number;
  }>;
  sourceLanguage?: string;
  targetLanguage?: string;
  confidence?: number;
  fromCache?: boolean;
  modelUsed?: string;
  conversationId?: string;
  userId?: string;
  error?: string;
  data?: any; // Pour les données spécifiques au type de réponse
  timestamp: string;
}

interface WebSocketConnection {
  send: (data: string) => void;
}

interface TranslationRequest {
  text: string;
  source_language: string;
  target_language: string;
}

// Fastify type extensions
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    translationService: TranslationService;
    socketIOHandler: MeeshySocketIOHandler;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// ============================================================================
// SERVICES INITIALIZATION
// ============================================================================

class MeeshyServer {
  private server: FastifyInstance;
  private prisma: PrismaClient;
  private translationService: TranslationService;
  private messagingService: MessagingService;
  private authMiddleware: AuthMiddleware;
  private socketIOHandler: MeeshySocketIOHandler;

  constructor() {
    this.server = fastify({
      logger: false, // We use Winston instead
      disableRequestLogging: !config.isDev
    });
    
    this.prisma = new PrismaClient({
      log: config.isDev ? ['query', 'info', 'warn', 'error'] : ['error', 'warn']
    });
    
    // Initialiser le middleware d'authentification unifié
    this.authMiddleware = new AuthMiddleware(this.prisma);
    
    // Initialiser le service de traduction
    this.translationService = new TranslationService(this.prisma);
    
    // Initialiser le service de messaging
    this.messagingService = new MessagingService(this.prisma, this.translationService);
    
    this.socketIOHandler = new MeeshySocketIOHandler(this.prisma, config.jwtSecret);
  }

  // --------------------------------------------------------------------------
  // MIDDLEWARE SETUP
  // --------------------------------------------------------------------------

  private async setupMiddleware(): Promise<void> {
    logger.info('Setting up middleware...');

    // Register sensible plugin for httpErrors
    await this.server.register(sensible);

    // Register multipart plugin for file uploads
    await this.server.register(multipart, {
      limits: {
        fileSize: 104857600, // 100MB max file size
        files: 100, // Max 100 files per request
      },
    });

    // Security headers
    await this.server.register(helmet, {
      contentSecurityPolicy: config.isDev ? false : undefined
    });

    // CORS configuration
    await this.server.register(cors, {
      origin: config.isDev ? true : (origin, cb) => {
        // Add your production domains here
        const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || 
                               process.env.ALLOWED_ORIGINS?.split(',') || 
                               ['http://localhost:3100', 'http://localhost', 'http://localhost:80', 'http://127.0.0.1', 'http://127.0.0.1:80', 'https://meeshy.me', 'https://www.meeshy.me', 'https://gate.meeshy.me', 'https://ml.meeshy.me'];
        
        logger.info(`CORS check: origin="${origin}", allowed="${allowedOrigins.join(',')}"`);
        
        // Allow requests without origin (e.g., mobile apps, Postman, curl)
        // Allow requests from allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        
        // Log the rejection for debugging
        logger.warn(`CORS rejected origin: "${origin}"`);
        return cb(new Error('Not allowed by CORS'), false);
      },
      credentials: true
    });

    // JWT authentication
    await this.server.register(jwt, {
      secret: config.jwtSecret
    });

    // Socket.IO will be configured after server initialization
    // No need to register a plugin as Socket.IO attaches directly to the HTTP server

    // Global error handler
    this.server.setErrorHandler(async (error, request, reply) => {
      logger.error('Global error handler:', error);

      if (error instanceof AuthenticationError) {
        return reply.code(401).send({
          error: 'Authentication Failed',
          message: error.message,
          statusCode: 401,
          timestamp: new Date().toISOString()
        });
      }

      if (error instanceof ValidationError) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: error.message,
          statusCode: 400,
          timestamp: new Date().toISOString()
        });
      }

      if (error instanceof TranslationError) {
        return reply.code(500).send({
          error: 'Translation Error',
          message: error.message,
          statusCode: 500,
          timestamp: new Date().toISOString()
        });
      }

      // Gestion des erreurs de limite de fichiers multipart
      if (error.code === 'FST_FILES_LIMIT') {
        return reply.code(413).send({
          error: 'Too Many Files',
          message: `You can only upload a maximum of 100 files at once. Please reduce the number of files.`,
          details: {
            maxFiles: 100,
            limit: 'Files limit reached'
          },
          statusCode: 413,
          timestamp: new Date().toISOString()
        });
      }

      // Gestion des erreurs de taille de fichier
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({
          error: 'File Too Large',
          message: `File size exceeds the allowed limit of 100 MB. Please reduce the file size.`,
          details: {
            maxFileSize: '100 MB',
            limit: 'File size exceeded'
          },
          statusCode: 413,
          timestamp: new Date().toISOString()
        });
      }

      // Gestion des erreurs de limite de parties (parts) multipart
      if (error.code === 'FST_PARTS_LIMIT') {
        return reply.code(413).send({
          error: 'Too Many Parts',
          message: `Too many parts in the multipart request. Please reduce the number of elements.`,
          statusCode: 413,
          timestamp: new Date().toISOString()
        });
      }

      // Default error handling
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        error: 'Internal Server Error',
        message: config.isDev ? error.message : 'An unexpected error occurred',
        statusCode,
        timestamp: new Date().toISOString(),
        ...(config.isDev && { stack: error.stack })
      });
    });

    // Decorators for dependency injection
    this.server.decorate('prisma', this.prisma);
    this.server.decorate('translationService', this.translationService);
    this.server.decorate('socketIOHandler', this.socketIOHandler);
    this.server.decorate('authenticate', this.createAuthMiddleware());

    logger.info('✓ Middleware configured successfully');
  }

  private createAuthMiddleware() {
    return createUnifiedAuthMiddleware(this.prisma, {
      requireAuth: true,
      allowAnonymous: false
    });
  }

  // --------------------------------------------------------------------------
  // SOCKET.IO SETUP
  // --------------------------------------------------------------------------

  private async setupSocketIO(): Promise<void> {
    logger.info('Configuring Socket.IO...');

    try {
      // Socket.IO sera configuré directement avec le serveur HTTP
      this.socketIOHandler.setupSocketIO(this.server);
      logger.info('[GWY] ✅ Socket.IO configured with MeeshySocketIOHandler');
    } catch (error) {
      logger.error('[GWY] ❌ Failed to setup Socket.IO:', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS  
  // --------------------------------------------------------------------------

  private sendWebSocketMessage(connection: WebSocketConnection, message: WebSocketResponse): void {
    try {
      connection.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error);
    }
  }

  private sendWebSocketError(connection: WebSocketConnection, messageId: string | undefined, error: string): void {
    const response: WebSocketResponse = {
      type: 'error',
      messageId,
      error,
      timestamp: new Date().toISOString()
    };
    this.sendWebSocketMessage(connection, response);
  }

  // --------------------------------------------------------------------------
  // REST API ROUTES
  // --------------------------------------------------------------------------

  private async setupRoutes(): Promise<void> {
    logger.info('Configuring REST API routes...');

    // Health check endpoint
    this.server.get('/health', async (request, reply) => {
      try {
        const [userCount, translationHealthy] = await Promise.all([
          this.prisma.user.count(),
          this.translationService.healthCheck().catch(() => false)
        ]);
        
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: config.nodeEnv,
          version: '1.0.0',
          services: {
            database: { status: 'up', userCount },
            translation: { status: translationHealthy ? 'up' : 'down' },
            websocket: { status: 'up' }
          },
          uptime: process.uptime()
        };
        
        reply.code(200).send(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        reply.code(503).send({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Service information endpoint
    this.server.get('/info', async (request, reply) => {
      return {
        name: 'Meeshy Translation Gateway',
        version: '1.0.0',
        environment: config.nodeEnv,
        architecture: {
          frontend: 'WebSocket + REST API',
          backend: 'ZMQ + Protocol Buffers',
          database: 'PostgreSQL + Prisma'
        },
        endpoints: {
          websocket: '/socket.io/',
          health: '/health',
          translate: '/translate'
        },
        supportedLanguages: ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar'],
        features: ['real-time translation', 'multiple language support', 'caching', 'typing indicators']
      };
    });

        // Register translation routes with the translation service
    await this.server.register(async (fastify) => {
      // Décorer le serveur avec le service de traduction et messaging
      fastify.decorate('translationService', this.translationService);
      fastify.decorate('messagingService', this.messagingService);
      
      // Enregistrer les routes de traduction (non-blocking)
      await fastify.register(translationRoutes);
      
      // Enregistrer les routes de traduction (blocking)
      await fastify.register(translationBlockingRoutes);
    }, { prefix: '/api' });
    
    // Register authentication routes with /api/auth prefix
    await this.server.register(authRoutes, { prefix: '/api/auth' });
    
    // Register authentication test routes for Phase 3.1.1
    await this.server.register(authTestRoutes, { prefix: '/api' });
    
    // Register conversation routes with /api prefix
    await this.server.register(async (fastify) => {
      await conversationRoutes(fastify);
    }, { prefix: '/api' });
    // Register links management routes
    await this.server.register(linksRoutes, { prefix: '/api' });
    
    // Register tracking links routes
    await this.server.register(trackingLinksRoutes, { prefix: '/api' });
    
    // Register anonymous participation routes
    await this.server.register(anonymousRoutes, { prefix: '/api' });
    
    // Register community routes
    await this.server.register(communityRoutes, { prefix: '/api' });
    
    // Register admin routes with /api/admin prefix
    await this.server.register(adminRoutes, { prefix: '/api/admin' });

    
    // Register user routes
    await this.server.register(userRoutes, { prefix: '/api' });
    
    // Register user preferences routes with /api prefix
    await this.server.register(userPreferencesRoutes, { prefix: '/api' });
    
    // Register affiliate routes
    await this.server.register(affiliateRoutes, { prefix: '/api' });


    // Register maintenance routes with /api prefix
    await this.server.register(maintenanceRoutes, { prefix: '/api' });
    
    // Register message routes with /api prefix
    await this.server.register(messageRoutes, { prefix: '/api' });
    
    // Register attachment routes with /api prefix
    await this.server.register(attachmentRoutes, { prefix: '/api' });
    
    // Register notification routes with /api prefix
    await this.server.register(notificationRoutes, { prefix: '/api' });
    
    // Register friend request routes with /api prefix
    await this.server.register(friendRequestRoutes, { prefix: '/api' });
    
    logger.info('✓ REST API routes configured successfully');
  }

  // --------------------------------------------------------------------------
  // SERVER LIFECYCLE
  // --------------------------------------------------------------------------

  private async initializeServices(): Promise<void> {
    logger.info('Initializing external services...');
    
    // Test database connection
    try {
      logger.info('🔍 Testing database connection...');
      // Test connection with a simple query instead
      await this.prisma.user.findFirst();
      logger.info(`✓ Database connected successfully`);
      
      // Initialize database with default data
      const initService = new InitService(this.prisma);
      
      // Check if initialization is needed
      const shouldInit = await initService.shouldInitialize();
      
      if (shouldInit) {
        const forceReset = process.env.FORCE_DB_RESET === 'true';
        if (forceReset) {
          logger.info('🔄 FORCE_DB_RESET=true - Database will be completely reset and reinitialized');
        } else {
          logger.info('🔧 Database initialization required, starting...');
        }
        await initService.initializeDatabase();
        logger.info('✅ Database initialization completed successfully');
      } else {
        logger.info('✅ Database already initialized, skipping initialization');
      }
      
    } catch (error) {
      logger.error('✗ Database connection failed:', error);
      logger.info('⚠️ Continuing without database initialization (development mode)');
      logger.info('💡 To fix database issues:');
      logger.info('   1. Check MongoDB credentials in .env file');
      logger.info('   2. Ensure MongoDB is running and accessible');
      logger.info('   3. Verify network connectivity to database');
      // Don't throw error in development mode - continue without database
    }

    // Initialize translation service
    try {
      await this.translationService.initialize();
      const isHealthy = await this.translationService.healthCheck();
      if (isHealthy) {
        logger.info('✓ Translation service initialized successfully');
      } else {
        throw new Error('Translation service health check failed');
      }
    } catch (error) {
      logger.error('✗ Translation service initialization failed:', error);
      if (config.isDev) {
        logger.info('🔧 Development mode: Continuing without translation service');
      } else {
        throw new Error('Translation service initialization failed');
      }
    }
  }
  
  private displayStartupBanner(): void {
    const dbStatus = config.databaseUrl ? 'Connected' : 'Not configured'.padEnd(48);
    const translateUrl = `tcp://0.0.0.0:${(process.env.ZMQ_TRANSLATOR_PORT || '5555').padEnd(37)}`;
    const banner = `
╔══════════════════════════════════════════════════════════════════╗
║                       🌍 MEESHY GATEWAY 🌍                       ║
╠══════════════════════════════════════════════════════════════════╣
║  Environment: ${config.nodeEnv.padEnd(48)}   ║
║  Port:        ${config.port.toString().padEnd(48)}   ║
║  Database:    ${dbStatus}                                          ║
║  Translator:  ${translateUrl}║
╠══════════════════════════════════════════════════════════════════╣
║  📡 WebSocket:    wss://gate.meeshy.me/socket.io/${' '.repeat(11)}  ║
║  🏥 Health:       https://gate.meeshy.me/health${' '.repeat(15)} ║
║  📖 Info:         https://gate.meeshy.me/info${' '.repeat(17)} ║
║  🔄 Translate:    https://ml.meeshy.me/translate${' '.repeat(12)} ║
╚══════════════════════════════════════════════════════════════════╝
    `.trim();
    
    console.log(`[GATEWAY] ${banner}`);
  }



  public async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Meeshy Translation Gateway...');

      // Display configuration
      logger.info('Configuration loaded:', {
        environment: config.nodeEnv,
        port: config.port,
        translationPort: parseInt(process.env.ZMQ_TRANSLATOR_PORT || '5558'),
        development: config.isDev
      });

      // Initialize services
      await this.initializeServices();

      // Setup server components
      await this.setupMiddleware();
      await this.setupSocketIO();
      await this.setupRoutes();

      // Start the server
      await this.server.listen({ 
        port: config.port, 
        host: '0.0.0.0' 
      });

      // Display success banner
      this.displayStartupBanner();
      logger.info('🎉 Server started successfully and ready to accept connections');

    } catch (error) {
      logger.error('❌ Failed to start server: ', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('🛑 Shutting down server...');

    try {
      if (this.translationService) {
        await this.translationService.close();
        logger.info('✓ Translation service connection closed');
      }

      await this.server.close();
      logger.info('✓ HTTP server closed');

      await this.prisma.$disconnect();
      logger.info('✓ Database connection closed');

      logger.info('✅ Server shutdown completed successfully');
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      throw error;
    }
  }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

const meeshyServer = new MeeshyServer();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  try {
    await meeshyServer.stop();
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGTERM shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal (Ctrl+C)');
  try {
    await meeshyServer.stop();
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGINT shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
meeshyServer.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});