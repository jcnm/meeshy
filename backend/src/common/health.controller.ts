import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    memory: MemoryHealth;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

interface MemoryHealth extends ServiceHealth {
  usage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  percentage: number;
}

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Health check simple pour load balancers
   */
  @Get()
  simpleHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check complet avec détails des services
   */
  @Get('detailed')
  async detailedHealth(): Promise<HealthCheck> {
    const services = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
      this.checkMemory(),
    ]);

    const [databaseResult, cacheResult, memoryResult] = services;

    const database: ServiceHealth = databaseResult.status === 'fulfilled' 
      ? databaseResult.value 
      : { status: 'unhealthy', error: 'Database check failed' };

    const cache: ServiceHealth = cacheResult.status === 'fulfilled'
      ? cacheResult.value
      : { status: 'unhealthy', error: 'Cache check failed' };

    const memory: MemoryHealth = memoryResult.status === 'fulfilled'
      ? memoryResult.value
      : { 
          status: 'unhealthy', 
          error: 'Memory check failed',
          usage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
          percentage: 0
        };

    const allHealthy = database.status === 'healthy' && 
                      cache.status === 'healthy' && 
                      memory.status === 'healthy';

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime,
      environment: process.env.NODE_ENV || 'development',
      services: {
        database,
        cache,
        memory,
      },
    };
  }

  /**
   * Readiness check pour Kubernetes
   */
  @Get('ready')
  async readinessCheck(): Promise<{ ready: boolean; timestamp: string }> {
    try {
      await this.checkDatabase();
      return {
        ready: true,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Liveness check pour Kubernetes
   */
  @Get('live')
  livenessCheck(): { alive: boolean; timestamp: string; uptime: number } {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Métriques de base du système
   */
  @Get('metrics')
  getMetrics() {
    const memUsage = process.memoryUsage();
    const cacheStats = this.cache.getStats();

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cache: {
        size: cacheStats.size,
        keys: cacheStats.keys.length,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Vérifie la santé de la base de données
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Vérifie la santé du cache
   */
  private async checkCache(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      const testKey = '__health_check__';
      const testValue = Date.now().toString();
      
      // Test écriture
      this.cache.set(testKey, testValue, 1000); // 1 seconde TTL
      
      // Test lecture
      const retrieved = this.cache.get(testKey);
      
      // Nettoyage
      this.cache.delete(testKey);
      
      const responseTime = Date.now() - start;

      if (retrieved === testValue) {
        return {
          status: 'healthy',
          responseTime,
        };
      } else {
        return {
          status: 'unhealthy',
          error: 'Cache read/write mismatch',
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown cache error',
      };
    }
  }

  /**
   * Vérifie l'utilisation mémoire
   */
  private checkMemory(): MemoryHealth {
    const usage = process.memoryUsage();
    const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    
    // Considéré comme unhealthy si l'utilisation mémoire dépasse 90%
    const status = percentage > 90 ? 'unhealthy' : 'healthy';

    return {
      status,
      usage: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
      },
      percentage,
      ...(status === 'unhealthy' && { error: `High memory usage: ${percentage}%` }),
    };
  }
}
