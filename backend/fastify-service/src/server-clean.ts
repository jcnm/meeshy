/**
 * Serveur Fastify clean pour Meeshy
 * Communication: WebSocket (Frontend) + ZMQ (Backend Translation Service)
 * Suppression des moyens de communication inutiles (gRPC direct)
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { PrismaClient } from '../../shared/generated';
import winston from 'winston';
import { ZMQTranslationClient } from './services/zmq-translation-client';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'meeshy-secret-key-dev';
const PORT = parseInt(process.env.PORT || '3001');
const TRANSLATION_SERVICE_PORT = parseInt(process.env.TRANSLATION_SERVICE_PORT || '5555');

// Logger
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

// Services
const prisma = new PrismaClient();
const translationClient = new ZMQTranslationClient(TRANSLATION_SERVICE_PORT);

// Créer le serveur
const server = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty'
    }
  }
});

// Types pour WebSocket
interface WebSocketMessage {
  type: 'translate' | 'translate_multi' | 'typing' | 'stop_typing';
  messageId?: string;
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  targetLanguages?: string[];
  conversationId?: string;
  userId?: string;
  error?: string;
}

interface WebSocketResponse {
  type: 'translation' | 'translation_multi' | 'error' | 'typing' | 'stop_typing';
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
}

// Middleware
async function setupMiddleware() {
  // CORS
  await server.register(cors, {
    origin: true,
    credentials: true
  });

  // Sécurité
  await server.register(helmet);

  // JWT
  await server.register(jwt, {
    secret: JWT_SECRET
  });

  // WebSocket
  await server.register(websocket);

  logger.info('✅ Middleware configuré');
}

// WebSocket Handler
async function setupWebSocket() {
  server.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, _req) => {
      logger.info('🔌 Nouvelle connexion WebSocket');
      
      connection.on('message', async (message: Buffer) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString());
          logger.info(`📨 Message WebSocket reçu: ${data.type}`);
          
          switch (data.type) {
            case 'translate':
              await handleTranslation(connection, data);
              break;
              
            case 'translate_multi':
              await handleMultiTranslation(connection, data);
              break;
              
            case 'typing':
            case 'stop_typing':
              // Relayer les événements de frappe (implémentation future)
              await handleTypingEvent(connection, data);
              break;
              
            default:
              logger.warn(`⚠️ Type de message non supporté: ${data.type}`);
              sendError(connection, data.messageId, `Type de message non supporté: ${data.type}`);
          }
          
        } catch (error) {
          logger.error('❌ Erreur traitement message WebSocket:', error);
          sendError(connection, undefined, 'Erreur de traitement du message');
        }
      });
      
      connection.on('close', () => {
        logger.info('🔌 Connexion WebSocket fermée');
      });
      
      connection.on('error', (error: Error) => {
        logger.error('❌ Erreur WebSocket:', error);
      });
    });
  });
  
  logger.info('✅ WebSocket configuré sur /ws');
}

// Type pour connexion WebSocket
interface WebSocketConnection {
  send: (data: string) => void;
}

// Handlers WebSocket
async function handleTranslation(connection: WebSocketConnection, data: WebSocketMessage) {
  try {
    if (!data.text || !data.sourceLanguage || !data.targetLanguage) {
      sendError(connection, data.messageId, 'Paramètres manquants pour la traduction');
      return;
    }
    
    // Appeler le service de traduction via ZMQ
    const result = await translationClient.translateText({
      messageId: data.messageId || '',
      text: data.text,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage
    });
    
    // Répondre via WebSocket
    const response: WebSocketResponse = {
      type: 'translation',
      messageId: data.messageId,
      originalText: data.text,
      translatedText: result.translatedText,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      confidence: result.metadata?.confidenceScore,
      fromCache: result.metadata?.fromCache,
      modelUsed: result.metadata?.modelUsed,
      conversationId: data.conversationId
    };
    
    connection.send(JSON.stringify(response));
    logger.info(`✅ Traduction envoyée: "${data.text}" → "${result.translatedText}"`);
    
  } catch (error) {
    logger.error('❌ Erreur traduction:', error);
    sendError(connection, data.messageId, `Erreur de traduction: ${error}`);
  }
}

async function handleMultiTranslation(connection: WebSocketConnection, data: WebSocketMessage) {
  try {
    if (!data.text || !data.sourceLanguage || !data.targetLanguages?.length) {
      sendError(connection, data.messageId, 'Paramètres manquants pour la traduction multiple');
      return;
    }
    
    // Traduire vers toutes les langues cibles
    const results = await translationClient.translateToMultipleLanguages(
      data.text,
      data.sourceLanguage,
      data.targetLanguages
    );
    
    // Formater les résultats
    const translations = results.map((result, index) => ({
      language: data.targetLanguages![index],
      text: result.translatedText,
      confidence: result.metadata?.confidenceScore || 0
    }));
    
    const response: WebSocketResponse = {
      type: 'translation_multi',
      messageId: data.messageId,
      originalText: data.text,
      translations,
      sourceLanguage: data.sourceLanguage,
      conversationId: data.conversationId
    };
    
    connection.send(JSON.stringify(response));
    logger.info(`✅ Traductions multiples envoyées: ${translations.length} langues`);
    
  } catch (error) {
    logger.error('❌ Erreur traduction multiple:', error);
    sendError(connection, data.messageId, `Erreur de traduction multiple: ${error}`);
  }
}

async function handleTypingEvent(connection: WebSocketConnection, data: WebSocketMessage) {
  // Pour l'instant, juste logger
  logger.info(`👀 Événement frappe: ${data.type} de ${data.userId} dans ${data.conversationId}`);
  
  // Dans une implémentation complète, on relayerait cet événement aux autres participants
  // de la conversation via WebSocket broadcast
}

function sendError(connection: WebSocketConnection, messageId: string | undefined, error: string) {
  const response: WebSocketResponse = {
    type: 'error',
    messageId,
    error
  };
  connection.send(JSON.stringify(response));
}

// Routes REST basiques
async function setupRoutes() {
  // Health check
  server.get('/health', async () => {
    const translationHealthy = await translationClient.healthCheck();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: true, // TODO: vrai check Prisma
        translation: translationHealthy,
        websocket: true
      }
    };
  });
  
  // Info sur le service
  server.get('/info', async () => {
    return {
      name: 'Meeshy Fastify Gateway',
      version: '1.0.0',
      communication: {
        websocket: '/ws',
        translation_backend: 'ZMQ+Protobuf',
        frontend: 'WebSocket+REST'
      },
      supported_languages: ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar']
    };
  });

  // API de traduction REST
  server.post('/api/translate', {
    schema: {
      body: {
        type: 'object',
        required: ['text', 'source_language', 'target_language'],
        properties: {
          text: { type: 'string' },
          source_language: { type: 'string' },
          target_language: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as {
        text: string;
        source_language: string;
        target_language: string;
      };
      
      const { text, source_language, target_language } = body;
      
      logger.info(`🌐 Traduction API: "${text}" (${source_language} → ${target_language})`);
      
      // Appeler le service de traduction via ZMQ
      const result = await translationClient.translateText({
        messageId: `api-${Date.now().toString()}`,
        text,
        sourceLanguage: source_language,
        targetLanguage: target_language
      });
      
      return {
        translated_text: result.translatedText,
        source_language,
        target_language,
        original_text: text,
        confidence: result.metadata?.confidenceScore || 0,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('❌ Erreur traduction API:', error);
      reply.status(500);
      return {
        error: 'Translation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  logger.info('✅ Routes REST configurées');
}

// Initialisation
async function start() {
  try {
    logger.info('🚀 Démarrage du serveur Fastify Meeshy...');
    
    // 1. Initialiser les services
    logger.info('📦 Initialisation des services...');
    await translationClient.initialize();
    
    // 2. Configuration du serveur
    await setupMiddleware();
    await setupWebSocket();
    await setupRoutes();
    
    // 3. Démarrer le serveur
    await server.listen({ port: PORT, host: '0.0.0.0' });
    
    logger.info('🌟 Serveur Fastify démarré avec succès!');
    logger.info(`📍 Port: ${PORT}`);
    logger.info(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
    logger.info(`🗣️ Service de traduction: tcp://localhost:${TRANSLATION_SERVICE_PORT}`);
    logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
    
  } catch (error) {
    logger.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

// Arrêt propre
process.on('SIGINT', async () => {
  logger.info('🛑 Arrêt du serveur...');
  
  try {
    await translationClient.close();
    await server.close();
    await prisma.$disconnect();
    
    logger.info('✅ Serveur arrêté proprement');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
});

// Démarrer
start();
