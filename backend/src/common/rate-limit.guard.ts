import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store: RateLimitStore = {};

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(request);
    
    // Configuration par défaut (peut être overridée par décorateur)
    const ttl = parseInt(process.env.RATE_LIMIT_TTL || '60'); // 60 secondes
    const limit = parseInt(process.env.RATE_LIMIT_LIMIT || '100'); // 100 requêtes

    const now = Date.now();
    const record = this.store[key];

    // Si pas d'enregistrement ou si le TTL est dépassé, réinitialiser
    if (!record || now > record.resetTime) {
      this.store[key] = {
        count: 1,
        resetTime: now + (ttl * 1000),
      };
      return true;
    }

    // Incrémenter le compteur
    record.count++;

    // Vérifier si la limite est dépassée
    if (record.count > limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Trop de requêtes. Veuillez patienter.',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private generateKey(request: { ip?: string; connection?: { remoteAddress?: string }; get: (header: string) => string | undefined }): string {
    // Utiliser l'IP + User-Agent comme clé unique
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const userAgent = request.get('User-Agent') || 'unknown';
    return `${ip}:${userAgent}`;
  }

  // Méthode pour nettoyer les anciens enregistrements
  cleanExpiredRecords(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const record = this.store[key];
      if (record && record.resetTime < now) {
        delete this.store[key];
      }
    });
  }
}
