import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';
import { UserRoleEnum } from '../../shared/types';

// Types pour les rôles et permissions
type UserRole = UserRoleEnum;

interface UserPermissions {
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageCommunities: boolean;
  canManageConversations: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canViewAuditLogs: boolean;
  canManageNotifications: boolean;
  canManageTranslations: boolean;
}

// Schémas de validation
const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRoleEnum)
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

// Service de permissions
class PermissionsService {
  private readonly ROLE_HIERARCHY: Record<string, number> = {
    'BIGBOSS': 7,
    'ADMIN': 5,
    'MODO': 4,
    'AUDIT': 3,
    'ANALYST': 2,
    'USER': 1,
  };

  private readonly DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
    'BIGBOSS': {
      canAccessAdmin: true,
      canManageUsers: true,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canViewAuditLogs: true,
      canManageNotifications: true,
      canManageTranslations: true,
    },
    'ADMIN': {
      canAccessAdmin: true,
      canManageUsers: true,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canViewAuditLogs: false,
      canManageNotifications: true,
      canManageTranslations: false,
    },
    'MODO': {
      canAccessAdmin: true,
      canManageUsers: false,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: false,
      canModerateContent: true,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    'AUDIT': {
      canAccessAdmin: true,
      canManageUsers: false,
      canManageCommunities: false,
      canManageConversations: false,
      canViewAnalytics: true,
      canModerateContent: false,
      canViewAuditLogs: true,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    'ANALYST': {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageCommunities: false,
      canManageConversations: false,
      canViewAnalytics: true,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    'USER': {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageCommunities: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
  };

  getUserPermissions(role: UserRole): UserPermissions {
    return this.DEFAULT_PERMISSIONS[role] || this.DEFAULT_PERMISSIONS.USER;
  }

  hasPermission(userRole: UserRole, permission: keyof UserPermissions): boolean {
    const permissions = this.getUserPermissions(userRole);
    return permissions[permission];
  }

  canManageUser(adminRole: UserRole, targetRole: UserRole): boolean {
    return this.ROLE_HIERARCHY[adminRole] > this.ROLE_HIERARCHY[targetRole];
  }
}

const permissionsService = new PermissionsService();

// Middleware d'autorisation admin
const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  // Utiliser le nouveau système d'authentification unifié
  const authContext = (request as any).authContext;
  if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
    return reply.status(401).send({
      success: false,
      message: 'Authentification requise'
    });
  }

  const permissions = permissionsService.getUserPermissions(authContext.registeredUser.role);
  if (!permissions.canAccessAdmin) {
    return reply.status(403).send({
      success: false,
      message: 'Accès administrateur requis'
    });
  }
};

export async function adminRoutes(fastify: FastifyInstance) {
  // Tableau de bord administrateur
  fastify.get('/dashboard', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;

      // Statistiques générales - Toutes les métriques demandées
      const [
        totalUsers,
        activeUsers,
        totalConversations,
        totalCommunities,
        totalMessages,
        adminUsers,
        totalAnonymousUsers,
        activeAnonymousUsers,
        totalShareLinks,
        activeShareLinks,
        totalTranslations,
        totalReports,
        totalInvitations,
        languagesStats
      ] = await Promise.all([
        fastify.prisma.user.count(),
        fastify.prisma.user.count({ where: { isActive: true } }),
        fastify.prisma.conversation.count(),
        fastify.prisma.community.count(),
        fastify.prisma.message.count({ where: { isDeleted: false } }),
        fastify.prisma.user.count({
          where: {
            role: { in: ['ADMIN', 'BIGBOSS', 'MODO'] }
          }
        }),
        fastify.prisma.anonymousParticipant.count(),
        fastify.prisma.anonymousParticipant.count({ where: { isActive: true } }),
        fastify.prisma.conversationShareLink.count(),
        fastify.prisma.conversationShareLink.count({ where: { isActive: true } }),
        fastify.prisma.messageTranslation.count(),
        // Signalements réels depuis la table Report
        fastify.prisma.report.count(),
        // Pour les invitations, on utilise les demandes d'amitié comme proxy
        fastify.prisma.friendRequest.count({ where: { status: 'pending' } }),
        // Statistiques des langues les plus utilisées
        fastify.prisma.message.groupBy({
          by: ['originalLanguage'],
          where: { isDeleted: false },
          _count: { originalLanguage: true },
          orderBy: { _count: { originalLanguage: 'desc' } },
          take: 10
        })
      ]);

      // Permissions de l'utilisateur admin
      const userPermissions = permissionsService.getUserPermissions(user.role);

      // Statistiques d'activité récente (7 derniers jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivity = await Promise.all([
        fastify.prisma.user.count({
          where: { createdAt: { gte: sevenDaysAgo } }
        }),
        fastify.prisma.conversation.count({
          where: { createdAt: { gte: sevenDaysAgo } }
        }),
        fastify.prisma.message.count({
          where: { createdAt: { gte: sevenDaysAgo }, isDeleted: false }
        }),
        fastify.prisma.anonymousParticipant.count({
          where: { joinedAt: { gte: sevenDaysAgo } }
        })
      ]);

