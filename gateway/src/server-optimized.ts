import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../../shared/generated';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';

// Configuration et types
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

interface WebSocketConnection extends WebSocket {
  userId?: string;
  username?: string;
  conversationIds?: Set<string>;
  isAuthenticated?: boolean;
}

interface MessageData {
  type: 'message' | 'translation' | 'typing' | 'status';
  conversationId?: string;
  content?: string;
  targetLanguage?: string;
  messageId?: string;
  timestamp?: number;
}

// Client gRPC pour la traduction
class TranslationClient {
  private connected = false;
  
  async connect(): Promise<void> {
    this.connected = true;
    console.log('🔗 Client de traduction connecté (mock)');
  }
  
  async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<any> {
    if (!this.connected) await this.connect();
    
    // Mock de traduction pour les tests
    const mockTranslations: Record<string, Record<string, string>> = {
      'fr': {
        'en': 'Hello world',
        'es': 'Hola mundo',
        'de': 'Hallo Welt'
      },
      'en': {
        'fr': 'Bonjour le monde',
        'es': 'Hola mundo',
        'de': 'Hallo Welt'
      }
    };
    
    const sourceLang = sourceLanguage || 'fr';
    const translated = mockTranslations[sourceLang]?.[targetLanguage] || text;
    
    return {
      translated_text: translated,
      source_language: sourceLang,
      confidence_score: 0.95,
      model_tier: 'basic',
      processing_time_ms: 50,
      from_cache: false
    };
  }
  
  async detectLanguage(text: string): Promise<any> {
    // Mock de détection
    const containsFrench = /[àáâäèéêëìíîïòóôöùúûü]/i.test(text) || 
                          text.includes('bonjour') || text.includes('merci');
    
    return {
      language: containsFrench ? 'fr' : 'en',
      confidence: 0.85
    };
  }
}

