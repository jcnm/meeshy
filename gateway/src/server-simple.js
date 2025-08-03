const fastify = require('fastify');
const { PrismaClient } = require('../../shared/generated');

// Mock client de traduction
class SimpleTranslationClient {
  async translateText(text, targetLang, sourceLang = 'fr') {
    // Traductions mock simples
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
      confidence_score: 0.95,
      model_tier: 'basic',
      processing_time_ms: Math.floor(Math.random() * 100) + 50,
      from_cache: false
    };
  }
  
  async detectLanguage(text) {
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
    
    return { language: 'fr', confidence: 0.5 }; // Défaut français
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
  const translationClient = new SimpleTranslationClient();
  
  // Configuration CORS
  await server.register(require('@fastify/cors'), {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
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
            
            // Diffuser à toutes les connexions
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
            // Traduction
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
              timestamp: Date.now()
            }));
            
            console.log(`🔄 Traduction envoyée: ${result.translated_text}`);
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
  
  // Health check
  server.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: connections.size,
      uptime: process.uptime()
    };
  });
  
  // Test de traduction
  server.post('/test-translation', async (request) => {
    const body = request.body;
    const { text, targetLanguage, sourceLanguage } = body;
    
    if (!text || !targetLanguage) {
      return { error: 'Paramètres manquants' };
    }
    
    try {
      const result = await translationClient.translateText(text, targetLanguage, sourceLanguage);
      return {
        success: true,
        original: text,
        translation: result
      };
    } catch (error) {
      return { error: 'Erreur de traduction' };
    }
  });
  
  // Test de détection de langue
  server.post('/test-detection', async (request) => {
    const body = request.body;
    const { text } = body;
    
    if (!text) {
      return { error: 'Texte manquant' };
    }
    
    try {
      const result = await translationClient.detectLanguage(text);
      return {
        success: true,
        text,
        detection: result
      };
    } catch (error) {
      return { error: 'Erreur de détection' };
    }
  });
  
  // Statistiques
  server.get('/stats', async () => {
    return {
      connections: connections.size,
      activeUsers: Array.from(connections.keys()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version
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
