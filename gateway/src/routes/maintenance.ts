/**
 * Routes de maintenance pour Meeshy
 * Endpoints pour la gestion et le monitoring des tâches de maintenance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MaintenanceService } from '../services/maintenance.service';
import { AttachmentService } from '../services/AttachmentService';
import { PrismaClient } from '../../shared/prisma/client';

export async function maintenanceRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma as PrismaClient;
  const attachmentService = new AttachmentService(prisma);
  const maintenanceService = new MaintenanceService(prisma, attachmentService);

  // Route pour obtenir les statistiques de maintenance
  fastify.get('/stats', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                onlineUsers: { type: 'number' },
                totalUsers: { type: 'number' },
                anonymousSessions: { type: 'number' },
                offlineThresholdMinutes: { type: 'number' },
                maintenanceActive: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await maintenanceService.getMaintenanceStats();
      
      if (!stats) {
        return reply.status(500).send({
          success: false,
          error: 'Erreur lors de la récupération des statistiques'
        });
      }

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[GATEWAY] Error in /maintenance/stats:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des statistiques de maintenance'
      });
    }
  });

  // Route pour déclencher manuellement le nettoyage des données expirées
  fastify.post('/cleanup', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await maintenanceService.cleanupExpiredData();
      
      return reply.send({
        success: true,
        message: 'Nettoyage des données expirées terminé'
      });
    } catch (error) {
      console.error('[GATEWAY] Error in /maintenance/cleanup:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors du nettoyage des données expirées'
      });
    }
  });

  // Route pour mettre à jour manuellement le statut d'un utilisateur
  fastify.post('/user-status', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'isOnline'],
        properties: {
          userId: { type: 'string' },
          isOnline: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, isOnline } = request.body as { userId: string; isOnline: boolean };
      
      await maintenanceService.updateUserOnlineStatus(userId, isOnline);
      
      return reply.send({
        success: true,
        message: `Statut utilisateur ${userId} mis à jour: ${isOnline ? 'en ligne' : 'hors ligne'}`
      });
    } catch (error) {
      console.error('[GATEWAY] Error in /maintenance/user-status:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la mise à jour du statut utilisateur'
      });
    }
  });
}