// Gestionnaire WebSocket optimisé
class WebSocketManager {
  private connections = new Map<string, WebSocketConnection>();
  private translationClient = new TranslationClient();
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  async handleConnection(connection: WebSocketConnection, request: FastifyRequest): Promise<void> {
    const token = this.extractToken(request);
    
    if (!token) {
      connection.close(1008, 'Token manquant');
      return;
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'meeshy-secret') as any;
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true, username: true, isActive: true }
      });
      
      if (!user || !user.isActive) {
        connection.close(1008, 'Utilisateur invalide');
        return;
      }
      
      // Configuration de la connexion
      connection.userId = user.id;
      connection.username = user.username;
      connection.conversationIds = new Set();
      connection.isAuthenticated = true;
      
      this.connections.set(user.id, connection);
      
      console.log(`✅ WebSocket connecté: ${user.username} (${user.id})`);
      
      // Envoyer confirmation de connexion
      this.sendToConnection(connection, {
        type: 'status',
        content: 'connected',
        timestamp: Date.now()
      });
      
      // Gestionnaires d'événements
      connection.on('message', async (data) => {
        await this.handleMessage(connection, data);
      });
      
      connection.on('close', () => {
        this.handleDisconnection(connection);
      });
      
      connection.on('error', (error) => {
        console.error(`❌ Erreur WebSocket ${user.username}:`, error);
        this.handleDisconnection(connection);
      });
      
    } catch (error) {
      console.error('❌ Erreur authentification WebSocket:', error);
      connection.close(1008, 'Token invalide');
    }
  }
  
  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Essayer depuis les query params
    const query = request.query as any;
    return query.token || null;
  }
  
  private async handleMessage(connection: WebSocketConnection, data: Buffer): Promise<void> {
    try {
      const message: MessageData = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'message':
          await this.handleMessageSend(connection, message);
          break;
          
        case 'translation':
          await this.handleTranslationRequest(connection, message);
          break;
          
        case 'typing':
          await this.handleTypingIndicator(connection, message);
          break;
          
        default:
          console.warn(`⚠️ Type de message non géré: ${message.type}`);
      }
      
    } catch (error) {
      console.error('❌ Erreur traitement message WebSocket:', error);
      this.sendToConnection(connection, {
        type: 'status',
        content: 'error',
        timestamp: Date.now()
      });
    }
  }
  
  private async handleMessageSend(connection: WebSocketConnection, messageData: MessageData): Promise<void> {
    if (!connection.userId || !messageData.conversationId || !messageData.content) {
      return;
    }
    
    try {
      // Créer le message en base
      const message = await this.prisma.message.create({
        data: {
          content: messageData.content,
          senderId: connection.userId,
          conversationId: messageData.conversationId,
          originalLanguage: 'fr', // Détecter automatiquement plus tard
          messageType: 'text'
        },
        include: {
          sender: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });
      
      // Diffuser le message à tous les participants
      await this.broadcastToConversation(messageData.conversationId, {
        type: 'message',
        messageId: message.id,
        conversationId: messageData.conversationId,
        content: messageData.content,
        sender: message.sender,
        timestamp: message.createdAt.getTime()
      });
      
      // Traduction automatique si nécessaire
      await this.handleAutoTranslation(message);
      
      console.log(`📤 Message envoyé par ${connection.username}: ${messageData.content.substring(0, 50)}...`);
      
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
    }
  }
  
  private async handleTranslationRequest(connection: WebSocketConnection, messageData: MessageData): Promise<void> {
    if (!messageData.messageId || !messageData.targetLanguage) {
      return;
    }
    
    try {
      // Récupérer le message original
      const message = await this.prisma.message.findUnique({
        where: { id: messageData.messageId }
      });
      
      if (!message) {
        return;
      }
      
      // Demander la traduction
      const translation = await this.translationClient.translateText(
        message.content,
        messageData.targetLanguage,
        message.originalLanguage
      );
      
      // Sauvegarder la traduction
      const savedTranslation = await this.prisma.messageTranslation.create({
        data: {
          messageId: message.id,
          sourceLanguage: message.originalLanguage,
          targetLanguage: messageData.targetLanguage,
          translatedContent: translation.translated_text,
          translationModel: translation.model_tier,
          cacheKey: `${message.id}_${messageData.targetLanguage}`
        }
      });
      
      // Envoyer la traduction à l'utilisateur
      this.sendToConnection(connection, {
        type: 'translation',
        messageId: messageData.messageId,
        content: translation.translated_text,
        targetLanguage: messageData.targetLanguage,
        timestamp: Date.now()
      });
      
      console.log(`🔄 Traduction ${message.originalLanguage}->${messageData.targetLanguage} pour ${connection.username}`);
      
    } catch (error) {
      console.error('❌ Erreur traduction:', error);
    }
  }
  
  private async handleTypingIndicator(connection: WebSocketConnection, messageData: MessageData): Promise<void> {
    if (!messageData.conversationId) return;
    
    // Diffuser l'indicateur de frappe aux autres participants
    await this.broadcastToConversation(messageData.conversationId, {
      type: 'typing',
      conversationId: messageData.conversationId,
      userId: connection.userId,
      username: connection.username,
      timestamp: Date.now()
    }, connection.userId); // Exclure l'expéditeur
  }
  
  private async handleAutoTranslation(message: any): Promise<void> {
    // Logique de traduction automatique basée sur les préférences utilisateur
    // Pour l'instant, on skip cette fonctionnalité
    console.log(`🤖 Auto-traduction à implémenter pour message ${message.id}`);
  }
  
  private async broadcastToConversation(conversationId: string, data: any, excludeUserId?: string): Promise<void> {
    // Récupérer les participants de la conversation
    const participants = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        // Utiliser une relation appropriée selon le schéma Prisma
        id: true
      }
    });
    
    if (!participants) return;
    
    // Pour l'instant, diffuser à toutes les connexions actives
    // En production, filtrer selon les participants réels
    for (const [userId, connection] of this.connections) {
      if (excludeUserId && userId === excludeUserId) continue;
      
      if (connection.readyState === WebSocket.OPEN) {
        this.sendToConnection(connection, data);
      }
    }
  }
  
  private sendToConnection(connection: WebSocketConnection, data: any): void {
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(data));
    }
  }
  
  private handleDisconnection(connection: WebSocketConnection): void {
    if (connection.userId) {
      this.connections.delete(connection.userId);
      console.log(`📡 WebSocket déconnecté: ${connection.username} (${connection.userId})`);
    }
  }
  
  // Méthodes utilitaires
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  getActiveUsers(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Serveur Fastify principal
export async function createServer(): Promise<FastifyInstance> {
  const server = fastify({ 
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    }
  });
  
  // Prisma
  const prisma = new PrismaClient();
  
  // WebSocket Manager
  const wsManager = new WebSocketManager(prisma);
  
  // Plugins
  await server.register(fastifyCors, {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  });
  
  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'meeshy-secret'
  });
  
  await server.register(fastifyWebsocket);
  
  // Middleware d'authentification
  server.decorate('authenticate', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const token = await request.jwtVerify();
      request.user = token as any;
    } catch (err) {
      reply.code(401).send({ error: 'Token invalide' });
    }
  });
  
  // Routes WebSocket
  server.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, async (connection, request) => {
      await wsManager.handleConnection(connection.socket as WebSocketConnection, request);
    });
  });
  
  // Routes API
  
  // Health check
  server.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: wsManager.getConnectionCount(),
      activeUsers: wsManager.getActiveUsers().length
    };
  });
  
  // Statistiques du serveur
  server.get('/stats', async (request, reply) => {
    return {
      connections: wsManager.getConnectionCount(),
      activeUsers: wsManager.getActiveUsers(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version
    };
  });
  
  // Routes de conversation (protégées)
  server.get('/conversations/:id/messages', {
    preHandler: [(server as any).authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const limit = parseInt((request.query as any).limit || '50');
    const offset = parseInt((request.query as any).offset || '0');
    
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          sender: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });
      
      return { messages: messages.reverse() };
    } catch (error) {
      server.log.error('Erreur récupération messages:', error);
      reply.code(500).send({ error: 'Erreur serveur' });
    }
  });
  
  // Route de test de traduction
  server.post('/test-translation', async (request, reply) => {
    const { text, targetLanguage, sourceLanguage } = request.body as any;
    
    try {
      const translationClient = new TranslationClient();
      const result = await translationClient.translateText(text, targetLanguage, sourceLanguage);
      
      return {
        success: true,
        translation: result
      };
    } catch (error) {
      server.log.error('Erreur test traduction:', error);
      reply.code(500).send({ error: 'Erreur traduction' });
    }
  });
  
  // Gestion de la fermeture
  const gracefulShutdown = async () => {
    console.log('🛑 Arrêt du serveur...');
    await prisma.$disconnect();
    await server.close();
    process.exit(0);
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  
  return server;
}

// Point d'entrée
async function start() {
  try {
    const server = await createServer();
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    console.log(`🚀 Serveur Fastify démarré sur http://${host}:${port}`);
    console.log(`📡 WebSocket disponible sur ws://${host}:${port}/ws`);
    console.log(`🏥 Health check: http://${host}:${port}/health`);
    
  } catch (err) {
    console.error('❌ Erreur démarrage serveur:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
