/**
 * Gestionnaire Socket.IO pour Meeshy
 * Gestion des connexions, conversations et traductions en temps réel
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { TranslationService, MessageData } from '../services/TranslationService';

export interface SocketUser {
  id: string;
  socketId: string;
  isAnonymous: boolean;
  language: string;
}

export interface TranslationNotification {
  messageId: string;
  translatedText: string;
  targetLanguage: string;
  confidenceScore: number;
}

export class MeeshySocketIOManager {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private translationService: TranslationService;
  
  // Mapping des utilisateurs connectés
  private connectedUsers: Map<string, SocketUser> = new Map();
  private socketToUser: Map<string, string> = new Map();
  
  // Statistiques
  private stats = {
    total_connections: 0,
    active_connections: 0,
    messages_processed: 0,
    translations_sent: 0,
    errors: 0
  };

  constructor(httpServer: HTTPServer, prisma: PrismaClient) {
    this.prisma = prisma;
    this.translationService = new TranslationService(prisma);
    
    // Initialiser Socket.IO
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });
    
    console.log('🚀 MeeshySocketIOManager initialisé');
  }

  async initialize(): Promise<void> {
    try {
      // Initialiser le service de traduction
      await this.translationService.initialize();
      
      // Configurer les événements Socket.IO
      this._setupSocketEvents();
      
      // Écouter les événements de traduction terminée
      this.translationService.on('translationReady', this._handleTranslationReady.bind(this));
      
      console.log('✅ MeeshySocketIOManager initialisé avec succès');
      
    } catch (error) {
      console.error('❌ Erreur initialisation MeeshySocketIOManager:', error);
      throw error;
    }
  }

  private _setupSocketEvents(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Nouvelle connexion: ${socket.id}`);
      this.stats.total_connections++;
      this.stats.active_connections++;
      
      // Authentification de l'utilisateur
      socket.on('authenticate', async (data: { userId?: string; sessionToken?: string; language?: string }) => {
        await this._handleAuthentication(socket, data);
      });
      
      // Réception d'un nouveau message
      socket.on('send_message', async (data: {
        conversationId: string;
        content: string;
        originalLanguage?: string;
        messageType?: string;
        replyToId?: string;
      }) => {
        await this._handleNewMessage(socket, data);
      });
      
      // Demande de traduction spécifique
      socket.on('request_translation', async (data: { messageId: string; targetLanguage: string }) => {
        await this._handleTranslationRequest(socket, data);
      });
      
      // Déconnexion
      socket.on('disconnect', () => {
        this._handleDisconnection(socket);
      });
      
      // Événements de frappe
      socket.on('typing_start', (data: { conversationId: string }) => {
        this._handleTypingStart(socket, data);
      });
      
      socket.on('typing_stop', (data: { conversationId: string }) => {
        this._handleTypingStop(socket, data);
      });
    });
  }

  private async _handleAuthentication(socket: any, data: { userId?: string; sessionToken?: string; language?: string }) {
    try {
      let user: SocketUser | null = null;
      
      if (data.userId) {
        // Utilisateur authentifié
        const dbUser = await this.prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true, systemLanguage: true }
        });
        
        if (dbUser) {
          user = {
            id: dbUser.id,
            socketId: socket.id,
            isAnonymous: false,
            language: data.language || dbUser.systemLanguage
          };
        }
      } else if (data.sessionToken) {
        // Participant anonyme
        const anonymousUser = await this.prisma.anonymousParticipant.findUnique({
          where: { sessionToken: data.sessionToken },
          select: { id: true }
        });
        
        if (anonymousUser) {
          user = {
            id: anonymousUser.id,
            socketId: socket.id,
            isAnonymous: true,
            language: data.language || 'fr'
          };
        }
      }
      
      if (user) {
        // Enregistrer l'utilisateur
        this.connectedUsers.set(user.id, user);
        this.socketToUser.set(socket.id, user.id);
        
        // Rejoindre les conversations de l'utilisateur
        await this._joinUserConversations(socket, user.id, user.isAnonymous);
        
        socket.emit('authenticated', { success: true, user: { id: user.id, language: user.language } });
        console.log(`✅ Utilisateur authentifié: ${user.id} (${user.isAnonymous ? 'anonyme' : 'connecté'})`);
        
      } else {
        socket.emit('authenticated', { success: false, error: 'Authentication failed' });
        console.log(`❌ Échec authentification pour socket ${socket.id}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur authentification: ${error}`);
      socket.emit('authenticated', { success: false, error: 'Authentication error' });
    }
  }

  private async _joinUserConversations(socket: any, userId: string, isAnonymous: boolean) {
    try {
      let conversations: any[] = [];
      
      if (isAnonymous) {
        // Conversations pour participants anonymes
        conversations = await this.prisma.anonymousParticipant.findMany({
          where: { id: userId },
          select: { conversationId: true }
        });
      } else {
        // Conversations pour utilisateurs authentifiés
        conversations = await this.prisma.conversationMember.findMany({
          where: { userId: userId, isActive: true },
          select: { conversationId: true }
        });
      }
      
      // Rejoindre les rooms Socket.IO
      for (const conv of conversations) {
        socket.join(`conversation_${conv.conversationId}`);
        console.log(`👥 Utilisateur ${userId} rejoint conversation ${conv.conversationId}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur jointure conversations: ${error}`);
    }
  }

  private async _handleNewMessage(socket: any, data: {
    conversationId: string;
    content: string;
    originalLanguage?: string;
    messageType?: string;
    replyToId?: string;
  }) {
    try {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }
      
      console.log(`📝 Nouveau message de ${userId} dans ${data.conversationId}: ${data.content.substring(0, 50)}...`);
      
      // Préparer les données du message
      const messageData: MessageData = {
        conversationId: data.conversationId,
        content: data.content,
        originalLanguage: data.originalLanguage || 'fr',
        messageType: data.messageType || 'text',
        replyToId: data.replyToId
      };
      
      // Déterminer le type d'expéditeur
      const user = this.connectedUsers.get(userId);
      if (user?.isAnonymous) {
        messageData.anonymousSenderId = userId;
      } else {
        messageData.senderId = userId;
      }
      
      // 1. SAUVEGARDER LE MESSAGE ET LIBÉRER LE CLIENT
      const result = await this.translationService.handleNewMessage(messageData);
      this.stats.messages_processed++;
      
      // 2. NOTIFIER LE CLIENT QUE LE MESSAGE EST SAUVEGARDÉ
      socket.emit('message_sent', {
        messageId: result.messageId,
        status: result.status,
        timestamp: new Date().toISOString()
      });
      
      // 3. DIFFUSER LE MESSAGE AUX AUTRES PARTICIPANTS
      const messagePayload = {
        id: result.messageId,
        conversationId: data.conversationId,
        senderId: messageData.senderId,
        anonymousSenderId: messageData.anonymousSenderId,
        content: data.content,
        originalLanguage: data.originalLanguage || 'fr',
        messageType: data.messageType || 'text',
        createdAt: new Date().toISOString()
      };
      
      socket.to(`conversation_${data.conversationId}`).emit('new_message', messagePayload);
      
      console.log(`✅ Message ${result.messageId} sauvegardé et diffusé`);
      
      // 4. LES TRADUCTIONS SERONT TRAITÉES EN ASYNCHRONE PAR LE TRANSLATION SERVICE
      // ET LES RÉSULTATS SERONT ENVOYÉS VIA LES ÉVÉNEMENTS 'translationReady'
      
    } catch (error) {
      console.error(`❌ Erreur traitement message: ${error}`);
      this.stats.errors++;
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async _handleTranslationRequest(socket: any, data: { messageId: string; targetLanguage: string }) {
    try {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }
      
      console.log(`🌍 Demande de traduction: ${data.messageId} -> ${data.targetLanguage}`);
      
      // Récupérer la traduction (depuis le cache ou la base de données)
      const translation = await this.translationService.getTranslation(data.messageId, data.targetLanguage);
      
      if (translation) {
        socket.emit('translation_received', {
          messageId: data.messageId,
          translatedText: translation.translatedText,
          targetLanguage: data.targetLanguage,
          confidenceScore: translation.confidenceScore
        });
        
        this.stats.translations_sent++;
        console.log(`✅ Traduction envoyée: ${data.messageId} -> ${data.targetLanguage}`);
        
      } else {
        socket.emit('translation_error', {
          messageId: data.messageId,
          targetLanguage: data.targetLanguage,
          error: 'Translation not available'
        });
        
        console.log(`⚠️ Traduction non disponible: ${data.messageId} -> ${data.targetLanguage}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur demande traduction: ${error}`);
      this.stats.errors++;
      socket.emit('error', { message: 'Failed to get translation' });
    }
  }

  private _handleTranslationReady(data: { taskId: string; result: any; targetLanguage: string }) {
    try {
      const { result, targetLanguage } = data;
      
      console.log(`📤 Envoi traduction aux clients: ${result.messageId} -> ${targetLanguage}`);
      
      // Récupérer les utilisateurs qui ont besoin de cette traduction
      const targetUsers = this._findUsersForLanguage(targetLanguage);
      
      // Envoyer la traduction aux utilisateurs concernés
      for (const user of targetUsers) {
        const userSocket = this.io.sockets.sockets.get(user.socketId);
        if (userSocket) {
          userSocket.emit('message_translated', {
            messageId: result.messageId,
            translatedText: result.translatedText,
            targetLanguage: targetLanguage,
            confidenceScore: result.confidenceScore,
            processingTime: result.processingTime
          });
          
          this.stats.translations_sent++;
        }
      }
      
      console.log(`✅ Traduction ${result.messageId} -> ${targetLanguage} envoyée à ${targetUsers.length} utilisateurs`);
      
    } catch (error) {
      console.error(`❌ Erreur envoi traduction: ${error}`);
      this.stats.errors++;
    }
  }

  private _findUsersForLanguage(targetLanguage: string): SocketUser[] {
    const targetUsers: SocketUser[] = [];
    
    for (const [userId, user] of this.connectedUsers) {
      if (user.language === targetLanguage) {
        targetUsers.push(user);
      }
    }
    
    return targetUsers;
  }

  private _handleDisconnection(socket: any) {
    const userId = this.socketToUser.get(socket.id);
    
    if (userId) {
      this.connectedUsers.delete(userId);
      this.socketToUser.delete(socket.id);
      
      console.log(`🔌 Déconnexion: ${userId} (socket: ${socket.id})`);
    }
    
    this.stats.active_connections--;
  }

  private _handleTypingStart(socket: any, data: { conversationId: string }) {
    const userId = this.socketToUser.get(socket.id);
    if (userId) {
      socket.to(`conversation_${data.conversationId}`).emit('user_typing_start', {
        userId: userId,
        conversationId: data.conversationId
      });
    }
  }

  private _handleTypingStop(socket: any, data: { conversationId: string }) {
    const userId = this.socketToUser.get(socket.id);
    if (userId) {
      socket.to(`conversation_${data.conversationId}`).emit('user_typing_stop', {
        userId: userId,
        conversationId: data.conversationId
      });
    }
  }

  // Méthodes publiques pour les statistiques et la gestion
  getStats() {
    return {
      ...this.stats,
      connected_users: this.connectedUsers.size,
      translation_service_stats: this.translationService.getStats()
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const translationHealth = await this.translationService.healthCheck();
      return translationHealth;
    } catch (error) {
      console.error(`❌ Health check échoué: ${error}`);
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.translationService.close();
      this.io.close();
      console.log('✅ MeeshySocketIOManager fermé');
    } catch (error) {
      console.error(`❌ Erreur fermeture MeeshySocketIOManager: ${error}`);
    }
  }
}
