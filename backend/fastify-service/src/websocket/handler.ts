import type { WebSocket } from 'ws';
import type { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../middleware/auth';

interface WebSocketConnection {
  socket: WebSocket;
  request: FastifyRequest;
}

interface WebSocketMessage {
  type: string;
  data: any;
  messageId?: string;
}

interface ConnectedUser {
  userId: string;
  username: string;
  socket: WebSocket;
  request: FastifyRequest;
}

// Map des utilisateurs connectés
const connectedUsers = new Map<string, ConnectedUser>();
// Map des conversations et leurs utilisateurs
const conversationUsers = new Map<string, Set<string>>();

export async function websocketHandler(connection: any, request: FastifyRequest) {
  let authenticatedUser: ConnectedUser | null = null;
  
  const token = (request.query as any)?.token;
  
  if (!token) {
    connection.send(JSON.stringify({
      type: 'error',
      data: { message: 'Token requis pour WebSocket' }
    }));
    connection.close();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    const user = await request.server.prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      connection.send(JSON.stringify({
        type: 'error',
        data: { message: 'Utilisateur non trouvé' }
      }));
      connection.close();
      return;
    }

    // Création de l'utilisateur connecté
    authenticatedUser = {
      userId: user.id,
      username: user.username,
      socket: connection,
      request: request
    };

    // Ajouter l'utilisateur à la map des utilisateurs connectés
    connectedUsers.set(user.id, authenticatedUser);

    // Déconnecter l'ancien socket s'il existe
    const existingUser = connectedUsers.get(user.id);
    if (existingUser && existingUser.socket !== connection) {
      existingUser.socket.close();
    }

    console.log(`Utilisateur ${user.username} connecté via WebSocket`);

    // Envoyer confirmation de connexion
    connection.send(JSON.stringify({
      type: 'connected',
      data: {
        userId: user.id,
        username: user.username,
        message: 'Connexion établie'
      }
    }));

    // Récupérer les conversations de l'utilisateur
    const conversations = await request.server.prisma.conversation.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
            isActive: true
          }
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    // Envoyer la liste des conversations
    connection.send(JSON.stringify({
      type: 'conversations_list',
      data: conversations
    }));

  } catch (error) {
    console.error('Erreur d\'authentification WebSocket:', error);
    connection.send(JSON.stringify({
      type: 'error',
      data: { message: 'Token invalide' }
    }));
    connection.close();
    return;
  }

  // Gestion des messages
  connection.on('message', async (rawMessage: string) => {
    try {
      const message: WebSocketMessage = JSON.parse(rawMessage);
      
      switch (message.type) {
        case 'join_conversation':
          await handleJoinConversation(message, authenticatedUser!, request);
          break;
        
        case 'leave_conversation':
          await handleLeaveConversation(message, authenticatedUser!);
          break;
        
        case 'send_message':
          await handleSendMessage(message, authenticatedUser!, request);
          break;
        
        case 'typing_start':
        case 'typing_stop':
          await handleTypingIndicator(message, authenticatedUser!);
          break;
        
        case 'message_read':
          await handleMessageRead(message, authenticatedUser!, request);
          break;
        
        default:
          connection.send(JSON.stringify({
            type: 'error',
            data: { message: `Type de message non supporté: ${message.type}` }
          }));
      }
    } catch (error) {
      console.error('Erreur traitement message WebSocket:', error);
      connection.send(JSON.stringify({
        type: 'error',
        data: { message: 'Erreur traitement du message' }
      }));
    }
  });

  // Gestion de la déconnexion
  connection.on('close', async () => {
    if (authenticatedUser) {
      console.log(`Utilisateur ${authenticatedUser.username} déconnecté`);
      
      // Retirer l'utilisateur de toutes les conversations
      conversationUsers.forEach((users, conversationId) => {
        users.delete(authenticatedUser!.userId);
        if (users.size === 0) {
          conversationUsers.delete(conversationId);
        }
      });
      
      // Retirer l'utilisateur de la map des connectés
      connectedUsers.delete(authenticatedUser.userId);
      
      // Notifier les autres utilisateurs
      broadcastToConversationUsers(authenticatedUser.userId, {
        type: 'user_disconnected',
        data: {
          userId: authenticatedUser.userId,
          username: authenticatedUser.username
        }
      });
    }
  });

  connection.on('error', (error: any) => {
    console.error('Erreur WebSocket:', error);
  });
}

async function handleJoinConversation(message: WebSocketMessage, user: ConnectedUser, request: FastifyRequest) {
  const { conversationId } = message.data;
  
  if (!conversationId) {
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'ID de conversation requis' }
    }));
    return;
  }

  try {
    // Vérifier que l'utilisateur a accès à cette conversation
    const conversation = await request.server.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: {
            userId: user.userId,
            isActive: true
          }
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 50,
          include: {
            sender: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      user.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Conversation non trouvée ou accès refusé' }
      }));
      return;
    }

    // Ajouter l'utilisateur à la conversation
    if (!conversationUsers.has(conversationId)) {
      conversationUsers.set(conversationId, new Set());
    }
    conversationUsers.get(conversationId)!.add(user.userId);

    // Confirmer la jointure
    user.socket.send(JSON.stringify({
      type: 'conversation_joined',
      data: {
        conversationId,
        messages: conversation.messages.reverse()
      }
    }));

    // Notifier les autres utilisateurs de la conversation
    broadcastToConversationUsers(conversationId, {
      type: 'user_joined_conversation',
      data: {
        conversationId,
        userId: user.userId,
        username: user.username
      }
    }, user.userId);

  } catch (error) {
    console.error('Erreur jointure conversation:', error);
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Erreur lors de la jointure de conversation' }
    }));
  }
}

