/**
 * Routes API pour la gestion des attachements
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AttachmentService } from '../services/AttachmentService';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

export async function attachmentRoutes(fastify: FastifyInstance) {
  const attachmentService = new AttachmentService((fastify as any).prisma);

  /**
   * POST /attachments/upload
   * Upload un ou plusieurs fichiers
   */
  fastify.post(
    '/attachments/upload',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Récupérer le contexte d'authentification
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const userId = authContext.userId;
        const isAnonymous = authContext.isAnonymous;

        // Récupérer les fichiers uploadés
        const parts = request.parts();
        const files: Array<{
          buffer: Buffer;
          filename: string;
          mimeType: string;
          size: number;
        }> = [];

        for await (const part of parts) {
          if (part.type === 'file') {
            const buffer = await part.toBuffer();
            files.push({
              buffer,
              filename: part.filename,
              mimeType: part.mimetype,
              size: buffer.length,
            });
          }
        }

        if (files.length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'No files provided',
          });
        }

        // Upload tous les fichiers
        const results = await attachmentService.uploadMultiple(
          files,
          userId,
          isAnonymous
        );

        return reply.send({
          success: true,
          attachments: results,
        });
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error uploading files:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Error uploading files',
        });
      }
    }
  );

  /**
   * POST /attachments/upload-text
   * Crée un fichier texte à partir du contenu
   */
  fastify.post(
    '/attachments/upload-text',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string' },
            messageId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const { content, messageId } = request.body as {
          content: string;
          messageId?: string;
        };

        const userId = authContext.userId;
        const isAnonymous = authContext.isAnonymous;

        const result = await attachmentService.createTextAttachment(
          content,
          userId,
          isAnonymous,
          messageId
        );

        return reply.send({
          success: true,
          attachment: result,
        });
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error creating text attachment:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Error creating text attachment',
        });
      }
    }
  );

  /**
   * GET /attachments/:attachmentId
   * Stream le fichier original
   */
  fastify.get(
    '/attachments/:attachmentId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { attachmentId } = request.params as { attachmentId: string };

        const attachment = await attachmentService.getAttachment(attachmentId);
        if (!attachment) {
          return reply.status(404).send({
            success: false,
            error: 'Attachment not found',
          });
        }

        const filePath = await attachmentService.getFilePath(attachmentId);
        if (!filePath) {
          return reply.status(404).send({
            success: false,
            error: 'File not found',
          });
        }

        // Vérifier que le fichier existe
        try {
          await stat(filePath);
        } catch {
          return reply.status(404).send({
            success: false,
            error: 'File not found on disk',
          });
        }

        // Définir les headers appropriés
        reply.header('Content-Type', attachment.mimeType);
        reply.header('Content-Disposition', `inline; filename="${attachment.originalName}"`);

        // Stream le fichier
        const stream = createReadStream(filePath);
        return reply.send(stream);
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error serving file:', error);
        return reply.status(500).send({
          success: false,
          error: 'Error serving file',
        });
      }
    }
  );

  /**
   * GET /attachments/:attachmentId/thumbnail
   * Stream la miniature (images uniquement)
   */
  fastify.get(
    '/attachments/:attachmentId/thumbnail',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { attachmentId } = request.params as { attachmentId: string };

        const thumbnailPath = await attachmentService.getThumbnailPath(attachmentId);
        if (!thumbnailPath) {
          return reply.status(404).send({
            success: false,
            error: 'Thumbnail not found',
          });
        }

        // Vérifier que le fichier existe
        try {
          await stat(thumbnailPath);
        } catch {
          return reply.status(404).send({
            success: false,
            error: 'Thumbnail not found on disk',
          });
        }

        // Définir les headers appropriés
        reply.header('Content-Type', 'image/jpeg');
        reply.header('Content-Disposition', 'inline');

        // Stream le fichier
        const stream = createReadStream(thumbnailPath);
        return reply.send(stream);
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error serving thumbnail:', error);
        return reply.status(500).send({
          success: false,
          error: 'Error serving thumbnail',
        });
      }
    }
  );

  /**
   * GET /attachments/file/:filePath
   * Stream un fichier via son chemin (utilisé pour les URLs générées)
   */
  fastify.get(
    '/attachments/file/*',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Extraire le chemin du fichier
        const fullPath = (request.params as any)['*'];
        const decodedPath = decodeURIComponent(fullPath);

        // Construire le chemin complet
        const uploadBasePath = process.env.UPLOAD_PATH || 'uploads/attachments';
        const filePath = require('path').join(uploadBasePath, decodedPath);

        // Vérifier que le fichier existe
        try {
          await stat(filePath);
        } catch {
          return reply.status(404).send({
            success: false,
            error: 'File not found',
          });
        }

        // Stream le fichier
        const stream = createReadStream(filePath);
        return reply.send(stream);
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error serving file by path:', error);
        return reply.status(500).send({
          success: false,
          error: 'Error serving file',
        });
      }
    }
  );

  /**
   * DELETE /attachments/:attachmentId
   * Supprime un attachment
   */
  fastify.delete(
    '/attachments/:attachmentId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const { attachmentId } = request.params as { attachmentId: string };

        // Vérifier que l'attachment existe et appartient à l'utilisateur
        const attachment = await attachmentService.getAttachment(attachmentId);
        if (!attachment) {
          return reply.status(404).send({
            success: false,
            error: 'Attachment not found',
          });
        }

        // Vérifier les permissions
        const userId = authContext.userId;
        const isAdmin = authContext.registeredUser?.role === 'ADMIN' ||
                       authContext.registeredUser?.role === 'BIGBOSS';

        if (attachment.uploadedBy !== userId && !isAdmin) {
          return reply.status(403).send({
            success: false,
            error: 'Insufficient permissions',
          });
        }

        // Supprimer l'attachment
        await attachmentService.deleteAttachment(attachmentId);

        return reply.send({
          success: true,
          message: 'Attachment deleted successfully',
        });
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error deleting attachment:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Error deleting attachment',
        });
      }
    }
  );

  /**
   * GET /conversations/:conversationId/attachments
   * Récupère les attachments d'une conversation
   */
  fastify.get(
    '/conversations/:conversationId/attachments',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['image', 'document', 'audio', 'video', 'text'] },
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authContext = (request as any).authContext;
        if (!authContext || !authContext.isAuthenticated) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const { conversationId } = request.params as { conversationId: string };
        const query = request.query as {
          type?: 'image' | 'document' | 'audio' | 'video' | 'text';
          limit?: number;
          offset?: number;
        };

        // TODO: Vérifier que l'utilisateur a accès à cette conversation

        const attachments = await attachmentService.getConversationAttachments(
          conversationId,
          {
            type: query.type,
            limit: query.limit,
            offset: query.offset,
          }
        );

        return reply.send({
          success: true,
          attachments,
        });
      } catch (error: any) {
        console.error('[AttachmentRoutes] Error fetching conversation attachments:', error);
        return reply.status(500).send({
          success: false,
          error: 'Error fetching attachments',
        });
      }
    }
  );
}

