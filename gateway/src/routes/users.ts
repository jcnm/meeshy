import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UpdateUserRequest } from '../../shared/types';
import { logError } from '../utils/logger';

// Schéma de validation pour la mise à jour utilisateur
const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  systemLanguage: z.string().min(2).max(5).optional(),
  regionalLanguage: z.string().min(2).max(5).optional(),
  customDestinationLanguage: z.string().min(2).max(5).optional(),
  autoTranslateEnabled: z.boolean().optional(),
  translateToSystemLanguage: z.boolean().optional(),
  translateToRegionalLanguage: z.boolean().optional(),
  useCustomDestination: z.boolean().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Route pour obtenir les informations utilisateur
  fastify.get('/users/me', async (request, reply) => {
    reply.send({ message: 'User routes - to be implemented' });
  });

  // Route pour mettre à jour le profil utilisateur connecté
  fastify.patch('/users/me', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;
      const body = updateUserSchema.parse(request.body);
      
      // Construire l'objet de mise à jour avec uniquement les champs fournis
      const updateData: any = {};
      
      // Champs de profil de base
      if (body.firstName !== undefined) updateData.firstName = body.firstName;
      if (body.lastName !== undefined) updateData.lastName = body.lastName;
      if (body.displayName !== undefined) updateData.displayName = body.displayName;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
      
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

      // Vérifier si le numéro de téléphone est unique (si modifié)
      if (body.phoneNumber) {
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
}
