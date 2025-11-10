/**
 * Platform Registry - Manages platform adapters
 */

import type { PlatformAdapter } from '../types/platform'
import { logger } from '../utils/logger'
import { ConfigurationError } from '../utils/errors'

export class PlatformRegistry {
  private static instance: PlatformRegistry
  private adapters = new Map<string, PlatformAdapter>()
  private log = logger.child({ component: 'PlatformRegistry' })

  private constructor() {}

  static getInstance(): PlatformRegistry {
    if (!PlatformRegistry.instance) {
      PlatformRegistry.instance = new PlatformRegistry()
    }
    return PlatformRegistry.instance
  }

  register(name: string, adapter: PlatformAdapter): void {
    if (this.adapters.has(name)) {
      throw new ConfigurationError(`Adapter '${name}' is already registered`)
    }

    this.adapters.set(name, adapter)
    this.log.info('Platform adapter registered', {
      name,
      platform: adapter.platformName,
      version: adapter.platformVersion,
    })
  }

  unregister(name: string): void {
    if (!this.adapters.has(name)) {
      throw new ConfigurationError(`Adapter '${name}' is not registered`)
    }

    this.adapters.delete(name)
    this.log.info('Platform adapter unregistered', { name })
  }

  get(name: string): PlatformAdapter {
    const adapter = this.adapters.get(name)
    if (!adapter) {
      throw new ConfigurationError(`Adapter '${name}' is not registered`)
    }
    return adapter
  }

  has(name: string): boolean {
    return this.adapters.has(name)
  }

  list(): string[] {
    return Array.from(this.adapters.keys())
  }

  async initializeAll(): Promise<void> {
    this.log.info('Initializing all adapters...')

    await Promise.all(
      Array.from(this.adapters.values()).map(adapter => adapter.initialize())
    )

    this.log.info('All adapters initialized')
  }

  async shutdownAll(): Promise<void> {
    this.log.info('Shutting down all adapters...')

    await Promise.all(
      Array.from(this.adapters.values()).map(adapter => adapter.shutdown())
    )

    this.log.info('All adapters shut down')
  }
}

export const platformRegistry = PlatformRegistry.getInstance()
