import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Récupère une valeur du cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Vérifier si l'entrée a expiré
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.data as T;
  }

  /**
   * Stocke une valeur dans le cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.cache.set(key, entry);
    this.logger.debug(`Cache set for key: ${key}, TTL: ${entry.ttl}ms`);
  }

  /**
   * Supprime une clé du cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache deleted for key: ${key}`);
    }
    return deleted;
  }

  /**
   * Supprime toutes les clés qui correspondent à un pattern
   */
  deleteByPattern(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    this.logger.debug(`Cache deleted ${deletedCount} keys matching pattern: ${pattern}`);
    return deletedCount;
  }

  /**
   * Nettoie le cache des entrées expirées
   */
  cleanup(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleanedCount} expired entries`);
    }

    return cleanedCount;
  }

  /**
   * Vide complètement le cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Récupère les statistiques du cache
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Wrapper pour récupérer ou calculer une valeur
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    this.logger.debug(`Cache miss for key: ${key}, computing value...`);
    const data = await factory();
    this.set(key, data, ttl);
    
    return data;
  }

  /**
   * Clés de cache prédéfinies pour éviter les erreurs de frappe
   */
  static readonly Keys = {
    USER_CONVERSATIONS: (userId: string) => `user:${userId}:conversations`,
    USER_PROFILE: (userId: string) => `user:${userId}:profile`,
    CONVERSATION_DETAILS: (conversationId: string) => `conversation:${conversationId}:details`,
    CONVERSATION_MESSAGES: (conversationId: string, page: number) => `conversation:${conversationId}:messages:${page}`,
    USER_STATS: (userId: string) => `user:${userId}:stats`,
    GROUP_MEMBERS: (groupId: string) => `group:${groupId}:members`,
  } as const;

  /**
   * TTL prédéfinis pour différents types de données
   */
  static readonly TTL = {
    SHORT: 1 * 60 * 1000, // 1 minute
    MEDIUM: 5 * 60 * 1000, // 5 minutes
    LONG: 30 * 60 * 1000, // 30 minutes
    VERY_LONG: 60 * 60 * 1000, // 1 heure
  } as const;
}
