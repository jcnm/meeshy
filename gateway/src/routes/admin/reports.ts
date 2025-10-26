import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../../utils/logger';
import { getReportService } from '../../services/admin/report.service';
import type {
  CreateReportDTO,
  UpdateReportDTO,
  ReportFilters,
  ReportPaginationParams
} from '../../../shared/types';

// Schémas de validation Zod
const createReportSchema = z.object({
  reportedType: z.enum(['message', 'user', 'conversation', 'community']),
  reportedEntityId: z.string().min(1, 'ID de l\'entité requis'),
  reporterId: z.string().optional(),
  reporterName: z.string().optional(),
  reportType: z.enum(['spam', 'inappropriate', 'harassment', 'violence', 'hate_speech', 'fake_profile', 'impersonation', 'other']),
  reason: z.string().optional()
});

const updateReportSchema = z.object({
  status: z.enum(['pending', 'under_review', 'resolved', 'rejected', 'dismissed']).optional(),
  moderatorNotes: z.string().optional(),
  actionTaken: z.enum(['none', 'warning_sent', 'content_removed', 'user_suspended', 'user_banned']).optional()
});

// Middleware pour vérifier les permissions de modération
const requireModeratorPermission = async (request: FastifyRequest, reply: FastifyReply) => {
  const authContext = (request as any).authContext;
  if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
    return reply.status(401).send({
      success: false,
      message: 'Authentification requise'
    });
  }

  const userRole = authContext.registeredUser.role;
  const canModerate = ['BIGBOSS', 'ADMIN', 'MODO'].includes(userRole);

  if (!canModerate) {
    return reply.status(403).send({
      success: false,
      message: 'Permission de modération requise'
    });
  }
};

export async function reportRoutes(fastify: FastifyInstance) {
  const reportService = getReportService(fastify.prisma);

  /**
   * POST /api/admin/reports
   * Créer un nouveau signalement
   */
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const body = createReportSchema.parse(request.body);

      // Si l'utilisateur est authentifié, utiliser son ID
      const reportData: CreateReportDTO = {
        reportedType: body.reportedType,
        reportedEntityId: body.reportedEntityId,
        reportType: body.reportType,
        reporterId: authContext.registeredUser?.id || body.reporterId,
        reporterName: body.reporterName || authContext.anonymousUser?.username,
        reason: body.reason
      };

      const report = await reportService.createReport(reportData);

      return reply.status(201).send({
        success: true,
        data: report,
        message: 'Signalement créé avec succès'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Create report error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la création du signalement'
      });
    }
  });

  /**
   * GET /api/admin/reports
   * Lister les signalements avec pagination et filtres
   */
  fastify.get('/', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;

      const filters: ReportFilters = {
        reportedType: query.reportedType,
        reportType: query.reportType,
        status: query.status,
        reporterId: query.reporterId,
        moderatorId: query.moderatorId,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc'
      };

      if (query.createdAfter) {
        filters.createdAfter = new Date(query.createdAfter);
      }
      if (query.createdBefore) {
        filters.createdBefore = new Date(query.createdBefore);
      }

      const pagination: ReportPaginationParams = {
        page: parseInt(query.page) || 1,
        pageSize: parseInt(query.pageSize) || 20
      };

      const result = await reportService.listReports(filters, pagination);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logError(fastify.log, 'List reports error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération des signalements'
      });
    }
  });

  /**
   * GET /api/admin/reports/stats
   * Obtenir les statistiques des signalements
   */
  fastify.get('/stats', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await reportService.getReportStats();

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      logError(fastify.log, 'Get report stats error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  });

  /**
   * GET /api/admin/reports/recent
   * Obtenir les signalements récents
   */
  fastify.get('/recent', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const limit = parseInt(query.limit) || 10;

      const reports = await reportService.getRecentReports(limit);

      return reply.send({
        success: true,
        data: reports
      });
    } catch (error) {
      logError(fastify.log, 'Get recent reports error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération des signalements récents'
      });
    }
  });

  /**
   * GET /api/admin/reports/:id
   * Obtenir un signalement par ID
   */
  fastify.get('/:id', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const report = await reportService.getReportById(id);

      if (!report) {
        return reply.status(404).send({
          success: false,
          message: 'Signalement non trouvé'
        });
      }

      return reply.send({
        success: true,
        data: report
      });
    } catch (error) {
      logError(fastify.log, 'Get report error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération du signalement'
      });
    }
  });

  /**
   * PATCH /api/admin/reports/:id
   * Mettre à jour un signalement (modérateur uniquement)
   */
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const moderatorId = authContext.registeredUser.id;
      const { id } = request.params as { id: string };
      const body = updateReportSchema.parse(request.body);

      const report = await reportService.updateReport(id, moderatorId, body as UpdateReportDTO);

      return reply.send({
        success: true,
        data: report,
        message: 'Signalement mis à jour'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Update report error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la mise à jour du signalement'
      });
    }
  });

  /**
   * DELETE /api/admin/reports/:id
   * Supprimer un signalement
   */
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      await reportService.deleteReport(id);

      return reply.send({
        success: true,
        message: 'Signalement supprimé'
      });
    } catch (error) {
      logError(fastify.log, 'Delete report error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la suppression du signalement'
      });
    }
  });

  /**
   * GET /api/admin/reports/entity/:type/:id
   * Obtenir tous les signalements pour une entité spécifique
   */
  fastify.get('/entity/:type/:id', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type, id } = request.params as { type: string; id: string };

      const reports = await reportService.getReportsForEntity(type, id);

      return reply.send({
        success: true,
        data: reports
      });
    } catch (error) {
      logError(fastify.log, 'Get entity reports error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération des signalements'
      });
    }
  });

  /**
   * POST /api/admin/reports/:id/assign
   * Assigner un modérateur à un signalement
   */
  fastify.post('/:id/assign', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const moderatorId = authContext.registeredUser.id;
      const { id } = request.params as { id: string };

      const report = await reportService.assignModerator(id, moderatorId);

      return reply.send({
        success: true,
        data: report,
        message: 'Modérateur assigné au signalement'
      });
    } catch (error) {
      logError(fastify.log, 'Assign moderator error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de l\'assignation du modérateur'
      });
    }
  });

  /**
   * GET /api/admin/reports/moderator/mine
   * Obtenir les signalements assignés au modérateur connecté
   */
  fastify.get('/moderator/mine', {
    onRequest: [fastify.authenticate, requireModeratorPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      const moderatorId = authContext.registeredUser.id;

      const reports = await reportService.getModeratorReports(moderatorId);

      return reply.send({
        success: true,
        data: reports
      });
    } catch (error) {
      logError(fastify.log, 'Get moderator reports error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur lors de la récupération des signalements'
      });
    }
  });
}
