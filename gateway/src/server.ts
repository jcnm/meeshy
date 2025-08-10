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
import { PrismaClient } from '../libs/prisma/client'; // Import Prisma client from shared library
import winston from 'winston';
import { ZMQTranslationClient } from './services/zmq-translation-client';
import { authenticate } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { conversationRoutes } from './routes/conversations';
import { messageRoutes } from './routes/messages';
import userPreferencesRoutes from './routes/user-preferences';
import { InitService } from './services/init.service';
import { MeeshySocketIOHandler } from './socketio/MeeshySocketIOHandler';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================

interface ServerConfig {
  nodeEnv: string;
  isDev: boolean;
  jwtSecret: string;
  port: number;
  translationServicePort: number;
  databaseUrl: string;
}

function loadConfiguration(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDev = nodeEnv === 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`Loading configuration for environment: ${dbUrl}`);
  return {
    nodeEnv,
    isDev,
    jwtSecret: process.env.JWT_SECRET || 'meeshy-secret-key-dev',
    port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || '3000'),
    translationServicePort: parseInt(process.env.TRANSLATION_SERVICE_PORT || '5555'),
    databaseUrl: process.env.DATABASE_URL || ''
  };
}

const config = loadConfiguration();

// ============================================================================
// LOGGER SETUP
// ============================================================================

const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
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
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// ============================================================================
// SERVICES INITIALIZATION
// ============================================================================

class MeeshyServer {
  private server: FastifyInstance;
  private prisma: PrismaClient;
  private translationClient: ZMQTranslationClient;
  private socketIOHandler: MeeshySocketIOHandler;

  constructor() {
    this.server = fastify({
      logger: false, // We use Winston instead
      disableRequestLogging: !config.isDev
    });
    
    this.prisma = new PrismaClient({
      log: config.isDev ? ['query', 'info', 'warn', 'error'] : ['error']
    });
    
    this.translationClient = new ZMQTranslationClient(config.translationServicePort);
    this.socketIOHandler = new MeeshySocketIOHandler(this.prisma, config.jwtSecret);
  }

  // --------------------------------------------------------------------------
  // MIDDLEWARE SETUP
  // --------------------------------------------------------------------------

