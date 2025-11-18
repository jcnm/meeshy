/**
 * Protocol Adapter Manager
 *
 * Centralizes management of protocol adapters
 * Supports multiple protocols: WhatsApp, iMessage, Signal, Telegram, etc.
 */

import { IProtocolAdapter, ProtocolAdapterConfig } from '../adapters/ProtocolAdapter';
import { WhatsAppDMAAdapter } from '../adapters/WhatsAppDMAAdapter';

type ProtocolType = 'whatsapp-dma' | 'imessage' | 'signal' | 'telegram' | string;

export class ProtocolAdapterManager {
  private adapters: Map<ProtocolType, IProtocolAdapter> = new Map();
  private configs: Map<ProtocolType, ProtocolAdapterConfig> = new Map();

  constructor() {
    this.registerDefaultAdapters();
  }

  /**
   * Register built-in protocol adapters
   */
  private registerDefaultAdapters(): void {
    this.adapters.set('whatsapp-dma', new WhatsAppDMAAdapter());
  }

  /**
   * Register a custom protocol adapter
   */
  registerAdapter(protocol: ProtocolType, adapter: IProtocolAdapter): void {
    this.adapters.set(protocol, adapter);
  }

  /**
   * Configure a protocol adapter
   */
  async configureAdapter(
    protocol: ProtocolType,
    config: ProtocolAdapterConfig
  ): Promise<void> {
    const adapter = this.adapters.get(protocol);

    if (!adapter) {
      throw new Error(`Unknown protocol adapter: ${protocol}`);
    }

    await adapter.configure(config);
    this.configs.set(protocol, config);
  }

  /**
   * Get a configured adapter by protocol
   */
  getAdapter(protocol: ProtocolType): IProtocolAdapter | null {
    const adapter = this.adapters.get(protocol);
    if (adapter && adapter.isConfigured()) {
      return adapter;
    }
    return null;
  }

  /**
   * Get all configured adapters
   */
  getConfiguredAdapters(): Map<ProtocolType, IProtocolAdapter> {
    const configured = new Map<ProtocolType, IProtocolAdapter>();

    for (const [protocol, adapter] of this.adapters) {
      if (adapter.isConfigured()) {
        configured.set(protocol, adapter);
      }
    }

    return configured;
  }

  /**
   * Check if a protocol is supported
   */
  isProtocolSupported(protocol: ProtocolType): boolean {
    return this.adapters.has(protocol);
  }

  /**
   * Check if a protocol is configured
   */
  isProtocolConfigured(protocol: ProtocolType): boolean {
    const adapter = this.adapters.get(protocol);
    return adapter ? adapter.isConfigured() : false;
  }

  /**
   * Verify connection for a protocol
   */
  async verifyConnection(protocol: ProtocolType): Promise<boolean> {
    const adapter = this.getAdapter(protocol);
    if (!adapter) {
      return false;
    }

    return adapter.verifyConnection();
  }

  /**
   * Disconnect a protocol adapter
   */
  async disconnectAdapter(protocol: ProtocolType): Promise<void> {
    const adapter = this.adapters.get(protocol);
    if (adapter) {
      await adapter.disconnect();
      this.configs.delete(protocol);
    }
  }

  /**
   * Get configuration for a protocol
   */
  getConfig(protocol: ProtocolType): ProtocolAdapterConfig | null {
    return this.configs.get(protocol) || null;
  }

  /**
   * Get all configured protocols
   */
  getConfiguredProtocols(): ProtocolType[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get adapter statistics
   */
  getStatistics(): {
    supported: string[];
    configured: string[];
    available: string[];
  } {
    const supported = Array.from(this.adapters.keys());
    const configured = this.getConfiguredProtocols();
    const available = Array.from(this.getConfiguredAdapters().keys());

    return { supported, configured, available };
  }
}

// Singleton instance
let instance: ProtocolAdapterManager | null = null;

export function getProtocolAdapterManager(): ProtocolAdapterManager {
  if (!instance) {
    instance = new ProtocolAdapterManager();
  }
  return instance;
}

export function resetProtocolAdapterManager(): void {
  instance = null;
}
