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
  private statusBroadcastCallback: ((userId: string, isOnline: boolean, isAnonymous: boolean) => void) | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Définir une callback pour broadcaster les changements de statut
   */
  setStatusBroadcastCallback(callback: (userId: string, isOnline: boolean, isAnonymous: boolean) => void): void {
    this.statusBroadcastCallback = callback;
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

        logger.warn(`🔄 [CLEANUP] ${inactiveUsers.length} utilisateurs marqués comme hors ligne (inactifs depuis >${this.OFFLINE_THRESHOLD_MINUTES}min)`, {
          users: inactiveUsers.map(u => ({ 
            id: u.id, 
            username: u.username, 
            lastActiveAt: u.lastActiveAt,
            inactiveMinutes: Math.floor((Date.now() - u.lastActiveAt.getTime()) / 60000)
          }))
        });
      } else {
        logger.debug(`✅ [CLEANUP] Aucun utilisateur inactif à nettoyer`);
      }

      // CORRECTION: Gérer également les participants anonymes inactifs
      const inactiveAnonymous = await this.prisma.anonymousParticipant.findMany({
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

      if (inactiveAnonymous.length > 0) {
        // Mettre à jour leur statut en ligne
        await this.prisma.anonymousParticipant.updateMany({
          where: {
            id: {
              in: inactiveAnonymous.map(participant => participant.id)
            }
          },
          data: {
            isOnline: false,
            lastSeenAt: new Date()
          }
        });

        logger.warn(`🔄 [CLEANUP] ${inactiveAnonymous.length} participants anonymes marqués comme hors ligne (inactifs depuis >${this.OFFLINE_THRESHOLD_MINUTES}min)`, {
          participants: inactiveAnonymous.map(p => ({ 
            id: p.id, 
            username: p.username, 
            lastActiveAt: p.lastActiveAt,
            inactiveMinutes: Math.floor((Date.now() - p.lastActiveAt.getTime()) / 60000)
          }))
        });
      } else {
        logger.debug(`✅ [CLEANUP] Aucun participant anonyme inactif à nettoyer`);
      }
    } catch (error) {
      logger.error('❌ Erreur lors de la mise à jour des utilisateurs hors ligne:', error);
    }
  }

  /**
   * Mettre à jour manuellement l'état en ligne/hors ligne d'un utilisateur
   */
  async updateUserOnlineStatus(userId: string, isOnline: boolean, broadcast: boolean = false): Promise<void> {
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
      
      // CORRECTION: Broadcaster le changement de statut si demandé
      if (broadcast && this.statusBroadcastCallback) {
        this.statusBroadcastCallback(userId, isOnline, false);
      }
    } catch (error) {
      logger.error(`❌ Erreur lors de la mise à jour du statut de l'utilisateur ${userId}:`, error);
    }
  }

  /**
   * Mettre à jour manuellement l'état en ligne/hors ligne d'un participant anonyme
   */
  async updateAnonymousOnlineStatus(participantId: string, isOnline: boolean, broadcast: boolean = false): Promise<void> {
    try {
      await this.prisma.anonymousParticipant.update({
        where: { id: participantId },
        data: {
          isOnline,
          lastSeenAt: new Date(),
          lastActiveAt: isOnline ? new Date() : undefined
        }
      });

      logger.info(`👤 Statut participant anonyme ${participantId} mis à jour: ${isOnline ? 'en ligne' : 'hors ligne'}`);
      
      // CORRECTION: Broadcaster le changement de statut si demandé
      if (broadcast && this.statusBroadcastCallback) {
        this.statusBroadcastCallback(participantId, isOnline, true);
      }
    } catch (error) {
      logger.error(`❌ Erreur lors de la mise à jour du statut du participant anonyme ${participantId}:`, error);
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
      const [onlineUsers, totalUsers, anonymousSessions, onlineAnonymous] = await Promise.all([
        this.prisma.user.count({
          where: { isOnline: true, isActive: true }
        }),
        this.prisma.user.count({
          where: { isActive: true }
        }),
        this.prisma.anonymousParticipant.count({
          where: { isActive: true }
        }),
        this.prisma.anonymousParticipant.count({
          where: { isOnline: true, isActive: true }
        })
      ]);

      const maintenanceActive = this.maintenanceInterval !== null;
      logger.info(`📊 Statistiques de maintenance - Maintenance active: ${maintenanceActive}, Utilisateurs en ligne: ${onlineUsers}/${totalUsers}, Anonymes en ligne: ${onlineAnonymous}/${anonymousSessions}`);

      return {
        onlineUsers,
        totalUsers,
        anonymousSessions,
        onlineAnonymous,
        offlineThresholdMinutes: this.OFFLINE_THRESHOLD_MINUTES,
        maintenanceActive
      };
    } catch (error) {
      logger.error('❌ Erreur lors de la récupération des statistiques de maintenance:', error);
      return null;
    }
  }
}
