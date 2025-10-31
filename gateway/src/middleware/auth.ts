/**
 * Middleware d'authentification unifié Phase 3.1.1
 * 
 * Centralise l'authentification pour REST et WebSocket
 * - JWT Token = Utilisateurs enregistrés
 * - X-Session-Token = Utilisateurs anonymes
 * - Fournit un contexte complet pour les deux types
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '../../shared/prisma/client';
import type { AuthenticationContext, AuthenticationType } from '../../shared/types';
import jwt from 'jsonwebtoken';

// ===== TYPES UNIFIÉS =====

export interface RegisteredUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  role: string;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  isOnline: boolean;
  lastActiveAt: Date;
}

export interface AnonymousUser {
  id: string;  // MongoDB ObjectId du AnonymousParticipant
  sessionToken: string;
  username: string;
  firstName?: string;
  lastName?: string;
  language: string;
  shareLinkId: string;
  permissions: {
    canSendMessages: boolean;
    canSendFiles: boolean;
    canSendImages: boolean;
    canSendVideos: boolean;
    canSendAudios: boolean;
    canSendLocations: boolean;
    canSendLinks: boolean;
  };
}

export interface UnifiedAuthContext {
  // Context général
  type: AuthenticationType;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  
  // Utilisateur enregistré (si JWT)
  registeredUser?: RegisteredUser;
  jwtToken?: string;
  jwtPayload?: any;
  
  // Utilisateur anonyme (si Session)
  anonymousUser?: AnonymousUser;
  sessionToken?: string;
  
  // Métadonnées communes
  userLanguage: string;  // Langue principale de l'utilisateur
  displayName: string;   // Nom d'affichage
  userId: string;        // ID unifié (user.id ou sessionToken)
  
  // Permissions communes
  canSendMessages: boolean;
  hasFullAccess: boolean;  // true pour JWT, basé sur permissions pour session
}

export interface UnifiedAuthRequest extends FastifyRequest {
  authContext: UnifiedAuthContext;
}

// ===== SERVICE D'AUTHENTIFICATION =====

export class AuthMiddleware {
  constructor(private prisma: PrismaClient) {}

  /**
   * Crée le contexte d'authentification unifié
   */
  async createAuthContext(
    authorizationHeader?: string,
    sessionToken?: string
  ): Promise<UnifiedAuthContext> {
    
    // 1. Extraire le JWT token
    const jwtToken = authorizationHeader?.startsWith('Bearer ') 
      ? authorizationHeader.slice(7) 
      : null;

    // 2. JWT Token = Utilisateur enregistré
    if (jwtToken) {
      return await this.createRegisteredUserContext(jwtToken);
    }
    
    // 3. Session Token = Utilisateur anonyme
    if (sessionToken) {
      return await this.createAnonymousUserContext(sessionToken);
    }
    
    // 4. Aucun token = Non authentifié
    return this.createUnauthenticatedContext();
  }

  /**
   * Contexte pour utilisateur enregistré (JWT)
   */
  private async createRegisteredUserContext(jwtToken: string): Promise<UnifiedAuthContext> {
    try {
      // Vérifier le JWT
      const jwtPayload = jwt.verify(jwtToken, process.env.JWT_SECRET!) as any;
      
      // Récupérer l'utilisateur complet
      const user = await this.prisma.user.findUnique({
        where: { id: jwtPayload.userId },
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
          regionalLanguage: true,
          customDestinationLanguage: true,
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: true,
          useCustomDestination: true,
          isOnline: true,
          lastActiveAt: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Déterminer la langue principale
      const userLanguage = user.useCustomDestination && user.customDestinationLanguage
        ? user.customDestinationLanguage
        : user.translateToSystemLanguage 
        ? user.systemLanguage 
        : user.regionalLanguage;

      return {
        type: 'jwt',
        isAuthenticated: true,
        isAnonymous: false,
        
        registeredUser: user as RegisteredUser,
        jwtToken,
        jwtPayload,
        
        userLanguage,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.username,
        userId: user.id,
        
        canSendMessages: true,
        hasFullAccess: true
      };

    } catch (error) {
      console.error('[UnifiedAuth] JWT validation failed:', error);
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Contexte pour utilisateur anonyme (Session Token)
   */
  private async createAnonymousUserContext(sessionToken: string): Promise<UnifiedAuthContext> {
    try {
      // Récupérer le participant anonyme via session token
      const anonymousParticipant = await this.prisma.anonymousParticipant.findUnique({
        where: { sessionToken },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          language: true,
          shareLinkId: true,
          isActive: true,
          canSendMessages: true,
          canSendFiles: true,
          canSendImages: true,
          shareLink: {
            select: {
              id: true,
              allowAnonymousMessages: true,
              allowAnonymousFiles: true,
              allowAnonymousImages: true
            }
          }
        }
      });

      if (!anonymousParticipant || !anonymousParticipant.isActive) {
        throw new Error('Anonymous participant not found or inactive');
      }

      // Utiliser les permissions du shareLink et du participant
      const shareLink = anonymousParticipant.shareLink;
      
      const anonymousUser: AnonymousUser = {
        id: anonymousParticipant.id,
        sessionToken,
        username: anonymousParticipant.username,
        firstName: anonymousParticipant.firstName || undefined,
        lastName: anonymousParticipant.lastName || undefined,
        language: anonymousParticipant.language,
        shareLinkId: anonymousParticipant.shareLinkId,
        permissions: {
          canSendMessages: anonymousParticipant.canSendMessages && (shareLink?.allowAnonymousMessages ?? true),
          canSendFiles: anonymousParticipant.canSendFiles && (shareLink?.allowAnonymousFiles ?? false),
          canSendImages: anonymousParticipant.canSendImages && (shareLink?.allowAnonymousImages ?? true),
          canSendVideos: false, // Non supporté par défaut
          canSendAudios: false, // Non supporté par défaut
          canSendLocations: false, // Non supporté par défaut
          canSendLinks: false // Non supporté par défaut
        }
      };

      return {
        type: 'session',
        isAuthenticated: true,
        isAnonymous: true,
        
        anonymousUser,
        sessionToken,
        
        userLanguage: anonymousUser.language,
        displayName: anonymousUser.firstName && anonymousUser.lastName 
          ? `${anonymousUser.firstName} ${anonymousUser.lastName}`.trim()
          : anonymousUser.username,
        userId: anonymousParticipant.id, // Utiliser l'ID du participant anonyme
        
        canSendMessages: anonymousUser.permissions.canSendMessages,
        hasFullAccess: false
      };

    } catch (error) {
      console.error('[UnifiedAuth] Session token validation failed:', error);
      throw new Error('Invalid session token');
    }
  }

  /**
   * Contexte pour requête non authentifiée
   */
  private createUnauthenticatedContext(): UnifiedAuthContext {
    return {
      type: 'anonymous',
      isAuthenticated: false,
      isAnonymous: true,
      
      userLanguage: 'fr', // Langue par défaut
      displayName: 'Visiteur',
      userId: 'anonymous',
      
      canSendMessages: false,
      hasFullAccess: false
    };
  }
}

// ===== MIDDLEWARE FASTIFY =====

/**
 * Créer le middleware d'authentification unifié pour Fastify
 */
export function createUnifiedAuthMiddleware(
  prisma: PrismaClient, 
  options: { 
    requireAuth?: boolean;
    allowAnonymous?: boolean;
  } = {}
) {
  const authMiddleware = new AuthMiddleware(prisma);
  
  return async function unifiedAuth(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Créer le contexte d'authentification
      const authContext = await authMiddleware.createAuthContext(
        request.headers.authorization,
        request.headers['x-session-token'] as string
      );

      // Vérifier les exigences d'authentification
      if (options.requireAuth && !authContext.isAuthenticated) {
        return reply.status(401).send({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!options.allowAnonymous && authContext.isAnonymous && authContext.type !== 'jwt') {
        return reply.status(403).send({
          error: 'Registered user required',
          code: 'REGISTERED_USER_REQUIRED'
        });
      }

      // Attacher le contexte à la requête
      (request as UnifiedAuthRequest).authContext = authContext;

      console.log(`[UnifiedAuth] ${authContext.type.toUpperCase()} - ${authContext.displayName} (${authContext.userId})`);

    } catch (error) {
      console.error('[UnifiedAuth] Authentication failed:', error);
      
      if (options.requireAuth) {
        return reply.status(401).send({
          error: error instanceof Error ? error.message : 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }
      
      // Si l'auth n'est pas requise, continuer avec contexte non authentifié
      const authMiddleware = new AuthMiddleware(prisma);
      (request as UnifiedAuthRequest).authContext = await authMiddleware.createAuthContext();
    }
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Vérifier si l'utilisateur est enregistré
 */
export function isRegisteredUser(authContext: UnifiedAuthContext): boolean {
  return authContext.type === 'jwt' && !authContext.isAnonymous;
}

/**
 * Vérifier si l'utilisateur est anonyme
 */
export function isAnonymousUser(authContext: UnifiedAuthContext): boolean {
  return authContext.type === 'session' && authContext.isAnonymous;
}

/**
 * Obtenir les permissions de l'utilisateur
 */
export function getUserPermissions(authContext: UnifiedAuthContext) {
  if (isRegisteredUser(authContext)) {
    return {
      canSendMessages: true,
      canSendFiles: true,
      canSendImages: true,
      canSendVideos: true,
      canSendAudios: true,
      canSendLocations: true,
      canSendLinks: true,
      hasFullAccess: true
    };
  }
  
  if (isAnonymousUser(authContext) && authContext.anonymousUser) {
    return {
      ...authContext.anonymousUser.permissions,
      hasFullAccess: false
    };
  }
  
  return {
    canSendMessages: false,
    canSendFiles: false,
    canSendImages: false,
    canSendVideos: false,
    canSendAudios: false,
    canSendLocations: false,
    canSendLinks: false,
    hasFullAccess: false
  };
}

// ===== MIDDLEWARE COMPATIBILITÉ (LEGACY) =====

/**
 * Middleware d'authentification basique pour compatibilité
 * @deprecated Utiliser createUnifiedAuthMiddleware à la place
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  console.warn('[AUTH] authenticate() is deprecated, use createUnifiedAuthMiddleware instead');
  
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.substring(7);
    
    // En mode développement, utiliser le service d'authentification avec les comptes de test
    if (process.env.NODE_ENV === 'development') {
      const { AuthService } = await import('../services/auth-test.service');
      const decoded = AuthService.verifyToken(token);
      
      if (decoded) {
        const user = AuthService.getUserById(decoded.userId);
        if (user) {
          (request as any).user = {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          };
          return;
        }
      }
    }

    // En production, utiliser le JWT standard
    await request.jwtVerify();
    
    const { userId, email, username } = request.user as any;
    if (!userId) {
      throw new Error('Invalid token payload: missing userId');
    }
    (request.user as any).id = userId;
    
  } catch (error) {
    console.error('[GATEWAY] Authentication failed:', error);
    reply.code(401).send({ 
      success: false,
      message: 'Token invalide ou manquant' 
    });
  }
}

/**
 * Middleware de vérification des rôles
 * @deprecated Utiliser getUserPermissions à la place
 */
export function requireRole(allowedRoles: string | string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('[GATEWAY] Role verification - to be implemented', allowedRoles);
    } catch (error) {
      reply.code(403).send({ error: 'Insufficient permissions' });
    }
  };
}

export const requireAdmin = requireRole(['BIGBOSS', 'ADMIN']);
export const requireModerator = requireRole(['BIGBOSS', 'ADMIN', 'MODO']);
export const requireAnalyst = requireRole(['BIGBOSS', 'ADMIN', 'ANALYST']);

export async function requireEmailVerification(request: FastifyRequest, reply: FastifyReply) {
  console.log('[GATEWAY] Email verification - to be implemented');
}

export async function requireActiveAccount(request: FastifyRequest, reply: FastifyReply) {
  console.log('[GATEWAY] Account status verification - to be implemented');
}
