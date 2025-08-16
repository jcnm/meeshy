import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';

// Schémas de validation
const createLinkSchema = z.object({
  conversationId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  maxConcurrentUsers: z.number().int().positive().optional(),
  maxUniqueSessions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  allowAnonymousMessages: z.boolean().optional(),
  allowAnonymousFiles: z.boolean().optional(),
  allowAnonymousImages: z.boolean().optional(),
  allowViewHistory: z.boolean().optional(),
  requireNickname: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  allowedCountries: z.array(z.string()).optional(),
  allowedLanguages: z.array(z.string()).optional(),
  allowedIpRanges: z.array(z.string()).optional()
});

const updateLinkSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  maxConcurrentUsers: z.number().int().positive().nullable().optional(),
  maxUniqueSessions: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  allowAnonymousMessages: z.boolean().optional(),
  allowAnonymousFiles: z.boolean().optional(),
  allowAnonymousImages: z.boolean().optional(),
  allowViewHistory: z.boolean().optional(),
  requireNickname: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  allowedCountries: z.array(z.string()).optional(),
  allowedLanguages: z.array(z.string()).optional(),
  allowedIpRanges: z.array(z.string()).optional()
});

export async function linksRoutes(fastify: FastifyInstance) {
  // Créer un lien (avec ou sans conversation)
  fastify.post('/links', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createLinkSchema.parse(request.body);
      const { userId } = request.user as any;

      let conversationId = body.conversationId;

      if (conversationId) {
        // Vérifier que l'utilisateur est admin/modo de la conversation
        const member = await fastify.prisma.conversationMember.findFirst({
          where: { conversationId, userId, isActive: true }
        });

        if (!member) {
          return reply.status(403).send({ success: false, message: "Vous n'êtes pas membre de cette conversation" });
        }

        if (member.role !== 'admin' && member.role !== 'moderator') {
          return reply.status(403).send({ success: false, message: 'Seuls les administrateurs et modérateurs peuvent créer des liens' });
        }
      } else {
        // Créer la conversation de type shared
        const conversation = await fastify.prisma.conversation.create({
          data: {
            type: 'shared',
            title: body.name || 'Conversation partagée',
            description: body.description,
            members: { create: [{ userId, role: 'admin' }] }
          }
        });
        conversationId = conversation.id;
      }

      // Générer un token unique
      const linkId = `link_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      await fastify.prisma.conversationShareLink.create({
        data: {
          linkId,
          conversationId: conversationId!,
          createdBy: userId,
          name: body.name,
          description: body.description,
          maxUses: body.maxUses ?? undefined,
          maxConcurrentUsers: body.maxConcurrentUsers ?? undefined,
          maxUniqueSessions: body.maxUniqueSessions ?? undefined,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          allowAnonymousMessages: body.allowAnonymousMessages ?? true,
          allowAnonymousFiles: body.allowAnonymousFiles ?? false,
          allowAnonymousImages: body.allowAnonymousImages ?? true,
          allowViewHistory: body.allowViewHistory ?? true,
          requireNickname: body.requireNickname ?? true,
          requireEmail: body.requireEmail ?? false,
          allowedCountries: body.allowedCountries ?? [],
          allowedLanguages: body.allowedLanguages ?? [],
          allowedIpRanges: body.allowedIpRanges ?? []
        }
      });

      return reply.status(201).send({
        link: { token: linkId, expiresAt: body.expiresAt || null },
        conversationId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Données invalides', errors: error.errors });
      }
      logError(fastify.log, 'Create link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Récupérer les informations d'un lien
  fastify.get('/links/:linkId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };

      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true,
              members: {
                select: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
                take: 5
              }
            }
          },
          creator: { select: { id: true, username: true, firstName: true, lastName: true, displayName: true, avatar: true } }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ success: false, message: 'Lien non trouvé' });
      }

      if (!shareLink.isActive) {
        return reply.status(410).send({ success: false, message: "Ce lien n'est plus actif" });
      }
      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        return reply.status(410).send({ success: false, message: 'Ce lien a expiré' });
      }
      if (shareLink.maxUses && shareLink.currentUses >= shareLink.maxUses) {
        return reply.status(410).send({ success: false, message: "Ce lien a atteint sa limite d'utilisation" });
      }

      return reply.send({ success: true, data: shareLink });
    } catch (error) {
      logError(fastify.log, 'Get link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Liste des liens créés par l'utilisateur
  fastify.get('/links', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;
      const links = await fastify.prisma.conversationShareLink.findMany({
        where: { createdBy: userId },
        include: { conversation: { select: { id: true, type: true, title: true, description: true } } },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ success: true, data: links });
    } catch (error) {
      logError(fastify.log, 'List links error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Mettre à jour un lien (propriétés supportées)
  fastify.patch('/links/:linkId', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;
      const body = updateLinkSchema.parse(request.body);

      const link = await fastify.prisma.conversationShareLink.findUnique({ where: { linkId } });
      if (!link) return reply.status(404).send({ success: false, message: 'Lien non trouvé' });

      // Autorisé pour créateur ou admin conversation
      if (link.createdBy !== userId) {
        const member = await fastify.prisma.conversationMember.findFirst({
          where: { conversationId: link.conversationId, userId, isActive: true, role: 'admin' }
        });
        if (!member) return reply.status(403).send({ success: false, message: 'Accès non autorisé' });
      }

      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.maxUses !== undefined) updateData.maxUses = body.maxUses === null ? null : body.maxUses;
      if (body.maxConcurrentUsers !== undefined) updateData.maxConcurrentUsers = body.maxConcurrentUsers === null ? null : body.maxConcurrentUsers;
      if (body.maxUniqueSessions !== undefined) updateData.maxUniqueSessions = body.maxUniqueSessions === null ? null : body.maxUniqueSessions;
      if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.allowAnonymousMessages !== undefined) updateData.allowAnonymousMessages = body.allowAnonymousMessages;
      if (body.allowAnonymousFiles !== undefined) updateData.allowAnonymousFiles = body.allowAnonymousFiles;
      if (body.allowAnonymousImages !== undefined) updateData.allowAnonymousImages = body.allowAnonymousImages;
      if (body.allowViewHistory !== undefined) updateData.allowViewHistory = body.allowViewHistory;
      if (body.requireNickname !== undefined) updateData.requireNickname = body.requireNickname;
      if (body.requireEmail !== undefined) updateData.requireEmail = body.requireEmail;
      if (body.allowedCountries !== undefined) updateData.allowedCountries = body.allowedCountries;
      if (body.allowedLanguages !== undefined) updateData.allowedLanguages = body.allowedLanguages;
      if (body.allowedIpRanges !== undefined) updateData.allowedIpRanges = body.allowedIpRanges;

      const updated = await fastify.prisma.conversationShareLink.update({ where: { linkId }, data: updateData });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Données invalides', errors: error.errors });
      }
      logError(fastify.log, 'Update link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Désactiver un lien
  fastify.patch('/links/:linkId/deactivate', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;

      const link = await fastify.prisma.conversationShareLink.findUnique({ where: { linkId } });
      if (!link) return reply.status(404).send({ success: false, message: 'Lien non trouvé' });

      if (link.createdBy !== userId) {
        const member = await fastify.prisma.conversationMember.findFirst({
          where: { conversationId: link.conversationId, userId, isActive: true, role: 'admin' }
        });
        if (!member) return reply.status(403).send({ success: false, message: 'Accès non autorisé' });
      }

      await fastify.prisma.conversationShareLink.update({ where: { linkId }, data: { isActive: false } });
      return reply.send({ success: true, message: 'Lien désactivé' });
    } catch (error) {
      logError(fastify.log, 'Deactivate link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Supprimer un lien
  fastify.delete('/links/:linkId', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;

      const link = await fastify.prisma.conversationShareLink.findUnique({ where: { linkId } });
      if (!link) return reply.status(404).send({ success: false, message: 'Lien non trouvé' });

      if (link.createdBy !== userId) {
        const member = await fastify.prisma.conversationMember.findFirst({
          where: { conversationId: link.conversationId, userId, isActive: true, role: 'admin' }
        });
        if (!member) return reply.status(403).send({ success: false, message: 'Accès non autorisé' });
      }

      await fastify.prisma.conversationShareLink.delete({ where: { linkId } });
      return reply.send({ success: true, message: 'Lien supprimé' });
    } catch (error) {
      logError(fastify.log, 'Delete link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });
}


