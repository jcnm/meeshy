/**
 * Routes API pour la gestion des attachements
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AttachmentService } from '../services/AttachmentService';
import { createUnifiedAuthMiddleware } from '../middleware/auth';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

export async function attachmentRoutes(fastify: FastifyInstance) {
  const attachmentService = new AttachmentService((fastify as any).prisma);
  
  // Middleware d'authentification optionnel (supporte JWT + Session anonyme)
  const authOptional = createUnifiedAuthMiddleware((fastify as any).prisma, {
    requireAuth: false,
    allowAnonymous: true
  });

  /**
   * POST /attachments/upload
   * Upload un ou plusieurs fichiers (support utilisateurs authentifiés ET anonymes)
   */
  fastify.post(
    '/attachments/upload',
    {
      onRequest: [authOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Récupérer le contexte d'authentification (authentifié OU anonyme)
        const authContext = (request as any).authContext;
        if (!authContext || (!authContext.isAuthenticated && !authContext.isAnonymous)) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const userId = authContext.userId;
        const isAnonymous = authContext.isAnonymous;

        // Récupérer les fichiers uploadés
        console.log('[AttachmentRoutes] 📥 Starting file parsing...');
        const parts = request.parts();
        const files: Array<{
          buffer: Buffer;
          filename: string;
          mimeType: string;
          size: number;
        }> = [];

        for await (const part of parts) {
          console.log('[AttachmentRoutes] 📦 Part received:', { type: part.type, filename: part.type === 'file' ? part.filename : 'N/A' });
          if (part.type === 'file') {
            const buffer = await part.toBuffer();
            console.log('[AttachmentRoutes] 📄 File buffered:', { filename: part.filename, size: buffer.length });
            files.push({
              buffer,
              filename: part.filename,
              mimeType: part.mimetype,
              size: buffer.length,
            });
          }
        }

        console.log('[AttachmentRoutes] 📊 Total files collected:', files.length);
        if (files.length === 0) {
          console.log('[AttachmentRoutes] ❌ No files provided');
          return reply.status(400).send({
            success: false,
            error: 'No files provided',
          });
        }
        
        // Vérifier les permissions pour les utilisateurs anonymes
        if (isAnonymous && authContext.anonymousParticipant) {
          const shareLink = await fastify.prisma.conversationShareLink.findUnique({
            where: { id: authContext.anonymousParticipant.shareLinkId },
            select: {
              allowAnonymousFiles: true,
              allowAnonymousImages: true,
            },
          });
          
          if (!shareLink) {
            return reply.status(403).send({
              success: false,
              error: 'Share link not found',
            });
          }
          
          // Vérifier chaque fichier
          for (const file of files) {
            const isImage = file.mimeType.startsWith('image/');
            
            if (isImage && !shareLink.allowAnonymousImages) {
              return reply.status(403).send({
                success: false,
                error: 'Images are not allowed for anonymous users on this conversation',
              });
            }
            
            if (!isImage && !shareLink.allowAnonymousFiles) {
              return reply.status(403).send({
                success: false,
                error: 'File uploads are not allowed for anonymous users on this conversation',
              });
            }
          }
        }

        console.log('[AttachmentRoutes] 📤 Uploading files:', {
          count: files.length,
          files: files.map(f => ({ name: f.filename, size: f.size, type: f.mimeType })),
        });

        // Upload tous les fichiers
        const results = await attachmentService.uploadMultiple(
          files,
          userId,
          isAnonymous
        );

        console.log('[AttachmentRoutes] ✅ Upload results:', {
          count: results.length,
          results: results.map(r => ({ id: r.id, fileName: r.fileName })),
        });

        return reply.send({
          success: true,
          attachments: results,
        });
      } catch (error: any) {
        console.error('[AttachmentRoutes] ❌ Error uploading files:', error);
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
        
        // Headers CORS/CORP pour permettre le chargement cross-origin
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');

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
        
        // Headers CORS/CORP pour permettre le chargement cross-origin
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');

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

        // Déterminer le type MIME depuis l'extension
        const ext = require('path').extname(decodedPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.mp4': 'video/mp4',
          '.mp3': 'audio/mpeg',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Définir les headers appropriés
        reply.header('Content-Type', mimeType);
        reply.header('Content-Disposition', 'inline');
        
        // Headers CORS/CORP pour permettre le chargement cross-origin
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');

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
   * Récupère les attachments d'une conversation (support authentifiés ET anonymes)
   */
  fastify.get(
    '/conversations/:conversationId/attachments',
    {
      onRequest: [authOptional],
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
        console.log('[AttachmentRoutes] GET /conversations/:conversationId/attachments - Début');
        
        const authContext = (request as any).authContext;
        console.log('[AttachmentRoutes] AuthContext:', {
          hasAuthContext: !!authContext,
          isAuthenticated: authContext?.isAuthenticated,
          isAnonymous: authContext?.isAnonymous,
          userId: authContext?.userId,
          hasAnonymousParticipant: !!authContext?.anonymousParticipant
        });
        
        if (!authContext || (!authContext.isAuthenticated && !authContext.isAnonymous)) {
          console.error('[AttachmentRoutes] ❌ Authentification requise');
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
        
        console.log('[AttachmentRoutes] Paramètres:', {
          conversationId,
          type: query.type,
          limit: query.limit,
          offset: query.offset
        });

        // Vérifier que l'utilisateur a accès à cette conversation
        if (authContext.isAuthenticated) {
          // Utilisateur authentifié - vérifier qu'il est membre de la conversation
          const member = await (fastify as any).prisma.conversationMember.findFirst({
            where: {
              conversationId,
              userId: authContext.userId,
              isActive: true,
            },
          });

          if (!member) {
            return reply.status(403).send({
              success: false,
              error: 'Access denied to this conversation',
            });
          }
        } else if (authContext.isAnonymous && authContext.anonymousParticipant) {
          // Utilisateur anonyme - vérifier qu'il a accès à cette conversation via son shareLink
          console.log('[AttachmentRoutes] Vérification accès anonyme:', {
            anonymousParticipantId: authContext.anonymousParticipant.id,
            conversationIdRequested: conversationId
          });
          
          const participant = await (fastify as any).prisma.anonymousParticipant.findUnique({
            where: { id: authContext.anonymousParticipant.id },
            select: {
              conversationId: true,
              shareLink: {
                select: {
                  allowViewHistory: true,
                },
              },
            },
          });

          console.log('[AttachmentRoutes] Participant trouvé:', {
            hasParticipant: !!participant,
            participantConversationId: participant?.conversationId,
            requestedConversationId: conversationId,
            match: participant?.conversationId === conversationId,
            allowViewHistory: participant?.shareLink?.allowViewHistory
          });

          if (!participant) {
            console.error('[AttachmentRoutes] ❌ Participant non trouvé');
            return reply.status(403).send({
              success: false,
              error: 'Participant not found',
            });
          }

          if (participant.conversationId !== conversationId) {
            console.error('[AttachmentRoutes] ❌ Mauvaise conversation:', {
              participantConversationId: participant.conversationId,
              requestedConversationId: conversationId
            });
            return reply.status(403).send({
              success: false,
              error: 'Access denied to this conversation',
            });
          }

          if (!participant.shareLink.allowViewHistory) {
            console.error('[AttachmentRoutes] ❌ Historique non autorisé');
            return reply.status(403).send({
              success: false,
              error: 'History viewing not allowed on this link',
            });
          }
          
          console.log('[AttachmentRoutes] ✅ Accès anonyme autorisé');
        }

        console.log('[AttachmentRoutes] ✅ Accès autorisé, récupération attachments...');
        
        const attachments = await attachmentService.getConversationAttachments(
          conversationId,
          {
            type: query.type,
            limit: query.limit,
            offset: query.offset,
          }
        );

        console.log('[AttachmentRoutes] ✅ Attachments récupérés:', {
          count: attachments.length,
          attachments: attachments.map(a => ({ id: a.id, fileName: a.fileName }))
        });

        return reply.send({
          success: true,
          attachments,
        });
      } catch (error: any) {
        console.error('[AttachmentRoutes] ❌ Error fetching conversation attachments:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Error fetching attachments',
        });
      }
    }
  );
}

