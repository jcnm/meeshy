import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaAuthService, LoginCredentials, RegisterData } from '../services/prisma-auth.service';
import { SocketIOUser } from '@shared/types';

export async function authRoutes(fastify: FastifyInstance) {
  // Créer une instance du service d'authentification Prisma
  const authService = new PrismaAuthService(
    (fastify as any).prisma,
    process.env.JWT_SECRET || 'default-jwt-secret'
  );

  // Route de connexion
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, password } = request.body as LoginCredentials;
      
      // Authentifier l'utilisateur avec Prisma
      const user = await authService.authenticate({ username, password });
      
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: 'Identifiants invalides'
        });
      }
      
      // Générer le token
      const token = authService.generateToken(user);
      
      // Retourner les informations utilisateur et le token
      reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            avatar: user.avatar,
            role: user.role,
            systemLanguage: user.systemLanguage,
            regionalLanguage: user.regionalLanguage,
            customDestinationLanguage: user.customDestinationLanguage,
            autoTranslateEnabled: user.autoTranslateEnabled,
            translateToSystemLanguage: user.translateToSystemLanguage,
            translateToRegionalLanguage: user.translateToRegionalLanguage,
            useCustomDestination: user.useCustomDestination,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            lastActiveAt: user.lastActiveAt,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            permissions: user.permissions
          },
          token,
          expiresIn: 24 * 60 * 60 // 24 heures en secondes
        }
      });
      
    } catch (error) {
      console.error('[GATEWAY] Error in login:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la connexion'
      });
    }
  });

  // Route d'inscription
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password', 'firstName', 'lastName', 'email'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phoneNumber: { type: 'string' },
          systemLanguage: { type: 'string' },
          regionalLanguage: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const registerData = request.body as RegisterData;
      
      // Créer l'utilisateur avec Prisma
      const user = await authService.register(registerData);
      
      if (!user) {
        return reply.status(400).send({
          success: false,
          error: 'Erreur lors de la création du compte'
        });
      }
      
      // Générer le token
      const token = authService.generateToken(user);
      
      reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            role: user.role,
            systemLanguage: user.systemLanguage,
            regionalLanguage: user.regionalLanguage,
            permissions: user.permissions
          },
          token,
          expiresIn: 24 * 60 * 60
        }
      });
      
    } catch (error) {
      console.error('[GATEWAY] Error in register:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la création du compte'
      });
    }
  });

  // Route pour récupérer les informations de l'utilisateur connecté
  fastify.get('/me', {
    preValidation: [(fastify as any).authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.userId;
      
      // Récupérer l'utilisateur avec Prisma
      const user = await authService.getUserById(userId);
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }
      
      // Récupérer les permissions
      const permissions = authService.getUserPermissions(user);
      
      reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            avatar: user.avatar,
            role: user.role,
            systemLanguage: user.systemLanguage,
            regionalLanguage: user.regionalLanguage,
            customDestinationLanguage: user.customDestinationLanguage,
            autoTranslateEnabled: user.autoTranslateEnabled,
            translateToSystemLanguage: user.translateToSystemLanguage,
            translateToRegionalLanguage: user.translateToRegionalLanguage,
            useCustomDestination: user.useCustomDestination,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            lastActiveAt: user.lastActiveAt,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            permissions
          }
        }
      });
      
    } catch (error) {
      console.error('[GATEWAY] Error in /auth/me:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération du profil'
      });
    }
  });

  // Route pour rafraîchir un token
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.body as { token: string };
      
      // Vérifier le token
      const decoded = authService.verifyToken(token);
      
      if (!decoded) {
        return reply.status(401).send({
          success: false,
          error: 'Token invalide ou expiré'
        });
      }
      
      // Récupérer l'utilisateur
      const user = await authService.getUserById(decoded.userId);
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }
      
      // Générer un nouveau token
      const newToken = authService.generateToken(user);
      
      reply.send({
        success: true,
        data: {
          token: newToken,
          expiresIn: 24 * 60 * 60 // 24 heures en secondes
        }
      });
      
    } catch (error) {
      console.error('[GATEWAY] Error in /auth/refresh:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors du rafraîchissement du token'
      });
    }
  });

  // Route de déconnexion
  fastify.post('/logout', {
    preValidation: [(fastify as any).authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.userId;
      
      // Mettre à jour le statut en ligne
      await authService.updateOnlineStatus(userId, false);
      
      reply.send({
        success: true,
        message: 'Déconnexion réussie'
      });
      
    } catch (error) {
      console.error('[GATEWAY] Error in logout:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la déconnexion'
      });
    }
  });
}
