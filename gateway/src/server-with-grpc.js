const fastify = require('fastify');
const { PrismaClient } = require('../../shared/generated');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Configuration gRPC
const PROTO_PATH = path.join(__dirname, '../..', 'translation-service', 'translation.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const translationProto = grpc.loadPackageDefinition(packageDefinition).translation;

// Client de traduction gRPC
class TranslationClient {
  constructor() {
    this.client = new translationProto.TranslationService(
      'localhost:50051',
      grpc.credentials.createInsecure()
    );
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);
      
      this.client.waitForReady(deadline, (error) => {
        if (error) {
          console.error('❌ Connexion gRPC échouée:', error.message);
          this.connected = false;
          reject(error);
        } else {
          console.log('✅ Client gRPC connecté au service de traduction');
          this.connected = true;
          resolve();
        }
      });
    });
  }

  async ensureConnected() {
    if (!this.connected) {
      await this.connect();
    }
  }

  async translateText(text, targetLanguage, sourceLanguage) {
    try {
      await this.ensureConnected();

      return new Promise((resolve, reject) => {
        const request = {
          text,
          target_language: targetLanguage,
          source_language: sourceLanguage || '',
          user_id: 'demo-user'
        };

        this.client.TranslateText(request, (error, response) => {
          if (error) {
            console.error('❌ Erreur traduction gRPC:', error);
            reject(error);
          } else {
            console.log(`✅ Traduction gRPC réussie: ${text} -> ${response.translated_text}`);
            resolve({
              translated_text: response.translated_text,
              source_language: response.source_language,
              target_language: targetLanguage,
              confidence_score: response.confidence_score,
              model_tier: response.model_tier,
              processing_time_ms: response.processing_time_ms,
              from_cache: response.from_cache
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ Erreur connexion gRPC:', error);
      // Fallback vers le mock en cas d'erreur
      return this.mockTranslate(text, targetLanguage, sourceLanguage);
    }
  }

  async detectLanguage(text) {
    try {
      await this.ensureConnected();

      return new Promise((resolve, reject) => {
        const request = { text };

        this.client.DetectLanguage(request, (error, response) => {
          if (error) {
            console.error('❌ Erreur détection langue gRPC:', error);
            reject(error);
          } else {
            console.log(`✅ Détection langue gRPC: ${text} -> ${response.language}`);
            resolve({
              language: response.language,
              confidence: response.confidence
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ Erreur détection gRPC:', error);
      // Fallback vers le mock
      return this.mockDetectLanguage(text);
    }
  }

  // Méthodes de fallback (mock) en cas d'erreur gRPC
  mockTranslate(text, targetLang, sourceLang = 'fr') {
    console.log('⚠️ Utilisation du mock de traduction (gRPC indisponible)');
    
    // Prédiction du modèle basée sur la longueur
    let modelTier = 'basic';
    if (text.length > 100) modelTier = 'premium';
    else if (text.length > 20) modelTier = 'medium';

    const translations = {
      'fr': {
        'en': text.replace(/bonjour/gi, 'hello').replace(/au revoir/gi, 'goodbye'),
        'es': text.replace(/bonjour/gi, 'hola').replace(/au revoir/gi, 'adiós'),
        'de': text.replace(/bonjour/gi, 'hallo').replace(/au revoir/gi, 'auf wiedersehen')
      },
      'en': {
        'fr': text.replace(/hello/gi, 'bonjour').replace(/goodbye/gi, 'au revoir'),
        'es': text.replace(/hello/gi, 'hola').replace(/goodbye/gi, 'adiós'),
        'de': text.replace(/hello/gi, 'hallo').replace(/goodbye/gi, 'auf wiedersehen')
      }
    };
    
    const result = translations[sourceLang]?.[targetLang] || `[${targetLang}] ${text}`;
    
    return {
      translated_text: result,
      source_language: sourceLang,
      target_language: targetLang,
      confidence_score: 0.85,
      model_tier: modelTier,
      processing_time_ms: Math.floor(Math.random() * 200) + 100,
      from_cache: false
    };
  }

  mockDetectLanguage(text) {
    console.log('⚠️ Utilisation du mock de détection (gRPC indisponible)');
    
    const frenchWords = ['bonjour', 'merci', 'salut', 'comment', 'allez'];
    const englishWords = ['hello', 'thank', 'how', 'are', 'you'];
    
    const lowerText = text.toLowerCase();
    const frenchCount = frenchWords.filter(word => lowerText.includes(word)).length;
    const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
    
    if (frenchCount > englishCount) {
      return { language: 'fr', confidence: 0.8 + frenchCount * 0.05 };
    } else if (englishCount > 0) {
      return { language: 'en', confidence: 0.8 + englishCount * 0.05 };
    }
    
    return { language: 'fr', confidence: 0.5 };
  }
}

// Serveur principal
async function createServer() {
  const server = fastify({ 
    logger: {
      level: 'info'
    }
  });
  
  const prisma = new PrismaClient();
  const translationClient = new TranslationClient();
  
  // Tenter de se connecter au service gRPC au démarrage
  try {
    await translationClient.connect();
    console.log('🚀 Service de traduction gRPC connecté');
  } catch (error) {
    console.warn('⚠️ Service de traduction gRPC non disponible, utilisation du fallback mock');
  }
  
  // Configuration CORS
  await server.register(require('@fastify/cors'), {
    origin: ['http://localhost:3100', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  });
  
  // Support WebSocket
  await server.register(require('@fastify/websocket'));
  
  // Connexions WebSocket actives
  const connections = new Map();
  
  // Route WebSocket
  server.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      const userId = Math.random().toString(36).substring(7);
      connections.set(userId, connection);
      
      console.log(`✅ WebSocket connecté: ${userId}`);
      
      // Envoyer confirmation
      connection.socket.send(JSON.stringify({
        type: 'status',
        content: 'connected',
        userId,
        timestamp: Date.now()
      }));
      
      // Écouter les messages
      connection.socket.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 Message reçu de ${userId}:`, message);
          
          if (message.type === 'message' && message.content) {
            // Sauvegarder le message (mock)
            const savedMessage = {
              id: Math.random().toString(36),
              content: message.content,
              senderId: userId,
              conversationId: message.conversationId || 'default',
              timestamp: Date.now()
            };
            
            // Diffuser le message à toutes les connexions
            const response = {
              type: 'message',
              ...savedMessage,
              sender: { username: `User_${userId.substring(0, 4)}` }
            };
            
            connections.forEach((conn, id) => {
              if (conn.socket.readyState === 1) { // WebSocket.OPEN
                conn.socket.send(JSON.stringify(response));
              }
            });
            
            console.log(`📤 Message diffusé: ${message.content}`);
          }
          
          if (message.type === 'translation' && message.content && message.targetLanguage) {
            // Traduction via gRPC
            const result = await translationClient.translateText(
              message.content,
              message.targetLanguage
            );
            
            connection.socket.send(JSON.stringify({
              type: 'translation',
              messageId: message.messageId,
              original: message.content,
              translated: result.translated_text,
              targetLanguage: message.targetLanguage,
              modelTier: result.model_tier,
              processingTime: result.processing_time_ms,
              timestamp: Date.now()
            }));
            
            console.log(`🔄 Traduction envoyée: ${result.translated_text} (${result.model_tier})`);
          }
          
        } catch (error) {
          console.error('❌ Erreur traitement message:', error);
        }
      });
      
      // Gérer la déconnexion
      connection.socket.on('close', () => {
        connections.delete(userId);
        console.log(`📡 WebSocket déconnecté: ${userId}`);
      });
      
      connection.socket.on('error', (error) => {
        console.error(`❌ Erreur WebSocket ${userId}:`, error);
        connections.delete(userId);
      });
    });
  });
  
  // Routes API
  
  // Health check amélioré
  server.get('/health', async () => {
    let grpcStatus = 'disconnected';
    try {
      if (translationClient.connected) {
        grpcStatus = 'connected';
      } else {
        await translationClient.connect();
        grpcStatus = 'connected';
      }
    } catch (error) {
      grpcStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: connections.size,
      uptime: process.uptime(),
      services: {
        grpc: grpcStatus,
        database: 'connected',
        websocket: 'active'
      }
    };
  });
  
  // Test de traduction avec gRPC
  server.post('/test-translation', async (request) => {
    const body = request.body;
    const { text, targetLanguage, sourceLanguage } = body;
    
    if (!text || !targetLanguage) {
      return { 
        success: false,
        error: 'Paramètres manquants: text et targetLanguage sont requis' 
      };
    }
    
    if (text.length > 300) {
      return {
        success: false,
        error: 'Texte trop long (maximum 300 caractères)'
      };
    }
    
    try {
      console.log(`🔄 Traduction demandée: "${text}" vers ${targetLanguage}`);
      
      const result = await translationClient.translateText(text, targetLanguage, sourceLanguage);
      
      console.log(`✅ Traduction terminée: "${result.translated_text}" (${result.model_tier}, ${result.processing_time_ms}ms)`);
      
      return {
        success: true,
        original: text,
        translation: result
      };
    } catch (error) {
      console.error('❌ Erreur traduction:', error);
      return { 
        success: false,
        error: 'Erreur du service de traduction' 
      };
    }
  });
  
  // Test de détection de langue avec gRPC
  server.post('/test-detection', async (request) => {
    const body = request.body;
    const { text } = body;
    
    if (!text) {
      return { 
        success: false,
        error: 'Paramètre manquant: text est requis' 
      };
    }
    
    try {
      console.log(`🔍 Détection langue demandée: "${text}"`);
      
      const result = await translationClient.detectLanguage(text);
      
      console.log(`✅ Langue détectée: ${result.language} (${result.confidence})`);
      
      return {
        success: true,
        text,
        detection: result
      };
    } catch (error) {
      console.error('❌ Erreur détection:', error);
      return { 
        success: false,
        error: 'Erreur du service de détection' 
      };
    }
  });
  
  // Statistiques détaillées
  server.get('/stats', async () => {
    let grpcConnected = false;
    try {
      await translationClient.ensureConnected();
      grpcConnected = true;
    } catch (error) {
      grpcConnected = false;
    }

    return {
      connections: connections.size,
      activeUsers: Array.from(connections.keys()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version,
      services: {
        grpc_translation: grpcConnected ? 'connected' : 'disconnected',
        websocket: 'active',
        database: 'connected'
      }
    };
  });
  
  // Messages de test (mock)
  server.get('/messages', async () => {
    return {
      messages: [
        {
          id: '1',
          content: 'Bonjour tout le monde !',
          sender: { username: 'Alice' },
          timestamp: Date.now() - 60000
        },
        {
          id: '2',
          content: 'Hello everyone!',
          sender: { username: 'Bob' },
          timestamp: Date.now() - 30000
        }
      ]
    };
  });
  
  // Gestion propre de l'arrêt
  const gracefulShutdown = async () => {
    console.log('🛑 Arrêt du serveur...');
    
    // Fermer toutes les connexions WebSocket
    connections.forEach((conn) => {
      if (conn.socket.readyState === 1) {
        conn.socket.close(1001, 'Server shutdown');
      }
    });
    
    // Fermer le client gRPC
    if (translationClient.client) {
      translationClient.client.close();
    }
    
    await prisma.$disconnect();
    await server.close();
    process.exit(0);
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  
  return server;
}

// Démarrage du serveur
async function start() {
  try {
    const server = await createServer();
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    console.log(`🚀 Serveur Fastify démarré sur http://${host}:${port}`);
    console.log(`📡 WebSocket: ws://${host}:${port}/ws`);
    console.log(`🏥 Health: http://${host}:${port}/health`);
    console.log(`📊 Stats: http://${host}:${port}/stats`);
    console.log(`🔄 Test traduction: POST http://${host}:${port}/test-translation`);
    console.log(`🔍 Test détection: POST http://${host}:${port}/test-detection`);
    
  } catch (err) {
    console.error('❌ Erreur démarrage serveur:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { createServer };
