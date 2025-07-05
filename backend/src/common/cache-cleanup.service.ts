import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from './cache.service';

@Injectable()
export class CacheCleanupService implements OnModuleInit {
  private readonly logger = new Logger(CacheCleanupService.name);

  constructor(private cacheService: CacheService) {}

  onModuleInit() {
    this.logger.log('Cache cleanup service initialized');
  }

  /**
   * Nettoie le cache toutes les 10 minutes
   */
  @Cron('0 */10 * * * *') // Toutes les 10 minutes
  handleCacheCleanup() {
    const cleanedCount = this.cacheService.cleanup();
    if (cleanedCount > 0) {
      this.logger.log(`Cache cleanup: ${cleanedCount} expired entries removed`);
    }
  }

  /**
   * Affiche les statistiques du cache toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  handleCacheStats() {
    const stats = this.cacheService.getStats();
    this.logger.log(`Cache stats: ${stats.size} entries, keys: [${stats.keys.slice(0, 5).join(', ')}${stats.keys.length > 5 ? '...' : ''}]`);
  }

  /**
   * Nettoie complètement le cache une fois par jour (à 3h du matin)
   */
  @Cron('0 0 3 * * *')
  handleDailyCacheClear() {
    const stats = this.cacheService.getStats();
    this.cacheService.clear();
    this.logger.log(`Daily cache clear: ${stats.size} entries removed`);
  }
}
