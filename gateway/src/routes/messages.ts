import { FastifyInstance, FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';

export async function messageRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Route pour forcer une traduction d'un message 
  fastify.post(
    '/messages/:messageId/translate',
    {
      preHandler: fastify.authenticate,
    },
    async (request: any, reply: FastifyReply) => {
      try {
        const { messageId } = request.params;
        const { targetLanguage } = request.body;
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utilisateur non authentifié'
          });
        }

        // Récupérer le message
        const message = await fastify.prisma.message.findUnique({
          where: { id: messageId },
          include: {
            conversation: {
              include: {
                members: true
              }
            }
          }
        });

        if (!message) {
          return reply.status(404).send({
            success: false,
            error: 'Message non trouvé'
          });
        }

        // Vérifier l'accès
        const hasAccess = message.conversation.members.some((member: any) => member.userId === userId);
        if (!hasAccess) {
          return reply.status(403).send({
            success: false,
            error: 'Accès non autorisé'
          });
        }

        // Traduire via TranslationService
        try {
          const result = await fastify.translationService.translateTextDirectly(
            message.content,
            message.originalLanguage,
            targetLanguage,
            'basic'
          );

          return reply.status(200).send({
            success: true,
            messageId: messageId,
            targetLanguage: targetLanguage,
            translatedContent: result.translatedText,
            cached: false, // translateTextDirectly ne retourne pas l'info de cache
            translationModel: result.modelType
          });

        } catch (translationError) {
          return reply.status(503).send({
            success: false,
            error: 'Service de traduction indisponible'
          });
        }

      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Erreur serveur'
        });
      }
    }
  );
}