  private async setupMiddleware(): Promise<void> {
    logger.info('Setting up middleware...');

    // Register sensible plugin for httpErrors
    await this.server.register(sensible);

    // Security headers
    await this.server.register(helmet, {
      contentSecurityPolicy: config.isDev ? false : undefined
    });

    // CORS configuration
    await this.server.register(cors, {
      origin: config.isDev ? true : (origin, cb) => {
        // Add your production domains here
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
        if (!origin || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
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
    this.server.decorate('authenticate', this.createAuthMiddleware());

    logger.info('✓ Middleware configured successfully');
  }

  private createAuthMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (config.isDev) {
        logger.debug('Authentication middleware (development mode)');
      }
      
      try {
        await authenticate(request, reply);
      } catch (error) {
        logger.error('Authentication failed:', error);
        throw new AuthenticationError('Authentication failed');
      }
    };
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
          this.translationClient.healthCheck().catch(() => false)
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
          websocket: '/ws',
          health: '/health',
          translate: '/translate'
        },
        supportedLanguages: ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar'],
        features: ['real-time translation', 'multiple language support', 'caching', 'typing indicators']
      };
    });

    // Translation REST API
    this.server.post<{ Body: TranslationRequest }>('/translate', {
      schema: {
        body: {
          type: 'object',
          required: ['text', 'source_language', 'target_language'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 5000 },
            source_language: { type: 'string', pattern: '^[a-z]{2}$' },
            target_language: { type: 'string', pattern: '^[a-z]{2}$' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              translated_text: { type: 'string' },
              original_text: { type: 'string' },
              source_language: { type: 'string' },
              target_language: { type: 'string' },
              confidence: { type: 'number' },
              timestamp: { type: 'string' },
              processing_time_ms: { type: 'number' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const startTime = Date.now();
      
      try {
        const { text, source_language, target_language } = request.body;
        
        // Validation supplémentaire
        if (!text.trim()) {
          throw new ValidationError('Text cannot be empty');
        }
        
        logger.info(`REST API translation request: "${text}" (${source_language} → ${target_language})`);
        
        const result = await this.translationClient.translateText({
          messageId: `api_${Date.now()}`,
          text,
          sourceLanguage: source_language,
          targetLanguage: target_language
        });
        
        const processingTime = Date.now() - startTime;
        
        const response = {
          translated_text: result.translatedText,
          original_text: text,
          source_language,
          target_language,
          confidence: result.metadata?.confidenceScore || 0,
          timestamp: new Date().toISOString(),
          processing_time_ms: processingTime
        };
        
        logger.info(`REST API translation completed in ${processingTime}ms`);
        return response;
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(`REST API translation failed after ${processingTime}ms:`, error);
        
        if (error instanceof ValidationError) {
          throw error; // Will be handled by global error handler
        }
        
        throw new TranslationError(error instanceof Error ? error.message : 'Unknown error');
      }
    });
    
    // Register authentication routes with /auth prefix
    await this.server.register(authRoutes, { prefix: '/auth' });
    
    // Register conversation routes without prefix
    await this.server.register(conversationRoutes);
    
    // Register message routes without /api prefix (directly at root)
    await this.server.register(messageRoutes);
    
    // Register user preferences routes with /users prefix
    await this.server.register(userPreferencesRoutes, { prefix: '/users' });
    
    logger.info('✓ REST API routes configured successfully');
  }

  // --------------------------------------------------------------------------
  // SERVER LIFECYCLE
  // --------------------------------------------------------------------------

  private async initializeServices(): Promise<void> {
    logger.info('Initializing external services...');
    logger.info('Database URL:', JSON.stringify(config, null, 2));
    // Test database connection
    try {
      // Test connection with a simple query instead
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info(`✓ Database connected successfully`);
      
      // Initialize global conversation and auto-add users
      await InitService.initialize();
      
    } catch (error) {
      logger.error('✗ Database connection failed:', error);
      logger.info('Database connection failed, but continuing without database (development mode)');
      // Don't throw error in development mode
      // throw new Error('Database initialization failed');
    }

    // Initialize translation service
    try {
      await this.translationClient.initialize();
      const isHealthy = await this.translationClient.healthCheck();
      if (isHealthy) {
        logger.info('✓ Translation service connected successfully');
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
    const translateUrl = `tcp://0.0.0.0:${config.translationServicePort.toString().padEnd(37)}`;
    const banner = `
╔══════════════════════════════════════════════════════════════════╗
║                       🌍 MEESHY GATEWAY 🌍                       ║
╠══════════════════════════════════════════════════════════════════╣
║  Environment: ${config.nodeEnv.padEnd(48)}   ║
║  Port:        ${config.port.toString().padEnd(48)}   ║
║  Database:    ${dbStatus}                                          ║
║  Translator:  ${translateUrl}║
╠══════════════════════════════════════════════════════════════════╣
║  📡 WebSocket:    ws://localhost:${config.port}/ws${' '.repeat(23)}  ║
║  🏥 Health:       http://localhost:${config.port}/health${' '.repeat(18)} ║
║  📖 Info:         http://localhost:${config.port}/info${' '.repeat(20)} ║
║  🔄 Translate:    http://localhost:${config.port}/translate${' '.repeat(15)} ║
╚══════════════════════════════════════════════════════════════════╝
    `.trim();
    
    console.log(banner);
  }

  public async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Meeshy Translation Gateway...');

      // Display configuration
      logger.info('Configuration loaded:', {
        environment: config.nodeEnv,
        port: config.port,
        translationPort: config.translationServicePort,
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
      if (this.translationClient) {
        await this.translationClient.close();
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