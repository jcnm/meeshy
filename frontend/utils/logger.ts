/**
 * Utilitaire de logging pour contrôler la verbosité des logs
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LoggerConfig {
  level: LogLevel;
  enableSocketIO: boolean;
  enableMessaging: boolean;
  enableTranslations: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Configuration basée sur l'environnement
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
    
    this.config = {
      level: isDevelopment || isDebugMode ? LogLevel.DEBUG : LogLevel.WARN,
      enableSocketIO: isDevelopment || isDebugMode,
      enableMessaging: isDevelopment || isDebugMode,
      enableTranslations: isDevelopment || isDebugMode
    };
  }

  private shouldLog(level: LogLevel, category?: string): boolean {
    if (level > this.config.level) return false;
    
    switch (category) {
      case 'socketio':
        return this.config.enableSocketIO;
      case 'messaging':
        return this.config.enableMessaging;
      case 'translations':
        return this.config.enableTranslations;
      default:
        return true;
    }
  }

  error(message: string, data?: any, category?: string): void {
    if (this.shouldLog(LogLevel.ERROR, category)) {
      console.error(`❌ ${message}`, data);
    }
  }

  warn(message: string, data?: any, category?: string): void {
    if (this.shouldLog(LogLevel.WARN, category)) {
      console.warn(`⚠️ ${message}`, data);
    }
  }

  info(message: string, data?: any, category?: string): void {
    if (this.shouldLog(LogLevel.INFO, category)) {
      console.log(`ℹ️ ${message}`, data);
    }
  }

  debug(message: string, data?: any, category?: string): void {
    if (this.shouldLog(LogLevel.DEBUG, category)) {
      console.log(`🔍 ${message}`, data);
    }
  }

  // Méthodes spécialisées pour les catégories courantes
  socketio = {
    error: (message: string, data?: any) => this.error(message, data, 'socketio'),
    warn: (message: string, data?: any) => this.warn(message, data, 'socketio'),
    info: (message: string, data?: any) => this.info(message, data, 'socketio'),
    debug: (message: string, data?: any) => this.debug(message, data, 'socketio')
  };

  messaging = {
    error: (message: string, data?: any) => this.error(message, data, 'messaging'),
    warn: (message: string, data?: any) => this.warn(message, data, 'messaging'),
    info: (message: string, data?: any) => this.info(message, data, 'messaging'),
    debug: (message: string, data?: any) => this.debug(message, data, 'messaging')
  };

  translations = {
    error: (message: string, data?: any) => this.error(message, data, 'translations'),
    warn: (message: string, data?: any) => this.warn(message, data, 'translations'),
    info: (message: string, data?: any) => this.info(message, data, 'translations'),
    debug: (message: string, data?: any) => this.debug(message, data, 'translations')
  };
}

export const logger = new Logger();
