/**
 * Logger - Production-ready logging system
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: string | number | boolean | undefined
}

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: LogContext
  error?: Error
}

export class Logger {
  private static instance: Logger
  private minLevel: LogLevel
  private context: LogContext

  private constructor() {
    this.minLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info')
    this.context = {}
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG
      case 'info': return LogLevel.INFO
      case 'warn': return LogLevel.WARN
      case 'error': return LogLevel.ERROR
      default: return LogLevel.INFO
    }
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  clearContext(): void {
    this.context = {}
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (level < this.minLevel) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: { ...this.context, ...context },
      error,
    }

    const formatted = this.format(entry)
    const output = level >= LogLevel.ERROR ? console.error : console.log

    output(formatted)
  }

  private format(entry: LogEntry): string {
    const levelName = LogLevel[entry.level]
    const timestamp = entry.timestamp.toISOString()

    const parts = [
      `[${timestamp}]`,
      `[${levelName}]`,
      entry.message,
    ]

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context))
    }

    if (entry.error) {
      parts.push(`\nError: ${entry.error.message}`)
      if (entry.error.stack) {
        parts.push(`\nStack: ${entry.error.stack}`)
      }
    }

    return parts.join(' ')
  }

  child(context: LogContext): Logger {
    const child = new Logger()
    child.minLevel = this.minLevel
    child.context = { ...this.context, ...context }
    return child
  }
}

export const logger = Logger.getInstance()
