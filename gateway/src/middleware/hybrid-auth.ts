/**
 * Middleware d'authentification hybride pour gérer à la fois les utilisateurs authentifiés et les participants anonymes
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  userId: string; // Ajouté pour compatibilité avec l'interface existante
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  role: string;
  systemLanguage: string;
}

export interface AnonymousParticipant {
  id: string;
  sessionToken: string;
  username: string;
  firstName?: string;
  lastName?: string;
  language: string;
  isActive: boolean;
  isOnline: boolean;
  canSendMessages: boolean;
  canSendFiles: boolean;
  canSendImages: boolean;
  shareLinkId: string;
}

export interface HybridAuthRequest extends FastifyRequest {
  user: AuthenticatedUser;
  anonymousParticipant?: AnonymousParticipant;
  isAuthenticated: boolean;
  isAnonymous: boolean;
}

/**
 * Middleware d'authentification hybride
 * Accepte soit un Bearer token (utilisateurs authentifiés) soit un x-session-token (participants anonymes)
 */
export function createHybridAuthMiddleware(prisma: any, options: { requireAuth?: boolean } = {}) {
  return async function hybridAuth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authToken = request.headers.authorization?.replace('Bearer ', '');
      const sessionToken = request.headers['x-session-token'] as string;
      
      const hybridRequest = request as HybridAuthRequest;
      hybridRequest.isAuthenticated = false;
      hybridRequest.isAnonymous = false;

      // Tentative d'authentification avec Bearer token
      if (authToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'default-secret';
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(authToken, jwtSecret) as any;
          
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              role: true,
              systemLanguage: true,
              isActive: true
            }
          });

          if (user && user.isActive) {
            (hybridRequest as any).user = {
              id: user.id,
              userId: user.id, // Ajouté pour compatibilité
              username: user.username,
              email: user.email,
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
              displayName: user.displayName || undefined,
              avatar: user.avatar || undefined,
              role: user.role,
              systemLanguage: user.systemLanguage
            };
            hybridRequest.isAuthenticated = true;
            return; // Authentification réussie
          }
        } catch (error) {
          // Token invalide, on continue avec l'authentification anonyme
          console.log('[HYBRID-AUTH] Invalid Bearer token, trying session token');
        }
      }

      // Tentative d'authentification avec session token
      if (sessionToken) {
        const participant = await prisma.anonymousParticipant.findUnique({
          where: { sessionToken },
          include: {
            shareLink: {
              select: { 
                id: true,
                linkId: true,
                isActive: true,
                expiresAt: true
              }
            }
          }
        });

        if (participant && participant.isActive && participant.shareLink.isActive) {
          // Vérifier l'expiration du lien
          if (!participant.shareLink.expiresAt || participant.shareLink.expiresAt > new Date()) {
            hybridRequest.anonymousParticipant = {
              id: participant.id,
              sessionToken: participant.sessionToken,
              username: participant.username,
              firstName: participant.firstName || undefined,
              lastName: participant.lastName || undefined,
              language: participant.language,
              isActive: participant.isActive,
              isOnline: participant.isOnline,
              canSendMessages: participant.canSendMessages,
              canSendFiles: participant.canSendFiles,
              canSendImages: participant.canSendImages,
              shareLinkId: participant.shareLinkId
            };
            hybridRequest.isAnonymous = true;
            return; // Authentification anonyme réussie
          }
        }
      }

      // Aucune authentification valide trouvée
      if (options.requireAuth !== false) {
        return reply.status(401).send({
          success: false,
          message: 'Authentification requise. Veuillez fournir un Bearer token ou un x-session-token valide.'
        });
      }

    } catch (error) {
      console.error('[HYBRID-AUTH] Authentication error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur lors de l\'authentification'
      });
    }
  };
}

/**
 * Middleware pour exiger une authentification par Bearer token uniquement
 */
export function createAuthenticatedOnlyMiddleware(prisma: any) {
  return async function authenticatedOnly(request: FastifyRequest, reply: FastifyReply) {
    const authToken = request.headers.authorization?.replace('Bearer ', '');
    
    if (!authToken) {
      return reply.status(401).send({
        success: false,
        message: 'Bearer token requis pour cette opération'
      });
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret';
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authToken, jwtSecret) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          role: true,
          systemLanguage: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          message: 'Utilisateur non trouvé ou inactif'
        });
      }

      const hybridRequest = request as any;
      hybridRequest.user = {
        id: user.id,
        userId: user.id, // Ajouté pour compatibilité
        username: user.username,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        displayName: user.displayName || undefined,
        avatar: user.avatar || undefined,
        role: user.role,
        systemLanguage: user.systemLanguage
      };
      hybridRequest.isAuthenticated = true;
      hybridRequest.isAnonymous = false;

    } catch (error) {
      console.error('[AUTH-ONLY] Authentication error:', error);
      return reply.status(401).send({
        success: false,
        message: 'Token d\'authentification invalide'
      });
    }
  };
}

/**
 * Middleware pour vérifier les permissions de modération
 */
export function createModerationMiddleware() {
  return async function requireModeration(request: FastifyRequest, reply: FastifyReply) {
    const hybridRequest = request as any;
    
    if (!hybridRequest.isAuthenticated || !hybridRequest.user) {
      return reply.status(401).send({
        success: false,
        message: 'Authentification requise pour cette opération'
      });
    }

    const allowedRoles = ['BIGBOSS', 'ADMIN', 'MODO'];
    if (!allowedRoles.includes(hybridRequest.user.role)) {
      return reply.status(403).send({
        success: false,
        message: 'Permissions insuffisantes. Rôle modérateur requis.'
      });
    }
  };
}

/**
 * Middleware pour vérifier les permissions d'administration
 */
export function createAdminMiddleware() {
  return async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const hybridRequest = request as any;
    
    if (!hybridRequest.isAuthenticated || !hybridRequest.user) {
      return reply.status(401).send({
        success: false,
        message: 'Authentification requise pour cette opération'
      });
    }

    const allowedRoles = ['BIGBOSS', 'ADMIN'];
    if (!allowedRoles.includes(hybridRequest.user.role)) {
      return reply.status(403).send({
        success: false,
        message: 'Permissions insuffisantes. Rôle administrateur requis.'
      });
    }
  };
}
