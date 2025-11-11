/**
 * Service de gestion des statuts utilisateurs en ligne/hors ligne
 *
 * Fonctionnalités:
 * - Throttling des updates de lastActiveAt (1 update max par minute)
 * - Gestion séparée des utilisateurs enregistrés et anonymes
 * - Cache en mémoire avec nettoyage automatique
 * - Updates asynchrones pour ne pas bloquer les requêtes
 *
 * @version 1.0.0
 */

import { PrismaClient } from '../../shared/prisma/client';
import { logger } from '../utils/logger';

export interface StatusUpdateMetrics {
  totalRequests: number;
  throttledRequests: number;
  successfulUpdates: number;
  failedUpdates: number;
  cacheSize: number;
}

export class StatusService {
  private lastActiveCache = new Map<string, number>();
  private readonly THROTTLE_INTERVAL_MS = 60000; // 1 minute
  private readonly CACHE_CLEANUP_INTERVAL_MS = 300000; // 5 minutes
  private readonly CACHE_MAX_AGE_MS = 600000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Métriques de performance
  private metrics: StatusUpdateMetrics = {
    totalRequests: 0,
    throttledRequests: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    cacheSize: 0
  };

  constructor(private prisma: PrismaClient) {
    this.startCacheCleanup();
    logger.info('✅ StatusService initialisé avec throttling 60s');
  }

  /**
   * Mettre à jour lastActiveAt d'un utilisateur enregistré (avec throttling)
   * Update asynchrone pour ne pas bloquer la requête REST
   */
  async updateUserLastActive(userId: string): Promise<void> {
    this.metrics.totalRequests++;

    const now = Date.now();
    const lastUpdate = this.lastActiveCache.get(userId) || 0;

    // Throttling: 1 update max par minute
    if (now - lastUpdate < this.THROTTLE_INTERVAL_MS) {
      this.metrics.throttledRequests++;
      return;
    }

    this.lastActiveCache.set(userId, now);
    this.metrics.cacheSize = this.lastActiveCache.size;

    // Update asynchrone (ne bloque pas la requête)
    this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    })
    .then(() => {
      this.metrics.successfulUpdates++;
      logger.debug(`✓ User ${userId} lastActiveAt updated`);
    })
    .catch(err => {
      this.metrics.failedUpdates++;
      logger.error(`❌ Failed to update user lastActiveAt (${userId}):`, err);
    });
  }

  /**
   * Mettre à jour lastActiveAt d'un participant anonyme (avec throttling)
   * Update asynchrone pour ne pas bloquer la requête REST
   */
  async updateAnonymousLastActive(participantId: string): Promise<void> {
    this.metrics.totalRequests++;

    const now = Date.now();
    const cacheKey = `anon_${participantId}`;
    const lastUpdate = this.lastActiveCache.get(cacheKey) || 0;

    // Throttling: 1 update max par minute
    if (now - lastUpdate < this.THROTTLE_INTERVAL_MS) {
      this.metrics.throttledRequests++;
      return;
    }

    this.lastActiveCache.set(cacheKey, now);
    this.metrics.cacheSize = this.lastActiveCache.size;

    // Update asynchrone (ne bloque pas la requête)
    this.prisma.anonymousParticipant.update({
      where: { id: participantId },
      data: { lastActiveAt: new Date() }
    })
    .then(() => {
      this.metrics.successfulUpdates++;
      logger.debug(`✓ Anonymous ${participantId} lastActiveAt updated`);
    })
    .catch(err => {
      this.metrics.failedUpdates++;
      logger.error(`❌ Failed to update anonymous lastActiveAt (${participantId}):`, err);
    });
  }

  /**
   * Mettre à jour lastActiveAt de manière générique (détection auto du type)
   */
  async updateLastActive(userId: string, isAnonymous: boolean = false): Promise<void> {
    if (isAnonymous) {
      await this.updateAnonymousLastActive(userId);
    } else {
      await this.updateUserLastActive(userId);
    }
  }

  /**
   * Démarrer le nettoyage périodique du cache
   */
  private startCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.clearOldCacheEntries();
    }, this.CACHE_CLEANUP_INTERVAL_MS);

    logger.info(`🧹 Cache cleanup démarré (intervalle: ${this.CACHE_CLEANUP_INTERVAL_MS}ms)`);
  }

  /**
   * Nettoyer les entrées obsolètes du cache (éviter fuite mémoire)
   */
  clearOldCacheEntries(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, timestamp] of this.lastActiveCache.entries()) {
      if (now - timestamp > this.CACHE_MAX_AGE_MS) {
        this.lastActiveCache.delete(key);
        deletedCount++;
      }
    }

    this.metrics.cacheSize = this.lastActiveCache.size;

    if (deletedCount > 0) {
      logger.debug(`🧹 Cache cleanup: ${deletedCount} entrées supprimées (taille: ${this.metrics.cacheSize})`);
    }
  }

  /**
   * Forcer un update immédiat (bypass throttling)
   * Utile pour Socket.IO connect/disconnect
   */
  async forceUpdateLastActive(userId: string, isAnonymous: boolean = false): Promise<void> {
    const cacheKey = isAnonymous ? `anon_${userId}` : userId;
    this.lastActiveCache.set(cacheKey, Date.now());

    if (isAnonymous) {
      await this.prisma.anonymousParticipant.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      });
    }
  }

  /**
   * Obtenir les métriques de performance
   */
  getMetrics(): StatusUpdateMetrics {
    return { ...this.metrics };
  }

  /**
   * Réinitialiser les métriques
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      throttledRequests: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      cacheSize: this.lastActiveCache.size
    };
    logger.info('📊 Métriques StatusService réinitialisées');
  }

  /**
   * Arrêter le service proprement
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.lastActiveCache.clear();
    logger.info('🛑 StatusService arrêté');
  }
}
