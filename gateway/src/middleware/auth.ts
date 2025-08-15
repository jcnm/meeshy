/**
 * Middleware d'authentification simplifié pour Fastify
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  username: string;
}

// Extension de Fastify pour ajouter les types d'authentification JWT
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthenticatedUser;
    user: AuthenticatedUser;
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  jwtUser?: AuthenticatedUser;
}

/**
 * Middleware d'authentification basique
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Vérifier le token JWT avec Fastify JWT
    await request.jwtVerify();
    
    // Le payload JWT est maintenant disponible dans request.user
    const { userId, email, username } = request.user as AuthenticatedUser;
    
    if (!userId) {
      throw new Error('Invalid token payload: missing userId');
    }
    
    // Ajouter la propriété 'id' pour la compatibilité
    (request.user as any).id = userId;
    
    // Optionnel: vérifier que l'utilisateur existe toujours en base
    // (pour l'instant on fait confiance au token)
    
  } catch (error) {
    console.error('[GATEWAY] Authentication failed:', error);
    reply.code(401).send({ 
      success: false,
      message: 'Token invalide ou manquant' 
    });
  }
}

/**
 * Middleware de vérification des rôles simplifié
 */
export function requireRole(allowedRoles: string | string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Pour l'instant, on passe la vérification - à implémenter
      console.log('[GATEWAY] Role verification - to be implemented', allowedRoles);
    } catch (error) {
      reply.code(403).send({ error: 'Insufficient permissions' });
    }
  };
}

/**
 * Raccourcis pour les rôles communs
 */
export const requireAdmin = requireRole(['BIGBOSS', 'ADMIN']);
export const requireModerator = requireRole(['BIGBOSS', 'ADMIN', 'MODO']);
export const requireAnalyst = requireRole(['BIGBOSS', 'ADMIN', 'ANALYST']);

/**
 * Middleware de vérification email
 */
export async function requireEmailVerification(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Pour l'instant, on passe la vérification - à implémenter
    console.log('[GATEWAY] Email verification - to be implemented');
  } catch (error) {
    reply.code(403).send({ error: 'Email verification required' });
  }
}

/**
 * Middleware de vérification du statut du compte
 */
export async function requireActiveAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Pour l'instant, on passe la vérification - à implémenter
    console.log('[GATEWAY] Account status verification - to be implemented');
  } catch (error) {
    reply.code(403).send({ error: 'Account is not active' });
  }
}
