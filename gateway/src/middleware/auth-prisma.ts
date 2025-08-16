/**
 * Middleware d'authentification avec Prisma pour Fastify
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaAuthService } from '../services/prisma-auth.service';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  jwtUser?: AuthenticatedUser;
}

/**
 * Créer un middleware d'authentification avec accès au service Prisma
 */
export function createAuthMiddleware(authService: PrismaAuthService) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header');
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer '
      
      // Vérifier le token avec le service Prisma
      const decoded = authService.verifyToken(token);
      
      if (!decoded) {
        throw new Error('Invalid token');
      }
      
      // Récupérer l'utilisateur depuis la base de données
      const user = await authService.getUserById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      
      // Attacher les informations utilisateur à la requête
      (request as any).user = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
    } catch (error) {
      console.error('[AUTH] Authentication failed:', error);
      reply.status(401).send({
        success: false,
        error: 'Token d\'authentification invalide',
        code: 'UNAUTHORIZED'
      });
    }
  };
}

/**
 * Middleware d'authentification basique (pour compatibilité)
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer '
    
    // Note: Ce middleware basique nécessite que l'authService soit disponible
    // Il est recommandé d'utiliser createAuthMiddleware à la place
    console.warn('[AUTH] Using basic authenticate middleware - consider using createAuthMiddleware');
    
    throw new Error('Basic authenticate middleware requires authService - use createAuthMiddleware');
    
  } catch (error) {
    console.error('[AUTH] Authentication failed:', error);
    reply.status(401).send({
      success: false,
      error: 'Token d\'authentification invalide',
      code: 'UNAUTHORIZED'
    });
  }
}
