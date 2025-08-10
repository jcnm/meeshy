/**
 * Route pour gérer les préférences utilisateur dans le Gateway
 * Utilise Prisma pour les opérations CRUD sur UserPreference
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logError } from '../utils/logger';

interface UserPreferenceBody {
  key: string;
  value: string;
}

interface UserPreferenceParams {
  key?: string;
}

export default async function userPreferencesRoutes(fastify: FastifyInstance) {
  // Récupérer toutes les préférences de l'utilisateur connecté
  fastify.get('/preferences', {
    preValidation: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      const preferences = await fastify.prisma.userPreference.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

      reply.send({
        success: true,
        data: preferences
      });

    } catch (error) {
      logError(fastify.log, 'Error fetching user preferences:', error);
      reply.code(500).send({
        success: false,
        message: 'Erreur lors de la récupération des préférences'
      });
    }
  });

  // Récupérer une préférence spécifique
  fastify.get<{ Params: UserPreferenceParams }>('/preferences/:key', {
    preValidation: [fastify.authenticate]
  }, async (request: FastifyRequest<{ Params: UserPreferenceParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { key } = request.params;

      if (!key) {
        return reply.code(400).send({
          success: false,
          message: 'Clé de préférence requise'
        });
      }

      const preference = await fastify.prisma.userPreference.findUnique({
        where: {
          userId_key: {
            userId,
            key
          }
        }
      });

      reply.send({
        success: true,
        data: preference
      });

    } catch (error) {
      logError(fastify.log, 'Error fetching user preference:', error);
      reply.code(500).send({
        success: false,
        message: 'Erreur lors de la récupération de la préférence'
      });
    }
  });

  // Créer ou mettre à jour une préférence
  fastify.post<{ Body: UserPreferenceBody }>('/preferences', {
    preValidation: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string' },
          value: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: UserPreferenceBody }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { key, value } = request.body;

      // Validation spécifique pour certaines préférences
      if (key === 'font-family') {
        const validFonts = [
          'inter', 'nunito', 'poppins', 'open-sans', 'lato', 
          'comic-neue', 'lexend', 'roboto', 'geist-sans'
        ];
        
        if (!validFonts.includes(value)) {
          return reply.code(400).send({
            success: false,
            message: 'Police non valide'
          });
        }
      }

      // Utiliser upsert pour créer ou mettre à jour
      const preference = await fastify.prisma.userPreference.upsert({
        where: {
          userId_key: {
            userId,
            key
          }
        },
        update: {
          value,
          updatedAt: new Date()
        },
        create: {
          userId,
          key,
          value
        }
      });

      reply.send({
        success: true,
        data: preference
      });

    } catch (error) {
      logError(fastify.log, 'Error saving user preference:', error);
      reply.code(500).send({
        success: false,
        message: 'Erreur lors de la sauvegarde de la préférence'
      });
    }
  });

  // Supprimer une préférence
  fastify.delete<{ Params: UserPreferenceParams }>('/preferences/:key', {
    preValidation: [fastify.authenticate]
  }, async (request: FastifyRequest<{ Params: UserPreferenceParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { key } = request.params;

      if (!key) {
        return reply.code(400).send({
          success: false,
          message: 'Clé de préférence requise'
        });
      }

      await fastify.prisma.userPreference.delete({
        where: {
          userId_key: {
            userId,
            key
          }
        }
      });

      reply.send({
        success: true,
        message: 'Préférence supprimée avec succès'
      });

    } catch (error) {
      logError(fastify.log, 'Error deleting user preference:', error);
      reply.code(500).send({
        success: false,
        message: 'Erreur lors de la suppression de la préférence'
      });
    }
  });

  // Réinitialiser toutes les préférences
  fastify.delete('/preferences', {
    preValidation: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      await fastify.prisma.userPreference.deleteMany({
        where: { userId }
      });

      reply.send({
        success: true,
        message: 'Toutes les préférences ont été réinitialisées'
      });

    } catch (error) {
      logError(fastify.log, 'Error resetting user preferences:', error);
      reply.code(500).send({
        success: false,
        message: 'Erreur lors de la réinitialisation des préférences'
      });
    }
  });
}
