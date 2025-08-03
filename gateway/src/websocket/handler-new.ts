import type { WebSocket } from 'ws';
import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../middleware/auth';

interface AuthenticatedRequest extends FastifyRequest {
  jwtUser?: AuthenticatedUser;
  query: {
    token?: string;
  };
}

interface WebSocketMessage {
  type: string;
  data: any;
  messageId?: string;
}

interface ConnectedUser {
  userId: string;
  socket: WebSocket;
  conversationIds: Set<string>;
}

// Map des utilisateurs connectés
const connectedUsers = new Map<string, ConnectedUser>();
// Map des conversations et leurs utilisateurs
const conversationUsers = new Map<string, Set<string>>();

export async function websocketHandler(connection: { socket: WebSocket }, request: AuthenticatedRequest) {
  let authenticatedUser: ConnectedUser | null = null;

  // Authentification via token dans les paramètres de requête
  const token = request.query?.token;
  
  if (!token) {
    connection.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Token d\'authentification requis' }
    }));
    connection.socket.close();
    return;
  }

  try {
    // Vérification du token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthenticatedUser;
    
    // Récupération des informations utilisateur depuis la base de données
    const user = await request.server.prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Utilisateur non trouvé' }
      }));
      connection.socket.close();
      return;
    }

    // Création de l'utilisateur connecté
    authenticatedUser = {
      userId: user.id,
      socket: connection.socket,
      conversationIds: new Set()
    };

    // Ajout à la map des utilisateurs connectés
    connectedUsers.set(user.id, authenticatedUser);

    // Récupération des conversations de l'utilisateur
    const userConversations = await request.server.prisma.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true }
    });

    // Inscription aux conversations
    for (const conv of userConversations) {
      authenticatedUser.conversationIds.add(conv.conversationId);
      
      if (!conversationUsers.has(conv.conversationId)) {
        conversationUsers.set(conv.conversationId, new Set());
      }
      conversationUsers.get(conv.conversationId)!.add(user.id);
    }

    // Confirmation de connexion
    connection.socket.send(JSON.stringify({
      type: 'connected',
      data: {
        userId: user.id,
        username: user.username,
        conversations: Array.from(authenticatedUser.conversationIds)
      }
    }));

    // Mise à jour du statut en ligne
    await request.server.prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastActiveAt: new Date()
      }
    });

  } catch (error) {
    connection.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Token invalide' }
    }));
    connection.socket.close();
    return;
  }

  // Gestionnaire des messages WebSocket
  connection.socket.on('message', async (rawMessage: string) => {
    if (!authenticatedUser) return;

    try {
      const message: WebSocketMessage = JSON.parse(rawMessage);

      switch (message.type) {
        case 'join_conversation':
          await handleJoinConversation(message, authenticatedUser, request);
          break;
        
        case 'leave_conversation':
          await handleLeaveConversation(message, authenticatedUser);
          break;
        
        case 'send_message':
          await handleSendMessage(message, authenticatedUser, request);
          break;
        
        case 'typing_start':
          await handleTypingStart(message, authenticatedUser);
          break;
        
        case 'typing_stop':
          await handleTypingStop(message, authenticatedUser);
          break;
        
        case 'message_read':
          await handleMessageRead(message, authenticatedUser, request);
          break;
        
        default:
          connection.socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Type de message non reconnu' }
          }));
      }
    } catch (error) {
      console.error('Erreur lors du traitement du message WebSocket:', error);
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Erreur lors du traitement du message' }
      }));
    }
  });

  // Gestionnaire de déconnexion
  connection.socket.on('close', async () => {
    if (authenticatedUser) {
      // Suppression de la map des utilisateurs connectés
      connectedUsers.delete(authenticatedUser.userId);

      // Suppression des conversations
      for (const conversationId of authenticatedUser.conversationIds) {
        const users = conversationUsers.get(conversationId);
        if (users) {
          users.delete(authenticatedUser.userId);
          if (users.size === 0) {
            conversationUsers.delete(conversationId);
          }
        }
      }

      // Mise à jour du statut hors ligne
      try {
        await request.server.prisma.user.update({
          where: { id: authenticatedUser.userId },
          data: {
            isOnline: false,
            lastSeen: new Date()
          }
        });
      } catch (error) {
        console.error('Erreur lors de la mise à jour du statut utilisateur:', error);
      }
    }
  });
}