      // Statistiques par rôle
      const usersByRole = await fastify.prisma.user.groupBy({
        by: ['role'],
        _count: {
          role: true
        }
      });

      // Statistiques des messages par type
      const messagesByType = await fastify.prisma.message.groupBy({
        by: ['messageType'],
        where: { isDeleted: false },
        _count: {
          messageType: true
        }
      });

      return reply.send({
        success: true,
        data: {
          statistics: {
            // 1. Utilisateurs
            totalUsers,
            activeUsers,
            inactiveUsers: totalUsers - activeUsers,
            adminUsers,
            // 2. Utilisateurs anonymes
            totalAnonymousUsers,
            activeAnonymousUsers,
            inactiveAnonymousUsers: totalAnonymousUsers - activeAnonymousUsers,
            // 3. Messages
            totalMessages,
            // 4. Communautés
            totalCommunities,
            // 5. Traductions
            totalTranslations,
            // 6. Liens créés pour conversations
            totalShareLinks,
            activeShareLinks,
            // 7. Signalements (proxy avec messages supprimés)
            totalReports,
            // 8. Invitations à rejoindre communauté (proxy avec demandes d'amitié)
            totalInvitations,
            // 9. Langues les plus utilisées
            topLanguages: languagesStats.map(lang => ({
              language: lang.originalLanguage,
              count: lang._count.originalLanguage
            })),
            // Métadonnées supplémentaires
            usersByRole: usersByRole.reduce((acc, item) => {
              acc[item.role] = item._count.role;
              return acc;
            }, {} as Record<string, number>),
            messagesByType: messagesByType.reduce((acc, item) => {
              acc[item.messageType] = item._count.messageType;
              return acc;
            }, {} as Record<string, number>)
          },
          recentActivity: {
            newUsers: recentActivity[0],
            newConversations: recentActivity[1],
            newMessages: recentActivity[2],
            newAnonymousUsers: recentActivity[3]
          },
          userPermissions,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin dashboard error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Gestion des utilisateurs - Liste avec pagination
  fastify.get('/users', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageUsers) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour gérer les utilisateurs'
        });
      }

      const { page = '1', limit = '20', search, role, status } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;


      // Construire les filtres
      const where: any = {};
      
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (role) {
        where.role = role;
      }

      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      const [users, totalCount] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            avatar: true,
            role: true,
            isActive: true,
            isOnline: true,
            lastSeen: true,
            lastActiveAt: true,
            createdAt: true,
            updatedAt: true,
            // Champs de sécurité et vérification
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            twoFactorEnabledAt: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            lastPasswordChange: true,
            deactivatedAt: true,
            deletedAt: true,
            deletedBy: true,
            profileCompletionRate: true,
            _count: {
              select: {
                sentMessages: true,
                conversations: true,
                communityMemberships: true,
                createdCommunities: true,
                createdShareLinks: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        fastify.prisma.user.count({ where })
      ]);


      return reply.send({
        success: true,
        data: {
          users,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            hasMore: offset + users.length < totalCount
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin users error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Gestion des utilisateurs anonymes - Liste avec pagination
  fastify.get('/anonymous-users', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageUsers) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour gérer les utilisateurs'
        });
      }

