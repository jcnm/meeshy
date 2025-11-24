/**
 * Service de gestion des statuts utilisateurs en ligne/hors ligne
 *
 * Distinction des champs de présence:
 * - lastSeen: Mis à jour à chaque activité détectable (connexion, heartbeat, requête API, typing, etc.)
 *   → Throttling léger (5 secondes) pour éviter surcharge DB
 * - lastActiveAt: Mis à jour uniquement lors d'actions significatives (connexion, envoi message)
 *   → Throttling plus agressif (1 minute) car moins critique
 *
 * Fonctionnalités:
 * - Throttling différencié pour lastSeen (5s) et lastActiveAt (60s)
 * - Gestion séparée des utilisateurs enregistrés et anonymes
 * - Cache en mémoire avec nettoyage automatique
 * - Updates asynchrones pour ne pas bloquer les requêtes
 *
 * @version 2.0.0
 */

import { PrismaClient } from '../../shared/prisma/client';
import { logger } from '../utils/logger';

export interface StatusUpdateMetrics {
  totalRequests: number;
  throttledRequests: number;
  successfulUpdates: number;
  failedUpdates: number;
  cacheSize: number;
  lastSeenUpdates: number;
  lastActiveUpdates: number;
}

export class StatusService {
  // Caches séparés pour lastSeen et lastActiveAt
  private lastSeenCache = new Map<string, number>();
  private lastActiveCache = new Map<string, number>();

  // Throttling différencié
  private readonly LAST_SEEN_THROTTLE_MS = 5000; // 5 secondes (activité légère)
  private readonly LAST_ACTIVE_THROTTLE_MS = 60000; // 1 minute (actions significatives)

  private readonly CACHE_CLEANUP_INTERVAL_MS = 300000; // 5 minutes
  private readonly CACHE_MAX_AGE_MS = 600000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Métriques de performance
  private metrics: StatusUpdateMetrics = {
    totalRequests: 0,
    throttledRequests: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    cacheSize: 0,
    lastSeenUpdates: 0,
    lastActiveUpdates: 0
  };

  constructor(private prisma: PrismaClient) {
    this.startCacheCleanup();
    logger.info('✅ StatusService initialisé (lastSeen: 5s, lastActiveAt: 60s)');
  }

