/**
 * Custom Error Classes for AAMS
 */

export class AAMSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AAMSError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class PlatformError extends AAMSError {
  constructor(
    message: string,
    public readonly platformName: string,
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, 'PLATFORM_ERROR', recoverable, { ...context, platformName })
    this.name = 'PlatformError'
  }
}

export class NetworkError extends AAMSError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    recoverable: boolean = true
  ) {
    super(message, 'NETWORK_ERROR', recoverable, { statusCode })
    this.name = 'NetworkError'
  }
}

export class AuthenticationError extends AAMSError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', false)
    this.name = 'AuthenticationError'
  }
}

export class ConfigurationError extends AAMSError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', false)
    this.name = 'ConfigurationError'
  }
}

export class ValidationError extends AAMSError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR', false, { field })
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends AAMSError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_ERROR', true, { retryAfter })
    this.name = 'RateLimitError'
  }
}

export class MemoryError extends AAMSError {
  constructor(message: string) {
    super(message, 'MEMORY_ERROR', true)
    this.name = 'MemoryError'
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown, context?: Record<string, unknown>): AAMSError {
  if (error instanceof AAMSError) {
    return error
  }

  if (error instanceof Error) {
    return new AAMSError(error.message, 'UNKNOWN_ERROR', true, context)
  }

  return new AAMSError(String(error), 'UNKNOWN_ERROR', true, context)
}

/**
 * Retry logic with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options

  let lastError: Error | undefined
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError
      }

      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 2, maxDelay)
    }
  }

  throw lastError || new Error('Retry failed')
}