      const { page = '1', limit = '20', search, status } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construire les filtres
      const where: any = {};
      
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      const [anonymousUsers, totalCount] = await Promise.all([
        fastify.prisma.anonymousParticipant.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            sessionToken: true,
            ipAddress: true,
            country: true,
            language: true,
            isActive: true,
            isOnline: true,
            lastActiveAt: true,
            joinedAt: true,
            lastSeenAt: true,
            leftAt: true,
            canSendMessages: true,
            canSendFiles: true,
            canSendImages: true,
            shareLink: {
              select: {
                id: true,
                linkId: true,
                identifier: true,
                name: true,
                conversation: {
                  select: {
                    id: true,
                    identifier: true,
                    title: true
                  }
                }
              }
            },
            _count: {
              select: {
                sentMessages: true
              }
            }
          },
          orderBy: { joinedAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        fastify.prisma.anonymousParticipant.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          anonymousUsers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            hasMore: offset + anonymousUsers.length < totalCount
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin anonymous users error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Détails d'un utilisateur
  fastify.get('/users/:id', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const { id } = request.params as { id: string };
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageUsers) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante'
        });
      }

      const targetUser = await fastify.prisma.user.findUnique({
        where: { id },
        include: {
          stats: true,
          _count: {
            select: {
              sentMessages: true,
              conversations: true,
              communityMemberships: true,
              createdCommunities: true,
              notifications: true
            }
          }
        }
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Masquer le mot de passe
      const { password, ...userWithoutPassword } = targetUser;

      return reply.send({
        success: true,
        data: userWithoutPassword
      });

    } catch (error) {
      logError(fastify.log, 'Get user details error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Modifier le rôle d'un utilisateur
  fastify.patch('/users/:id/role', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const { id } = request.params as { id: string };
      const body = updateUserRoleSchema.parse(request.body);
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageUsers) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante'
        });
      }

      // Récupérer l'utilisateur cible
      const targetUser = await fastify.prisma.user.findUnique({
        where: { id }
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier si l'admin peut modifier ce rôle
      if (!permissionsService.canManageUser(user.role, targetUser.role as UserRole)) {
        return reply.status(403).send({
          success: false,
          message: 'Vous ne pouvez pas modifier le rôle de cet utilisateur'
        });
      }

      if (!permissionsService.canManageUser(user.role, body.role)) {
        return reply.status(403).send({
          success: false,
          message: 'Vous ne pouvez pas attribuer ce rôle'
        });
      }

      // Mettre à jour le rôle
      const updatedUser = await fastify.prisma.user.update({
        where: { id },
        data: { role: body.role },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          updatedAt: true
        }
      });

      return reply.send({
        success: true,
        data: updatedUser,
        message: `Rôle mis à jour vers ${body.role}`
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Update user role error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Activer/désactiver un utilisateur
  fastify.patch('/users/:id/status', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const { id } = request.params as { id: string };
      const body = updateUserStatusSchema.parse(request.body);
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageUsers) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante'
        });
      }

      // Récupérer l'utilisateur cible
      const targetUser = await fastify.prisma.user.findUnique({
        where: { id }
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier les permissions
      if (!permissionsService.canManageUser(user.role, targetUser.role as UserRole)) {
        return reply.status(403).send({
          success: false,
          message: 'Vous ne pouvez pas modifier le statut de cet utilisateur'
        });
      }

      // Mettre à jour le statut
      const updatedUser = await fastify.prisma.user.update({
        where: { id },
        data: {
          isActive: body.isActive,
          deactivatedAt: body.isActive ? null : new Date()
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          deactivatedAt: true,
          updatedAt: true
        }
      });

      return reply.send({
        success: true,
        data: updatedUser,
        message: body.isActive ? 'Utilisateur activé' : 'Utilisateur désactivé'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Update user status error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Gestion des messages - Liste avec pagination
  fastify.get('/messages', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canModerateContent) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour gérer les messages'
        });
      }

      const { page = '1', limit = '20', search, type, period } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construire les filtres
      const where: any = { isDeleted: false };
      
      if (search) {
        where.content = { contains: search, mode: 'insensitive' };
      }

      if (type) {
        where.messageType = type;
      }

      // Filtre par période
      if (period) {
        const now = new Date();
        let startDate = new Date();
        
        switch (period) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setDate(startDate.getDate() - 30);
            break;
        }
        
        where.createdAt = { gte: startDate };
      }

      const [messages, totalCount] = await Promise.all([
        fastify.prisma.message.findMany({
          where,
          select: {
            id: true,
            content: true,
            messageType: true,
            originalLanguage: true,
            isEdited: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
              }
            },
            anonymousSender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            },
            conversation: {
              select: {
                id: true,
                identifier: true,
                title: true,
                type: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                originalName: true,
                mimeType: true,
                fileSize: true,
                fileUrl: true,
                thumbnailUrl: true,
                width: true,
                height: true,
                duration: true,
                bitrate: true,
                sampleRate: true,
                codec: true,
                channels: true,
                fps: true,
                videoCodec: true,
                pageCount: true,
                lineCount: true,
                uploadedBy: true,
                isAnonymous: true,
                createdAt: true
              }
            },
            _count: {
              select: {
                translations: true,
                replies: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        fastify.prisma.message.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          messages,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            hasMore: offset + messages.length < totalCount
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin messages error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Gestion des communautés - Liste avec pagination
  fastify.get('/communities', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageCommunities) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour gérer les communautés'
        });
      }

      const { page = '1', limit = '20', search, isPrivate } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construire les filtres
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (isPrivate !== undefined) {
        where.isPrivate = isPrivate === 'true';
      }

      const [communities, totalCount] = await Promise.all([
        fastify.prisma.community.findMany({
          where,
          select: {
            id: true,
            identifier: true,
            name: true,
            description: true,
            avatar: true,
            isPrivate: true,
            createdAt: true,
            creator: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
              }
            },
            _count: {
              select: {
                members: true,
                Conversation: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        fastify.prisma.community.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          communities,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            hasMore: offset + communities.length < totalCount
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin communities error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Gestion des traductions - Liste avec pagination
  fastify.get('/translations', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageTranslations) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour gérer les traductions'
        });
      }

      const { page = '1', limit = '20', sourceLanguage, targetLanguage, period } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construire les filtres
      const where: any = {};
      
      if (sourceLanguage) {
        where.sourceLanguage = sourceLanguage;
      }

      if (targetLanguage) {
        where.targetLanguage = targetLanguage;
      }

      // Filtre par période
      if (period) {
        const now = new Date();
        let startDate = new Date();
        
        switch (period) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setDate(startDate.getDate() - 30);
            break;
        }
        
        where.createdAt = { gte: startDate };
      }

      const [translations, totalCount] = await Promise.all([
        fastify.prisma.messageTranslation.findMany({
          where,
          select: {
            id: true,
            sourceLanguage: true,
            targetLanguage: true,
            translatedContent: true,
            translationModel: true,
            confidenceScore: true,
            createdAt: true,
            message: {
              select: {
                id: true,
                content: true,
                originalLanguage: true,
                sender: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true
                  }
                },
                conversation: {
                  select: {
                    id: true,
                    identifier: true,
                    title: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        fastify.prisma.messageTranslation.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          translations: translations.map(translation => ({
            ...translation,
            message: {
              ...translation.message,
              // S'assurer que le content est toujours le contenu original
              originalContent: translation.message.content
            }
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            hasMore: offset + translations.length < totalCount
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin translations error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Gestion des liens de partage - Liste avec pagination
  fastify.get('/share-links', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canManageConversations) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour gérer les liens de partage'
        });
      }

      const { page = '1', limit = '20', search, isActive } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construire les filtres
      const where: any = {};
      
      if (search) {
        where.OR = [
          { linkId: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const [shareLinks, totalCount] = await Promise.all([
        fastify.prisma.conversationShareLink.findMany({
          where,
          select: {
            id: true,
            linkId: true,
            identifier: true,
            name: true,
            description: true,
            maxUses: true,
            currentUses: true,
            maxConcurrentUsers: true,
            currentConcurrentUsers: true,
            expiresAt: true,
            isActive: true,
            allowAnonymousMessages: true,
            allowAnonymousFiles: true,
            allowAnonymousImages: true,
            createdAt: true,
            creator: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
              }
            },
            conversation: {
              select: {
                id: true,
                identifier: true,
                title: true,
                type: true
              }
            },
            _count: {
              select: {
                anonymousParticipants: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        fastify.prisma.conversationShareLink.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          shareLinks,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            hasMore: offset + shareLinks.length < totalCount
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get admin share links error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Statistiques avancées
  fastify.get('/analytics', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const user = authContext.registeredUser;
      const permissions = permissionsService.getUserPermissions(user.role);

      if (!permissions.canViewAnalytics) {
        return reply.status(403).send({
          success: false,
          message: 'Permission insuffisante pour voir les analyses'
        });
      }

      const { period = '7d' } = request.query as any;

      // Calculer la période
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // Statistiques d'activité
      const [
        userActivity,
        messageActivity,
        conversationActivity,
        usersByRole,
        topActiveUsers
      ] = await Promise.all([
        // Nouveaux utilisateurs par période
        fastify.prisma.user.groupBy({
          by: ['createdAt'],
          where: {
            createdAt: { gte: startDate }
          },
          _count: { id: true }
        }),
        
        // Messages par période
        fastify.prisma.message.groupBy({
          by: ['createdAt'],
          where: {
            createdAt: { gte: startDate },
            isDeleted: false
          },
          _count: { id: true }
        }),
        
        // Nouvelles conversations par période
        fastify.prisma.conversation.groupBy({
          by: ['createdAt'],
          where: {
            createdAt: { gte: startDate }
          },
          _count: { id: true }
        }),

        // Répartition par rôle
        fastify.prisma.user.groupBy({
          by: ['role'],
          _count: { id: true }
        }),

        // Utilisateurs les plus actifs
        fastify.prisma.user.findMany({
          select: {
            id: true,
            username: true,
            displayName: true,
            _count: {
              select: {
                sentMessages: true
              }
            }
          },
          orderBy: {
            sentMessages: {
              _count: 'desc'
            }
          },
          take: 10
        })
      ]);

      return reply.send({
        success: true,
        data: {
          period,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          userActivity,
          messageActivity,
          conversationActivity,
          usersByRole,
          topActiveUsers
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get analytics error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
}