// Fonctions de gestion des messages
async function handleJoinConversation(message: WebSocketMessage, user: ConnectedUser, request: AuthenticatedRequest) {
  const { conversationId } = message.data;
  
  // Vérifier que l'utilisateur a accès à cette conversation
  const membership = await request.server.prisma.conversationMember.findFirst({
    where: {
      userId: user.userId,
      conversationId: conversationId
    }
  });

  if (membership) {
    user.conversationIds.add(conversationId);
    
    if (!conversationUsers.has(conversationId)) {
      conversationUsers.set(conversationId, new Set());
    }
    conversationUsers.get(conversationId)!.add(user.userId);

    user.socket.send(JSON.stringify({
      type: 'conversation_joined',
      data: { conversationId }
    }));
  } else {
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Accès à la conversation refusé' }
    }));
  }
}

async function handleLeaveConversation(message: WebSocketMessage, user: ConnectedUser) {
  const { conversationId } = message.data;
  
  user.conversationIds.delete(conversationId);
  
  const users = conversationUsers.get(conversationId);
  if (users) {
    users.delete(user.userId);
    if (users.size === 0) {
      conversationUsers.delete(conversationId);
    }
  }

  user.socket.send(JSON.stringify({
    type: 'conversation_left',
    data: { conversationId }
  }));
}

async function handleSendMessage(message: WebSocketMessage, user: ConnectedUser, request: AuthenticatedRequest) {
  const { conversationId, content, messageType = 'TEXT' } = message.data;

  // Créer le message en base
  const newMessage = await request.server.prisma.message.create({
    data: {
      conversationId,
      senderId: user.userId,
      content,
      messageType,
      originalLanguage: 'fr', // À déterminer automatiquement
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true
        }
      }
    }
  });

  // Diffuser le message à tous les utilisateurs de la conversation
  const conversationUserIds = conversationUsers.get(conversationId);
  if (conversationUserIds) {
    const messagePayload = {
      type: 'new_message',
      data: {
        id: newMessage.id,
        conversationId: newMessage.conversationId,
        sender: newMessage.sender,
        content: newMessage.content,
        messageType: newMessage.messageType,
        originalLanguage: newMessage.originalLanguage,
        sentAt: new Date().toISOString(),
        isEdited: false
      }
    };

    for (const userId of conversationUserIds) {
      const connectedUser = connectedUsers.get(userId);
      if (connectedUser) {
        connectedUser.socket.send(JSON.stringify(messagePayload));
      }
    }
  }
}

async function handleTypingStart(message: WebSocketMessage, user: ConnectedUser) {
  const { conversationId } = message.data;
  
  // Diffuser l'indicateur de frappe aux autres utilisateurs de la conversation
  const conversationUserIds = conversationUsers.get(conversationId);
  if (conversationUserIds) {
    const typingPayload = {
      type: 'user_typing_start',
      data: {
        userId: user.userId,
        conversationId
      }
    };

    for (const userId of conversationUserIds) {
      if (userId !== user.userId) {
        const connectedUser = connectedUsers.get(userId);
        if (connectedUser) {
          connectedUser.socket.send(JSON.stringify(typingPayload));
        }
      }
    }
  }
}

async function handleTypingStop(message: WebSocketMessage, user: ConnectedUser) {
  const { conversationId } = message.data;
  
  // Diffuser l'arrêt de frappe aux autres utilisateurs de la conversation
  const conversationUserIds = conversationUsers.get(conversationId);
  if (conversationUserIds) {
    const typingPayload = {
      type: 'user_typing_stop',
      data: {
        userId: user.userId,
        conversationId
      }
    };

    for (const userId of conversationUserIds) {
      if (userId !== user.userId) {
        const connectedUser = connectedUsers.get(userId);
        if (connectedUser) {
          connectedUser.socket.send(JSON.stringify(typingPayload));
        }
      }
    }
  }
}

async function handleMessageRead(message: WebSocketMessage, user: ConnectedUser, request: AuthenticatedRequest) {
  const { messageId, conversationId } = message.data;

  // Marquer le message comme lu
  await request.server.prisma.messageReadStatus.upsert({
    where: {
      messageId_userId: {
        messageId,
        userId: user.userId
      }
    },
    update: {
      readAt: new Date()
    },
    create: {
      messageId,
      userId: user.userId,
      readAt: new Date()
    }
  });

  // Notifier les autres utilisateurs de la conversation
  const conversationUserIds = conversationUsers.get(conversationId);
  if (conversationUserIds) {
    const readPayload = {
      type: 'message_read',
      data: {
        messageId,
        userId: user.userId,
        conversationId,
        readAt: new Date().toISOString()
      }
    };

    for (const userId of conversationUserIds) {
      if (userId !== user.userId) {
        const connectedUser = connectedUsers.get(userId);
        if (connectedUser) {
          connectedUser.socket.send(JSON.stringify(readPayload));
        }
      }
    }
  }
}
