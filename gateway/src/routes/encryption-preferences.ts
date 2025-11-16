/**
 * Routes API pour les préférences de chiffrement MLS
 * Gère les préférences utilisateur et le statut de chiffrement des conversations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EncryptionPreferencesService } from '../services/EncryptionPreferencesService';
import { logError } from '../utils/logger';
import type {
  UpdateEncryptionPreferencesRequest,
  EncryptionMode,
} from '@meeshy/shared/types/mls';

// Types pour les requêtes Fastify
interface UpdatePreferencesBody {
  allowServerSideTranslation?: boolean;
  defaultEncryptionMode?: EncryptionMode;
}

interface ConversationParams {
  conversationId: string;
}

export default async function encryptionPreferencesRoutes(fastify: FastifyInstance) {
  const service = new EncryptionPreferencesService(fastify.prisma);

  /**
   * PUT /api/users/me/encryption-preferences
   * Met à jour les préférences de chiffrement de l'utilisateur connecté
   */
  fastify.put<{ Body: UpdatePreferencesBody }>(
    '/users/me/encryption-preferences',
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            allowServerSideTranslation: {
              type: 'boolean',
              description: 'Autoriser le serveur à déchiffrer temporairement pour traduction (mode hybrid)',
            },
            defaultEncryptionMode: {
              type: 'string',
              enum: ['none', 'hybrid', 'e2e_only'],
              description: 'Mode de chiffrement par défaut pour les nouvelles conversations',
            },
          },
          minProperties: 1, // Au moins un champ doit être fourni
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  allowServerSideTranslationAt: {
                    type: ['string', 'null'],
                    format: 'date-time',
                  },
                  defaultEncryptionMode: {
                    type: 'string',
                    enum: ['none', 'hybrid', 'e2e_only'],
                  },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UpdatePreferencesBody }>, reply: FastifyReply) => {
      try {
        // 1. Vérification de l'authentification
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
          return reply.status(401).send({
            success: false,
            error: 'Authentification requise. Seuls les utilisateurs enregistrés peuvent modifier leurs préférences de chiffrement.',
          });
        }

        const userId = authContext.userId;

        // 2. Validation du body (Fastify schema déjà fait la validation de base)
        const { allowServerSideTranslation, defaultEncryptionMode } = request.body;

        if (allowServerSideTranslation === undefined && defaultEncryptionMode === undefined) {
          return reply.status(400).send({
            success: false,
            error: 'Au moins un champ (allowServerSideTranslation ou defaultEncryptionMode) doit être fourni',
          });
        }

        // 3. Construire la requête pour le service
        const serviceRequest: UpdateEncryptionPreferencesRequest = {
          userId,
          allowServerSideTranslation,
          defaultEncryptionMode,
        };

        // 4. Appeler le service
        const result = await service.updateUserEncryptionPreferences(serviceRequest);

        // 5. Gérer la réponse
        if (!result.success) {
          const statusCode = result.statusCode || 500;
          return reply.status(statusCode).send({
            success: false,
            error: result.error,
            errors: result.errors,
          });
        }

        // 6. Succès
        console.log(`[EncryptionPreferencesRoutes] ✅ Préférences mises à jour pour utilisateur ${userId}`);
        return reply.status(200).send({
          success: true,
          data: result.data,
        });
      } catch (error) {
        logError(fastify.log, 'Error updating encryption preferences:', error);
        return reply.status(500).send({
          success: false,
          error: 'Erreur interne lors de la mise à jour des préférences de chiffrement',
        });
      }
    }
  );

  /**
   * GET /api/users/me/encryption-preferences
   * Récupère les préférences de chiffrement de l'utilisateur connecté
   */
  fastify.get(
    '/users/me/encryption-preferences',
    {
      preValidation: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  allowServerSideTranslationAt: {
                    type: ['string', 'null'],
                    format: 'date-time',
                  },
                  defaultEncryptionMode: {
                    type: 'string',
                    enum: ['none', 'hybrid', 'e2e_only'],
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // 1. Vérification de l'authentification
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
          return reply.status(401).send({
            success: false,
            error: 'Authentification requise',
          });
        }

        const userId = authContext.userId;

        // 2. Récupérer les préférences depuis la DB
        const user = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            allowServerSideTranslationAt: true,
            defaultEncryptionMode: true,
          },
        });

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: 'Utilisateur non trouvé',
          });
        }

        // 3. Retourner les préférences
        return reply.status(200).send({
          success: true,
          data: {
            userId: user.id,
            allowServerSideTranslationAt: user.allowServerSideTranslationAt,
            defaultEncryptionMode: user.defaultEncryptionMode,
          },
        });
      } catch (error) {
        logError(fastify.log, 'Error fetching encryption preferences:', error);
        return reply.status(500).send({
          success: false,
          error: 'Erreur interne lors de la récupération des préférences',
        });
      }
    }
  );

  /**
   * GET /api/conversations/:conversationId/encryption-status
   * Récupère le statut de chiffrement d'une conversation
   */
  fastify.get<{ Params: ConversationParams }>(
    '/conversations/:conversationId/encryption-status',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  conversationId: { type: 'string' },
                  encryptionMode: {
                    type: 'string',
                    enum: ['none', 'hybrid', 'e2e_only'],
                  },
                  isEncrypted: { type: 'boolean' },
                  hasServerKey: { type: 'boolean' },
                  serverKeyCreatedAt: { type: 'string', format: 'date-time' },
                  serverKeyExpiresAt: { type: 'string', format: 'date-time' },
                  serverKeyNeedsRotation: { type: 'boolean' },
                  mlsGroupId: { type: 'string' },
                  mlsEpoch: { type: 'number' },
                  mlsCipherSuite: { type: 'string' },
                  mlsLastUpdated: { type: 'string', format: 'date-time' },
                  membersAllowingServerTranslation: { type: 'number' },
                  totalMembers: { type: 'number' },
                  allMembersAllowServerTranslation: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ConversationParams }>,
      reply: FastifyReply
    ) => {
      try {
        // 1. Vérification de l'authentification
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
          return reply.status(401).send({
            success: false,
            error: 'Authentification requise',
          });
        }

        const userId = authContext.userId;
        const { conversationId } = request.params;

        // 2. Validation du conversationId (Fastify schema déjà fait la validation de base)
        if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
          return reply.status(400).send({
            success: false,
            error: 'ID de conversation invalide (format ObjectId MongoDB attendu)',
          });
        }

        // 3. Appeler le service
        const result = await service.getConversationEncryptionStatus(conversationId, userId);

        // 4. Gérer la réponse
        if (!result.success) {
          const statusCode = result.statusCode || 500;
          return reply.status(statusCode).send({
            success: false,
            error: result.error,
          });
        }

        // 5. Succès
        console.log(`[EncryptionPreferencesRoutes] ✅ Statut chiffrement récupéré pour conversation ${conversationId}`);
        return reply.status(200).send({
          success: true,
          data: result.data,
        });
      } catch (error) {
        logError(fastify.log, 'Error fetching conversation encryption status:', error);
        return reply.status(500).send({
          success: false,
          error: 'Erreur interne lors de la récupération du statut de chiffrement',
        });
      }
    }
  );
}
