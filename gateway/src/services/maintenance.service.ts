/**
 * Service de maintenance pour Meeshy
 * Gestion des tâches de maintenance automatiques
 */

import { PrismaClient } from '../../shared/prisma/client';
import { logger } from '../utils/logger';

export class MaintenanceService {
  private prisma: PrismaClient;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private readonly OFFLINE_THRESHOLD_MINUTES = 5; // 5 minutes d'inactivité = hors ligne

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Démarrer les tâches de maintenance
   */
  async startMaintenanceTasks(): Promise<void> {
    logger.info('🚀 Démarrage des tâches de maintenance...');

    // Tâche de maintenance pour l'état en ligne/hors ligne
    this.maintenanceInterval = setInterval(async () => {
      logger.info('🔄 Exécution de la tâche de maintenance automatique...');
      await this.updateOfflineUsers();
    }, 60000); // Vérifier toutes les minutes

    logger.info('✅ Tâches de maintenance démarrées avec intervalle de 60 secondes');
  }

  /**
   * Arrêter les tâches de maintenance
   */
  stopMaintenanceTasks(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
      logger.info('🛑 Tâches de maintenance arrêtées');
    }
  }

  /**
   * Mettre à jour les utilisateurs hors ligne basé sur leur dernière activité
   */
  private async updateOfflineUsers(): Promise<void> {
    try {
      const offlineThreshold = new Date();
      offlineThreshold.setMinutes(offlineThreshold.getMinutes() - this.OFFLINE_THRESHOLD_MINUTES);

      // Trouver tous les utilisateurs marqués comme en ligne mais inactifs depuis plus de 5 minutes
      const inactiveUsers = await this.prisma.user.findMany({
        where: {
          isOnline: true,
          lastActiveAt: {
            lt: offlineThreshold
          },
          isActive: true
        },
        select: {
          id: true,
          username: true,
          lastActiveAt: true
        }
      });

      if (inactiveUsers.length > 0) {
        // Mettre à jour leur statut en ligne
        await this.prisma.user.updateMany({
          where: {
            id: {
              in: inactiveUsers.map(user => user.id)
            }
          },
          data: {
            isOnline: false,
            lastSeen: new Date()
          }
        });

        logger.info(`🔄 ${inactiveUsers.length} utilisateurs marqués comme hors ligne (inactifs depuis >${this.OFFLINE_THRESHOLD_MINUTES}min)`, {
          users: inactiveUsers.map(u => ({ id: u.id, username: u.username, lastActiveAt: u.lastActiveAt }))
        });
      }
    } catch (error) {
      logger.error('❌ Erreur lors de la mise à jour des utilisateurs hors ligne:', error);
    }
  }

  /**
   * Mettre à jour manuellement l'état en ligne/hors ligne d'un utilisateur
   */
  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeen: new Date(),
          lastActiveAt: isOnline ? new Date() : undefined
        }
      });

      logger.info(`👤 Statut utilisateur ${userId} mis à jour: ${isOnline ? 'en ligne' : 'hors ligne'}`);
    } catch (error) {
      logger.error(`❌ Erreur lors de la mise à jour du statut de l'utilisateur ${userId}:`, error);
    }
  }

  /**
   * Nettoyer les sessions expirées et les données temporaires
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      // Nettoyer les sessions anonymes expirées (plus de 24h)
      const expiredAnonymousSessions = await this.prisma.anonymousParticipant.deleteMany({
        where: {
          lastActiveAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 heures
          }
        }
      });

      if (expiredAnonymousSessions.count > 0) {
        logger.info(`🧹 ${expiredAnonymousSessions.count} sessions anonymes expirées supprimées`);
      }

      // Nettoyer les liens de partage expirés (plus de 7 jours)
      const expiredShareLinks = await this.prisma.conversationShareLink.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (expiredShareLinks.count > 0) {
        logger.info(`🧹 ${expiredShareLinks.count} liens de partage expirés supprimés`);
      }

    } catch (error) {
      logger.error('❌ Erreur lors du nettoyage des données expirées:', error);
    }
  }

  /**
   * Obtenir les statistiques de maintenance
   */
  async getMaintenanceStats(): Promise<any> {
    try {
      const [onlineUsers, totalUsers, anonymousSessions] = await Promise.all([
        this.prisma.user.count({
          where: { isOnline: true, isActive: true }
        }),
        this.prisma.user.count({
          where: { isActive: true }
        }),
        this.prisma.anonymousParticipant.count({
          where: { isActive: true }
        })
      ]);

      const maintenanceActive = this.maintenanceInterval !== null;
      logger.info(`📊 Statistiques de maintenance - Maintenance active: ${maintenanceActive}, Utilisateurs en ligne: ${onlineUsers}/${totalUsers}`);

      return {
        onlineUsers,
        totalUsers,
        anonymousSessions,
        offlineThresholdMinutes: this.OFFLINE_THRESHOLD_MINUTES,
        maintenanceActive
      };
    } catch (error) {
      logger.error('❌ Erreur lors de la récupération des statistiques de maintenance:', error);
      return null;
    }
  }
}