  /**
   * Mettre à jour lastSeen d'un utilisateur (activité détectable)
   * Throttling: 5 secondes
   * Cas d'usage: connexion Socket.IO, heartbeat, requête API, typing, lecture message
   */
  async updateUserLastSeen(userId: string): Promise<void> {
    this.metrics.totalRequests++;

    const now = Date.now();
    const lastUpdate = this.lastSeenCache.get(userId) || 0;

    // Throttling: 1 update max toutes les 5 secondes
    if (now - lastUpdate < this.LAST_SEEN_THROTTLE_MS) {
      this.metrics.throttledRequests++;
      return;
    }

    this.lastSeenCache.set(userId, now);
    this.metrics.cacheSize = this.lastSeenCache.size + this.lastActiveCache.size;

    // Update asynchrone (ne bloque pas la requête)
    this.prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() }
    })
    .then(() => {
      this.metrics.successfulUpdates++;
      this.metrics.lastSeenUpdates++;
      logger.debug(`✓ User ${userId} lastSeen updated`);
    })
    .catch(err => {
      this.metrics.failedUpdates++;
      logger.error(`❌ Failed to update user lastSeen (${userId}):`, err);
    });
  }

  /**
   * Mettre à jour lastActiveAt d'un utilisateur (action significative)
   * Throttling: 1 minute
   * Cas d'usage: connexion, envoi de message
   */
  async updateUserLastActive(userId: string): Promise<void> {
    this.metrics.totalRequests++;

    const now = Date.now();
    const lastUpdate = this.lastActiveCache.get(userId) || 0;

    // Throttling: 1 update max par minute
    if (now - lastUpdate < this.LAST_ACTIVE_THROTTLE_MS) {
      this.metrics.throttledRequests++;
      return;
    }

    this.lastActiveCache.set(userId, now);
    this.metrics.cacheSize = this.lastSeenCache.size + this.lastActiveCache.size;

    // Update asynchrone (ne bloque pas la requête)
    this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    })
    .then(() => {
      this.metrics.successfulUpdates++;
      this.metrics.lastActiveUpdates++;
      logger.debug(`✓ User ${userId} lastActiveAt updated`);
    })
    .catch(err => {
      this.metrics.failedUpdates++;
      logger.error(`❌ Failed to update user lastActiveAt (${userId}):`, err);
    });
  }

  /**
   * Mettre à jour lastSeenAt d'un participant anonyme (activité détectable)
   * Throttling: 5 secondes
   */
  async updateAnonymousLastSeen(participantId: string): Promise<void> {
    this.metrics.totalRequests++;

    const now = Date.now();
    const cacheKey = `anon_seen_${participantId}`;
    const lastUpdate = this.lastSeenCache.get(cacheKey) || 0;

    // Throttling: 1 update max toutes les 5 secondes
    if (now - lastUpdate < this.LAST_SEEN_THROTTLE_MS) {
      this.metrics.throttledRequests++;
      return;
    }

    this.lastSeenCache.set(cacheKey, now);
    this.metrics.cacheSize = this.lastSeenCache.size + this.lastActiveCache.size;

    // Update asynchrone (ne bloque pas la requête)
    this.prisma.anonymousParticipant.update({
      where: { id: participantId },
      data: { lastSeenAt: new Date() }
    })
    .then(() => {
      this.metrics.successfulUpdates++;
      this.metrics.lastSeenUpdates++;
      logger.debug(`✓ Anonymous ${participantId} lastSeenAt updated`);
    })
    .catch(err => {
      this.metrics.failedUpdates++;
      logger.error(`❌ Failed to update anonymous lastSeenAt (${participantId}):`, err);
    });
  }

  /**
   * Mettre à jour lastActiveAt d'un participant anonyme (action significative)
   * Throttling: 1 minute
   */
  async updateAnonymousLastActive(participantId: string): Promise<void> {
    this.metrics.totalRequests++;

    const now = Date.now();
    const cacheKey = `anon_active_${participantId}`;
    const lastUpdate = this.lastActiveCache.get(cacheKey) || 0;

    // Throttling: 1 update max par minute
    if (now - lastUpdate < this.LAST_ACTIVE_THROTTLE_MS) {
      this.metrics.throttledRequests++;
      return;
    }

    this.lastActiveCache.set(cacheKey, now);
    this.metrics.cacheSize = this.lastSeenCache.size + this.lastActiveCache.size;

    // Update asynchrone (ne bloque pas la requête)
    this.prisma.anonymousParticipant.update({
      where: { id: participantId },
      data: { lastActiveAt: new Date() }
    })
    .then(() => {
      this.metrics.successfulUpdates++;
      this.metrics.lastActiveUpdates++;
      logger.debug(`✓ Anonymous ${participantId} lastActiveAt updated`);
    })
    .catch(err => {
      this.metrics.failedUpdates++;
      logger.error(`❌ Failed to update anonymous lastActiveAt (${participantId}):`, err);
    });
  }

  /**
   * Mettre à jour lastSeen de manière générique (activité détectable)
   * Cas d'usage: heartbeat, typing, lecture message, requête API
   */
  async updateLastSeen(userId: string, isAnonymous: boolean = false): Promise<void> {
    if (isAnonymous) {
      await this.updateAnonymousLastSeen(userId);
    } else {
      await this.updateUserLastSeen(userId);
    }
  }

  /**
   * Mettre à jour lastActiveAt de manière générique (action significative)
   * Cas d'usage: connexion, envoi de message
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

    // Nettoyer le cache lastSeen
    for (const [key, timestamp] of this.lastSeenCache.entries()) {
      if (now - timestamp > this.CACHE_MAX_AGE_MS) {
        this.lastSeenCache.delete(key);
        deletedCount++;
      }
    }

    // Nettoyer le cache lastActive
    for (const [key, timestamp] of this.lastActiveCache.entries()) {
      if (now - timestamp > this.CACHE_MAX_AGE_MS) {
        this.lastActiveCache.delete(key);
        deletedCount++;
      }
    }

    this.metrics.cacheSize = this.lastSeenCache.size + this.lastActiveCache.size;

    if (deletedCount > 0) {
      logger.debug(`🧹 Cache cleanup: ${deletedCount} entrées supprimées (taille: ${this.metrics.cacheSize})`);
    }
  }

  /**
   * Forcer un update immédiat de lastSeen (bypass throttling)
   * Utile pour Socket.IO connect/disconnect
   */
  async forceUpdateLastSeen(userId: string, isAnonymous: boolean = false): Promise<void> {
    const cacheKey = isAnonymous ? `anon_seen_${userId}` : userId;
    this.lastSeenCache.set(cacheKey, Date.now());

    if (isAnonymous) {
      await this.prisma.anonymousParticipant.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() }
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() }
      });
    }
  }

  /**
   * Forcer un update immédiat de lastActiveAt (bypass throttling)
   * Utile pour Socket.IO connect ou envoi de message critique
   */
  async forceUpdateLastActive(userId: string, isAnonymous: boolean = false): Promise<void> {
    const cacheKey = isAnonymous ? `anon_active_${userId}` : userId;
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
   * Forcer un update immédiat des deux champs (bypass throttling)
   * Utile pour connexion initiale ou déconnexion
   */
  async forceUpdateBoth(userId: string, isAnonymous: boolean = false): Promise<void> {
    await Promise.all([
      this.forceUpdateLastSeen(userId, isAnonymous),
      this.forceUpdateLastActive(userId, isAnonymous)
    ]);
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
      cacheSize: this.lastSeenCache.size + this.lastActiveCache.size,
      lastSeenUpdates: 0,
      lastActiveUpdates: 0
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

    this.lastSeenCache.clear();
    this.lastActiveCache.clear();
    logger.info('🛑 StatusService arrêté');
  }
}
