import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';
import bcrypt from 'bcryptjs';

// Schéma de validation pour la mise à jour utilisateur
const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().nullable().optional().or(z.literal('')),
  bio: z.string().max(500).optional(),
  systemLanguage: z.string().min(2).max(5).optional(),
  regionalLanguage: z.string().min(2).max(5).optional(),
  customDestinationLanguage: z.string().min(2).max(5).optional(),
  autoTranslateEnabled: z.boolean().optional(),
  translateToSystemLanguage: z.boolean().optional(),
  translateToRegionalLanguage: z.boolean().optional(),
  useCustomDestination: z.boolean().optional(),
});

// Schéma de validation pour l'upload d'avatar
const updateAvatarSchema = z.object({
  avatar: z.string().refine(
    (data) => {
      // Accepter soit les URLs (http/https) soit les data URLs (base64)
      return data.startsWith('http://') || 
             data.startsWith('https://') || 
             data.startsWith('data:image/');
    },
    'Invalid avatar format. Must be a valid URL or base64 image'
  )
});

// Schéma de validation pour le changement de mot de passe
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(1, 'La confirmation du mot de passe est requise')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
});

export async function userRoutes(fastify: FastifyInstance) {
  // Route de test simple
  fastify.get('/users/me/test', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required',
          error: 'User must be authenticated'
        });
      }
      
      const userId = authContext.userId;
      fastify.log.info(`[TEST] Getting test data for user ${userId}`);
      
      return reply.send({
        success: true,
        data: {
          userId,
          message: "Test endpoint working",
          timestamp: new Date()
        }
      });
    } catch (error) {
      fastify.log.error(`[TEST] Error: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({
        success: false,
        message: 'Test error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Route pour obtenir les statistiques du tableau de bord de l'utilisateur connecté
  fastify.get('/users/me/dashboard-stats', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required',
          error: 'User must be authenticated to access dashboard stats'
        });
      }
      
      const userId = authContext.userId;
      fastify.log.info(`[DASHBOARD] Getting stats for user ${userId}`);

      // Récupérer les statistiques en parallèle
      const [
        // Conversations où l'utilisateur est membre actif
        totalConversations,
        activeConversations,
        recentConversations,
        
        // Communautés où l'utilisateur est membre actif  
        totalCommunities,
        recentCommunities,
        
        // Messages envoyés par l'utilisateur
        totalMessages,
        messagesThisWeek,
        
        // Liens de partage créés par l'utilisateur
        totalLinks,
        
        // Traductions effectuées (estimation basée sur les messages)
        translationsToday
      ] = await Promise.all([
        // Total conversations
        fastify.prisma.conversationMember.count({
          where: {
            userId,
            isActive: true
          }
        }),
        
        // Conversations actives (avec messages récents)
        fastify.prisma.conversationMember.count({
          where: {
            userId,
            isActive: true,
            conversation: {
              messages: {
                some: {
                  createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
                  },
                  isDeleted: false
                }
              }
            }
          }
        }),
        
        // Conversations récentes
        fastify.prisma.conversation.findMany({
          where: {
            members: {
              some: {
                userId,
                isActive: true
              }
            }
          },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                createdAt: true,
                sender: {
                  select: {
                    username: true,
                    displayName: true
                  }
                }
              }
            },
            members: {
              where: { isActive: true },
              select: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                    isOnline: true
                  }
                }
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: 5
        }),
        
        // Total communautés
        fastify.prisma.communityMember.count({
          where: {
            userId
          }
        }),
        
        // Communautés récentes
        fastify.prisma.community.findMany({
          where: {
            members: {
              some: {
                userId
              }
            }
          },
          include: {
            members: {
              select: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                  }
                }
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: 5
        }),
        
        // Total messages de l'utilisateur
        fastify.prisma.message.count({
          where: {
            senderId: userId,
            isDeleted: false
          }
        }),
        
        // Messages cette semaine
        fastify.prisma.message.count({
          where: {
            senderId: userId,
            isDeleted: false,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 jours
            }
          }
        }),
        
        // Total liens créés
        fastify.prisma.conversationShareLink.count({
          where: {
            createdBy: userId
          }
        }),
        
        // Estimation des traductions aujourd'hui (basée sur les messages multilingues)
        fastify.prisma.message.count({
          where: {
            senderId: userId,
            isDeleted: false,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
            }
            // Simplification: compter tous les messages récents comme traductions potentielles
          }
        })
      ]);

      // Transformer les données pour le frontend
      const stats = {
        totalConversations,
        totalCommunities,
        totalMessages: messagesThisWeek, // Messages cette semaine
        activeConversations,
        translationsToday,
        totalLinks,
        lastUpdated: new Date()
      };

      // Transformer les conversations récentes
      const transformedConversations = recentConversations.map(conv => ({
        id: conv.id,
        name: conv.title || `Conversation ${conv.id.slice(-4)}`,
        type: conv.type,
        isActive: activeConversations > 0,
        lastMessage: conv.messages && conv.messages.length > 0 ? {
          content: conv.messages[0].content,
          createdAt: conv.messages[0].createdAt,
          sender: conv.messages[0].sender
        } : null,
        members: conv.members.map(member => member.user)
      }));

      // Transformer les communautés récentes
      const transformedCommunities = recentCommunities.map(community => ({
        id: community.id,
        name: community.name,
        description: community.description,
        isPrivate: community.isPrivate,
        members: community.members.map(member => member.user),
        memberCount: community.members.length
      }));

      return reply.send({
        success: true,
        data: {
          stats,
          recentConversations: transformedConversations,
          recentCommunities: transformedCommunities
        }
      });

    } catch (error) {
      fastify.log.error(`[DASHBOARD] Error getting stats: ${error instanceof Error ? error.message : String(error)}`);
      logError(fastify.log, 'Get user dashboard stats error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Route pour obtenir les statistiques d'un utilisateur spécifique
  fastify.get('/users/:userId/stats', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required'
        });
      }

      const { userId } = request.params;
      fastify.log.info(`[USER_STATS] Getting stats for user ${userId}`);

      // Récupérer les statistiques de base de l'utilisateur
      const [
        totalConversations,
        totalMessages,
        totalFriends,
        userInfo
      ] = await Promise.all([
        // Nombre de conversations où l'utilisateur est membre
        fastify.prisma.conversationMember.count({
          where: {
            userId: userId,
            isActive: true
          }
        }),
        // Nombre de messages envoyés
        fastify.prisma.message.count({
          where: {
            senderId: userId,
            isDeleted: false
          }
        }),
        // Nombre d'amis (connexions acceptées)
        fastify.prisma.friendRequest.count({
          where: {
            OR: [
              { senderId: userId, status: 'accepted' },
              { receiverId: userId, status: 'accepted' }
            ]
          }
        }),
        // Informations de base de l'utilisateur
        fastify.prisma.user.findUnique({
          where: { id: userId },
          select: {
            createdAt: true,
            isOnline: true,
            lastSeen: true
          }
        })
      ]);

      const stats = {
        totalConversations,
        totalMessages,
        totalFriends,
        memberSince: userInfo?.createdAt,
        isOnline: userInfo?.isOnline,
        lastSeen: userInfo?.lastSeen
      };

      return reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      fastify.log.error(`[USER_STATS] Error getting user stats: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Route pour mettre à jour le profil utilisateur connecté
  fastify.patch('/users/me', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required',
          error: 'User must be authenticated to update profile'
        });
      }
      
      const userId = authContext.userId;
      const body = updateUserSchema.parse(request.body);
      
      // Construire l'objet de mise à jour avec uniquement les champs fournis
      const updateData: any = {};
      
      // Champs de profil de base
      if (body.firstName !== undefined) updateData.firstName = body.firstName;
      if (body.lastName !== undefined) updateData.lastName = body.lastName;
      if (body.displayName !== undefined) updateData.displayName = body.displayName;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phoneNumber !== undefined) {
        // Convertir les chaînes vides en null pour la base de données
        updateData.phoneNumber = body.phoneNumber === '' ? null : body.phoneNumber;
      }
      if (body.bio !== undefined) updateData.bio = body.bio;
      
      // Champs de configuration des langues
      if (body.systemLanguage !== undefined) updateData.systemLanguage = body.systemLanguage;
      if (body.regionalLanguage !== undefined) updateData.regionalLanguage = body.regionalLanguage;
      if (body.customDestinationLanguage !== undefined) updateData.customDestinationLanguage = body.customDestinationLanguage;
      
      // Champs de configuration de traduction
      if (body.autoTranslateEnabled !== undefined) updateData.autoTranslateEnabled = body.autoTranslateEnabled;
      if (body.translateToSystemLanguage !== undefined) updateData.translateToSystemLanguage = body.translateToSystemLanguage;
      if (body.translateToRegionalLanguage !== undefined) updateData.translateToRegionalLanguage = body.translateToRegionalLanguage;
      if (body.useCustomDestination !== undefined) updateData.useCustomDestination = body.useCustomDestination;

      // Logique exclusive pour les options de traduction
      // Si une option de traduction est activée, désactiver les autres
      if (body.translateToSystemLanguage === true) {
        updateData.translateToRegionalLanguage = false;
        updateData.useCustomDestination = false;
      } else if (body.translateToRegionalLanguage === true) {
        updateData.translateToSystemLanguage = false;
        updateData.useCustomDestination = false;
      } else if (body.useCustomDestination === true) {
        updateData.translateToSystemLanguage = false;
        updateData.translateToRegionalLanguage = false;
      }

      // Vérifier si l'email est unique (si modifié)
      if (body.email) {
        const existingUser = await fastify.prisma.user.findFirst({
          where: { 
            email: body.email,
            id: { not: userId }
          }
        });
        
        if (existingUser) {
          return reply.status(400).send({
            success: false,
            error: 'Cette adresse email est déjà utilisée'
          });
        }
      }

      // Vérifier si le numéro de téléphone est unique (si modifié et non vide)
      if (body.phoneNumber && body.phoneNumber.trim() !== '') {
        const existingUser = await fastify.prisma.user.findFirst({
          where: { 
            phoneNumber: body.phoneNumber,
            id: { not: userId }
          }
        });
        
        if (existingUser) {
          return reply.status(400).send({
            success: false,
            error: 'Ce numéro de téléphone est déjà utilisé'
          });
        }
      }

      // Mettre à jour l'utilisateur
      const updatedUser = await fastify.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          displayName: true,
          avatar: true,
          bio: true,
          isOnline: true,
          systemLanguage: true,
          regionalLanguage: true,
          customDestinationLanguage: true,
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: true,
          useCustomDestination: true,
          role: true,
          isActive: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return reply.send({
        success: true,
        data: updatedUser,
        message: 'Profil mis à jour avec succès'
      });

    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Données invalides',
          details: error.errors
        });
      }

      logError(fastify.log, 'Update user profile error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  });

  // Route pour mettre à jour l'avatar de l'utilisateur connecté
  fastify.patch('/users/me/avatar', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required',
          error: 'User must be authenticated to update avatar'
        });
      }
      
      const userId = authContext.userId;
      const body = updateAvatarSchema.parse(request.body);
      
      // Mettre à jour l'avatar de l'utilisateur
      const updatedUser = await fastify.prisma.user.update({
        where: { id: userId },
        data: { avatar: body.avatar },
        select: {
          id: true,
          username: true,
          avatar: true
        }
      });

      return reply.send({
        success: true,
        data: { avatar: updatedUser.avatar },
        message: 'Avatar mis à jour avec succès'
      });

    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Format d\'image invalide',
          details: error.errors
        });
      }

      logError(fastify.log, 'Update user avatar error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  });

  // Route pour changer le mot de passe de l'utilisateur connecté
  fastify.patch('/users/me/password', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required',
          error: 'User must be authenticated to change password'
        });
      }
      
      const userId = authContext.userId;
      
      // Valider le body de la requête
      const body = updatePasswordSchema.parse(request.body);
      
      // Récupérer l'utilisateur avec son mot de passe
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true }
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier que l'ancien mot de passe est correct
      const isPasswordValid = await bcrypt.compare(body.currentPassword, user.password);
      
      if (!isPasswordValid) {
        return reply.status(400).send({
          success: false,
          error: 'Le mot de passe actuel est incorrect'
        });
      }

      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(body.newPassword, 10);

      // Mettre à jour le mot de passe
      await fastify.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return reply.send({
        success: true,
        message: 'Mot de passe mis à jour avec succès'
      });

    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: error.errors[0]?.message || 'Données invalides',
          details: error.errors
        });
      }

      logError(fastify.log, 'Update password error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  });

  // Route pour rechercher des utilisateurs
  fastify.get('/users/search', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required',
          error: 'User must be authenticated to search users'
        });
      }
      
      const { q } = request.query as { q?: string };
      
      if (!q || q.trim().length < 2) {
        return reply.send([]);
      }
      
      const searchTerm = q.trim();
      
      // Rechercher les utilisateurs par nom, prénom, username ou email
      const users = await fastify.prisma.user.findMany({
        where: {
          AND: [
            {
              isActive: true // Seulement les utilisateurs actifs
            },
            {
              OR: [
                {
                  firstName: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                },
                {
                  lastName: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                },
                {
                  username: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                },
                {
                  email: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                },
                {
                  displayName: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          ]
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          isOnline: true,
          lastSeen: true,
          systemLanguage: true
        },
        orderBy: [
          { isOnline: 'desc' },
          { firstName: 'asc' },
          { lastName: 'asc' }
        ],
        take: 20 // Limiter à 20 résultats
      });
      
      reply.send(users);
    } catch (error) {
      logError(fastify.log, 'Erreur lors de la recherche d\'utilisateurs', error);
      reply.status(500).send({ 
        error: 'Erreur interne du serveur',
        message: 'Impossible de rechercher les utilisateurs'
      });
    }
  });

  // Route pour obtenir tous les utilisateurs
  fastify.get('/users', async (request, reply) => {
    reply.send({ message: 'Get all users - to be implemented' });
  });

  // Route pour obtenir un utilisateur par ID
  fastify.get('/users/:id', async (request, reply) => {
    reply.send({ message: 'Get user by ID - to be implemented' });
  });

  // Route pour mettre à jour un utilisateur
  fastify.put('/users/:id', async (request, reply) => {
    reply.send({ message: 'Update user - to be implemented' });
  });

  // Route pour supprimer un utilisateur
  fastify.delete('/users/:id', async (request, reply) => {
    reply.send({ message: 'Delete user - to be implemented' });
  });

  // ============================================================================
  // FRIEND REQUESTS ROUTES
  // ============================================================================

  // Récupérer les friend requests de l'utilisateur
  fastify.get('/users/friend-requests', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = authContext.userId;

      const friendRequests = await fastify.prisma.friendRequest.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              isOnline: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              isOnline: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.send({
        success: true,
        data: friendRequests
      });
    } catch (error) {
      console.error('Erreur récupération friend requests:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des demandes d\'amitié'
      });
    }
  });

  // Envoyer une friend request
  fastify.post('/users/friend-requests', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required'
        });
      }

      const senderId = authContext.userId;
      const body = z.object({ receiverId: z.string() }).parse(request.body);
      const { receiverId } = body;

      // Vérifier que l'utilisateur n'essaie pas de s'ajouter lui-même
      if (senderId === receiverId) {
        return reply.status(400).send({
          success: false,
          error: 'Vous ne pouvez pas vous ajouter vous-même'
        });
      }

      // Vérifier que l'utilisateur destinataire existe
      const receiver = await fastify.prisma.user.findUnique({
        where: { id: receiverId }
      });

      if (!receiver) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier qu'il n'y a pas déjà une demande en cours
      const existingRequest = await fastify.prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId }
          ]
        }
      });

      if (existingRequest) {
        return reply.status(400).send({
          success: false,
          error: 'Une demande d\'amitié existe déjà entre ces utilisateurs'
        });
      }

      // Créer la friend request
      const friendRequest = await fastify.prisma.friendRequest.create({
        data: {
          senderId,
          receiverId,
          status: 'pending'
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
            }
          }
        }
      });

      return reply.send({
        success: true,
        data: friendRequest
      });
    } catch (error) {
      console.error('Erreur envoi friend request:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'envoi de la demande d\'amitié'
      });
    }
  });

  // Répondre à une friend request (accepter/refuser)
  fastify.patch('/users/friend-requests/:id', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = authContext.userId;
      const params = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ action: z.enum(['accept', 'reject']) }).parse(request.body);
      const { id } = params;
      const { action } = body;

      // Trouver la friend request
      const friendRequest = await fastify.prisma.friendRequest.findFirst({
        where: {
          id: id,
          receiverId: userId, // Seul le destinataire peut répondre
          status: 'pending'
        }
      });

      if (!friendRequest) {
        return reply.status(404).send({
          success: false,
          error: 'Demande d\'amitié non trouvée ou déjà traitée'
        });
      }

      // Mettre à jour le statut
      const updatedRequest = await fastify.prisma.friendRequest.update({
        where: { id: id },
        data: {
          status: action === 'accept' ? 'accepted' : 'rejected'
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
            }
          }
        }
      });

      return reply.send({
        success: true,
        data: updatedRequest
      });
    } catch (error) {
      console.error('Erreur mise à jour friend request:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la mise à jour de la demande d\'amitié'
      });
    }
  });
}
