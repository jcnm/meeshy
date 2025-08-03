import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Schémas de validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
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
      
      // Recherche de l'utilisateur
      const user = await fastify.prisma.user.findUnique({
        where: { email: body.email }
      });

      if (!user) {
        return reply.status(401).send({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // Vérification du mot de passe
      const isPasswordValid = await bcrypt.compare(body.password, user.password);
      if (!isPasswordValid) {
        return reply.status(401).send({
          success: false,
          message: 'Email ou mot de passe incorrect'
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

      // Retour de la réponse sans le mot de passe
      const { password, ...userWithoutPassword } = user;
      
      return reply.send({
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

      fastify.log.error('Login error:', error);
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

      fastify.log.error('Register error:', error);
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
      fastify.log.error('Logout error:', error);
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
      fastify.log.error('Verify token error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
}