async function handleLeaveConversation(message: WebSocketMessage, user: ConnectedUser) {
  const { conversationId } = message.data;
  
  if (conversationUsers.has(conversationId)) {
    conversationUsers.get(conversationId)!.delete(user.userId);
    
    if (conversationUsers.get(conversationId)!.size === 0) {
      conversationUsers.delete(conversationId);
    }
  }

  user.socket.send(JSON.stringify({
    type: 'conversation_left',
    data: { conversationId }
  }));

  // Notifier les autres utilisateurs
  broadcastToConversationUsers(conversationId, {
    type: 'user_left_conversation',
    data: {
      conversationId,
      userId: user.userId,
      username: user.username
    }
  }, user.userId);
}

async function handleSendMessage(message: WebSocketMessage, user: ConnectedUser, request: FastifyRequest) {
  const { conversationId, content, messageType = 'text' } = message.data;
  
  if (!conversationId || !content) {
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'ID de conversation et contenu requis' }
    }));
    return;
  }

  try {
    // Vérifier l'accès à la conversation
    const conversation = await request.server.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: {
            userId: user.userId,
            isActive: true
          }
        }
      }
    });

    if (!conversation) {
      user.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Conversation non trouvée ou accès refusé' }
      }));
      return;
    }

    // Créer le message
    const newMessage = await request.server.prisma.message.create({
      data: {
        content,
        messageType,
        conversationId,
        senderId: user.userId,
        createdAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    // Mettre à jour la conversation
    await request.server.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date()
      }
    });

    // Diffuser le message à tous les utilisateurs de la conversation
    broadcastToConversationUsers(conversationId, {
      type: 'new_message',
      data: {
        message: newMessage,
        conversationId
      }
    });

    // Confirmer l'envoi à l'expéditeur
    user.socket.send(JSON.stringify({
      type: 'message_sent',
      data: {
        messageId: newMessage.id,
        conversationId,
        tempId: message.messageId
      }
    }));

  } catch (error) {
    console.error('Erreur envoi message:', error);
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Erreur lors de l\'envoi du message' }
    }));
  }
}

async function handleTypingIndicator(message: WebSocketMessage, user: ConnectedUser) {
  const { conversationId } = message.data;
  
  if (!conversationId) return;

  // Diffuser l'indicateur de frappe aux autres utilisateurs
  broadcastToConversationUsers(conversationId, {
    type: message.type,
    data: {
      conversationId,
      userId: user.userId,
      username: user.username
    }
  }, user.userId);
}

async function handleMessageRead(message: WebSocketMessage, user: ConnectedUser, request: FastifyRequest) {
  const { messageId, conversationId } = message.data;
  
  if (!messageId || !conversationId) {
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'ID de message et conversation requis' }
    }));
    return;
  }

  try {
    // Créer un statut de lecture
    await request.server.prisma.messageReadStatus.create({
      data: {
        messageId,
        userId: user.userId,
        readAt: new Date()
      }
    });

    // Notifier les autres utilisateurs
    broadcastToConversationUsers(conversationId, {
      type: 'message_read',
      data: {
        messageId,
        conversationId,
        readBy: user.userId,
        readAt: new Date()
      }
    }, user.userId);

  } catch (error) {
    console.error('Erreur marquage message lu:', error);
    user.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Erreur lors du marquage du message' }
    }));
  }
}

function broadcastToConversationUsers(conversationId: string, message: any, excludeUserId?: string) {
  const users = conversationUsers.get(conversationId);
  if (!users) return;

  const messageStr = JSON.stringify(message);
  
  users.forEach((userId) => {
    if (excludeUserId && userId === excludeUserId) return;
    
    const user = connectedUsers.get(userId);
    if (user && user.socket.readyState === 1) { // WebSocket.OPEN
      try {
        user.socket.send(messageStr);
      } catch (error) {
        console.error(`Erreur envoi message à ${userId}:`, error);
        // Nettoyer les connexions fermées
        connectedUsers.delete(userId);
        users.delete(userId);
      }
    }
  });
}

// Fonction utilitaire pour diffuser à tous les utilisateurs connectés
export function broadcastToAllUsers(message: any, excludeUserId?: string) {
  const messageStr = JSON.stringify(message);
  
  connectedUsers.forEach((user, userId) => {
    if (excludeUserId && userId === excludeUserId) return;
    
    if (user.socket.readyState === 1) { // WebSocket.OPEN
      try {
        user.socket.send(messageStr);
      } catch (error) {
        console.error(`Erreur diffusion à ${userId}:`, error);
        connectedUsers.delete(userId);
      }
    }
  });
}

// Fonction pour obtenir les utilisateurs connectés
export function getConnectedUsers(): Map<string, ConnectedUser> {
  return connectedUsers;
}

// Fonction pour obtenir les utilisateurs d'une conversation
export function getConversationUsers(conversationId: string): Set<string> | undefined {
  return conversationUsers.get(conversationId);
}
