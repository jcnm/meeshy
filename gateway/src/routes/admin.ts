import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';
import { UserRoleEnum } from '@shared/types';

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
  private readonly ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRoleEnum.BIGBOSS]: 7,
  [UserRoleEnum.CREATOR]: 6,
  [UserRoleEnum.ADMIN]: 5,
  [UserRoleEnum.MODERATOR]: 4,
  [UserRoleEnum.AUDIT]: 3,
  [UserRoleEnum.ANALYST]: 2,
  [UserRoleEnum.USER]: 1,
  [UserRoleEnum.MEMBER]: 1,
  };

  private readonly DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
    [UserRoleEnum.BIGBOSS]: {
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
    [UserRoleEnum.CREATOR]: {
      canAccessAdmin: true,
      canManageUsers: true,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canViewAuditLogs: true,
      canManageNotifications: true,
      canManageTranslations: false,
    },
    [UserRoleEnum.ADMIN]: {
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
    [UserRoleEnum.MODERATOR]: {
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
    [UserRoleEnum.AUDIT]: {
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
    [UserRoleEnum.ANALYST]: {
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
    [UserRoleEnum.USER]: {
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
    [UserRoleEnum.MEMBER]: {
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
  const { user } = request as any;
  if (!user) {
    return reply.status(401).send({
      success: false,
      message: 'Authentification requise'
    });
  }

  const permissions = permissionsService.getUserPermissions(user.role);
  if (!permissions.canAccessAdmin) {
    return reply.status(403).send({
      success: false,
      message: 'Accès administrateur requis'
    });
  }
};

export async function adminRoutes(fastify: FastifyInstance) {
  // Tableau de bord administrateur
  fastify.get('/admin/dashboard', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user } = request as any;

      // Statistiques générales
      const [
        totalUsers,
        activeUsers,
        totalConversations,
        totalCommunities,
        totalMessages,
        adminUsers
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
        })
      ]);

      return reply.send({
        success: true,
        data: {
          statistics: {
            totalUsers,
            activeUsers,
            inactiveUsers: totalUsers - activeUsers,
            totalConversations,
            totalCommunities,
            totalMessages,
            adminUsers
          },
          recentActivity: {
            newUsers: recentActivity[0],
            newConversations: recentActivity[1],
            newMessages: recentActivity[2]
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
  fastify.get('/admin/users', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user } = request as any;
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
            _count: {
              select: {
                sentMessages: true,
                conversations: true,
                communityMemberships: true
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

  // Détails d'un utilisateur
  fastify.get('/admin/users/:id', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user } = request as any;
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
  fastify.patch('/admin/users/:id/role', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user } = request as any;
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
  fastify.patch('/admin/users/:id/status', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user } = request as any;
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

  // Statistiques avancées
  fastify.get('/admin/analytics', {
    onRequest: [fastify.authenticate, requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user } = request as any;
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
