/**
 * Utilitaire de logging pour contrôler la verbosité des logs
 * 
 * En production: Seuls les logs ERROR et WARN sont affichés
 * En développement: Tous les logs sont affichés
 * 
 * Pour activer les logs en production, définir NEXT_PUBLIC_DEBUG_LOGS=true
 * 
 * @example
 * import { logger } from '@/utils/logger';
 * 
 * logger.info('[COMPONENT]', 'Component mounted');
 * logger.error('[API]', 'Request failed', error);
 * logger.debug('[STATE]', 'State updated', newState);
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Configuration basée sur l'environnement
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isDebugMode = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true'
      : false;
    
    this.config = {
      level: isDevelopment || isDebugMode ? LogLevel.DEBUG : LogLevel.WARN,
      enabled: isDevelopment || isDebugMode
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // En production, seulement ERROR et WARN
    if (!this.config.enabled && level > LogLevel.WARN) {
      return false;
    }
    
    return level <= this.config.level;
  }

  /**
   * Log une erreur (toujours affiché)
   */
  error(tag: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      if (data !== undefined) {
        console.error(`${tag} ${message}`, data);
      } else {
        console.error(`${tag} ${message}`);
      }
    }
  }

  /**
   * Log un avertissement (toujours affiché)
   */
  warn(tag: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      if (data !== undefined) {
        console.warn(`${tag} ${message}`, data);
      } else {
        console.warn(`${tag} ${message}`);
      }
    }
  }

  /**
   * Log une information (uniquement en développement)
   */
  info(tag: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      if (data !== undefined) {
      } else {
      }
    }
  }

  /**
   * Log de débogage (uniquement en développement)
   */
  debug(tag: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      if (data !== undefined) {
      } else {
      }
    }
  }

  /**
   * Log simple pour maintenir la compatibilité avec console.log
   * (uniquement en développement)
   */
  log(message: string, ...args: any[]): void {
    if (this.config.enabled) {
    }
  }
}

export const logger = new Logger();

/**
 * Helper pour vérifier si on est en mode développement
 */
export const isDevelopment = process.env.NODE_ENV === 'development';
