import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { InitService } from '../services/init.service';
import { logError, logWarn } from '../utils/logger';

// Schémas de validation
const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(6)
}).refine(data => data.username || data.email, {
  message: "Either username or email must be provided"
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  phoneNumber: z.string().optional()
});

export async function authRoutes(fastify: FastifyInstance) {
  // Route de connexion
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Recherche de l'utilisateur par email ou username
      const user = await fastify.prisma.user.findFirst({
        where: {
          OR: [
            { email: body.email },
            { username: body.username }
          ]
        }
      });

      if (!user) {
        return reply.status(401).send({
          success: false,
          message: 'Identifiant ou mot de passe incorrect'
        });
      }

      // ============================================================================
      // TODO: DÉVELOPPEMENT UNIQUEMENT - CONNEXION SIMPLIFIÉE POUR LES TESTS
      // WARNING: Cette logique doit être SUPPRIMÉE en production !
      // ============================================================================
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // En développement : permet la connexion avec le mot de passe standard "password123"
      // ou avec le vrai mot de passe hashé
      let isPasswordValid = false;
      
      if (isDevelopment) {
        // TODO: Enlever cette logique en production !
        // WARNING: Connexion simplifiée pour utilisateurs de test
        const standardPassword = 'password123';
        const isStandardPassword = body.password === standardPassword;
        const isRealPassword = await bcrypt.compare(body.password, user.password);
        
        isPasswordValid = isStandardPassword || isRealPassword;
        
        if (isStandardPassword) {
          fastify.log.warn(`⚠️  DÉVELOPPEMENT: Connexion simplifiée utilisée pour ${user.email || user.username}`);
        }
      } else {
        // Production : vérification normale du mot de passe
        isPasswordValid = await bcrypt.compare(body.password, user.password);
      }

      if (!isPasswordValid) {
        return reply.status(401).send({
          success: false,
          message: 'Identifiant ou mot de passe incorrect'
        });
      }

      // Mise à jour du statut en ligne
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          isOnline: true,
          lastActiveAt: new Date()
        }
      });

      // Génération du token JWT
      const token = fastify.jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          username: user.username
        },
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );

      // Retour de la réponse sans le mot de passe - format attendu par le frontend
      const { password, ...userWithoutPassword } = user;
      
      return reply.send({
        success: true,
        user: userWithoutPassword,
        access_token: token
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Login error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Route d'inscription
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);

      // Vérification si l'utilisateur existe déjà
      const existingUser = await fastify.prisma.user.findFirst({
        where: {
          OR: [
            { email: body.email },
            { username: body.username },
            { phoneNumber: body.phoneNumber }
          ]
        }
      });

      if (existingUser) {
        let message = 'Un utilisateur existe déjà avec ';
        if (existingUser.email === body.email) message += 'cet email';
        else if (existingUser.username === body.username) message += 'ce nom d\'utilisateur';
        else message += 'ce numéro de téléphone';

        return reply.status(409).send({
          success: false,
          message
        });
      }

      // Hachage du mot de passe
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash(body.password, saltRounds);

      // Création de l'utilisateur
      const newUser = await fastify.prisma.user.create({
        data: {
          username: body.username,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          password: hashedPassword,
          phoneNumber: body.phoneNumber,
          displayName: `${body.firstName} ${body.lastName}`,
          isOnline: true,
          lastActiveAt: new Date()
        }
      });

      // Génération du token JWT
      const token = fastify.jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username
        },
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );

      // Auto-ajout à la conversation globale "Meeshy"
      try {
        await InitService.addUserToGlobalConversation(newUser.id);
      } catch (error) {
        logWarn(fastify.log, `Échec de l'ajout de l'utilisateur ${newUser.id} à la conversation globale:`, error);
        // Ne pas bloquer l'inscription si l'ajout à la conversation échoue
      }

      // Retour de la réponse sans le mot de passe
      const { password, ...userWithoutPassword } = newUser;

      return reply.status(201).send({
        success: true,
        data: {
          user: userWithoutPassword,
          token
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Register error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Route de déconnexion
  fastify.post('/logout', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;

      // Mise à jour du statut hors ligne
      await fastify.prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: false,
          lastSeen: new Date()
        }
      });

      return reply.send({
        success: true,
        message: 'Déconnexion réussie'
      });

    } catch (error) {
      logError(fastify.log, 'Logout error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Route de vérification du token
  fastify.get('/verify', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          displayName: true,
          avatar: true,
          isOnline: true,
          systemLanguage: true,
          regionalLanguage: true,
          autoTranslateEnabled: true
        }
      });

      if (!user) {
        return reply.status(401).send({
          success: false,
          message: 'Token invalide'
        });
      }

      return reply.send({
        success: true,
        data: { user }
      });

    } catch (error) {
      logError(fastify.log, 'Verify token error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Route de vérification du profil utilisateur (alias de /verify pour compatibilité frontend)
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          displayName: true,
          avatar: true,
          isOnline: true,
          systemLanguage: true,
          regionalLanguage: true,
          autoTranslateEnabled: true,
          role: true,
          isActive: true
        }
      });

      if (!user) {
        return reply.status(401).send({
          success: false,
          message: 'Token invalide'
        });
      }

      // Format attendu par le frontend (directement l'utilisateur, pas dans un objet data)
      return reply.send(user);

    } catch (error) {
      logError(fastify.log, 'Get user profile error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
}
