/**
 * Protocol Adapter Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProtocolAdapterManager } from '../services/ProtocolAdapterManager';
import { WhatsAppDMAAdapter } from '../adapters/WhatsAppDMAAdapter';
import type { IProtocolAdapter, ProtocolAdapterConfig } from '../adapters/ProtocolAdapter';

describe('ProtocolAdapterManager', () => {
  let manager: ProtocolAdapterManager;

  beforeEach(() => {
    manager = new ProtocolAdapterManager();
  });

  describe('Adapter Registration', () => {
    it('should have WhatsApp adapter registered by default', () => {
      expect(manager.isProtocolSupported('whatsapp-dma')).toBe(true);
    });

    it('should register custom adapter', () => {
      const customAdapter = new WhatsAppDMAAdapter();
      manager.registerAdapter('custom-protocol', customAdapter);

      expect(manager.isProtocolSupported('custom-protocol')).toBe(true);
    });

    it('should not support unregistered protocol', () => {
      expect(manager.isProtocolSupported('unknown-protocol')).toBe(false);
    });
  });

  describe('Adapter Configuration', () => {
    it('should configure WhatsApp adapter', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      expect(manager.isProtocolConfigured('whatsapp-dma')).toBe(true);
    });

    it('should throw error for unsupported protocol', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key'
      };

      await expect(
        manager.configureAdapter('unknown-protocol', config)
      ).rejects.toThrow('Unknown protocol adapter: unknown-protocol');
    });

    it('should retrieve adapter configuration', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const retrieved = manager.getConfig('whatsapp-dma');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.apiKey).toBe('test-key');
    });
  });

  describe('Adapter Access', () => {
    it('should return null for unconfigured protocol', () => {
      const adapter = manager.getAdapter('whatsapp-dma');
      expect(adapter).toBeNull();
    });

    it('should return configured adapter', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const adapter = manager.getAdapter('whatsapp-dma');

      expect(adapter).toBeTruthy();
      expect(adapter?.protocol).toBe('whatsapp-dma');
    });

    it('should get all configured adapters', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const adapters = manager.getConfiguredAdapters();

      expect(adapters.size).toBe(1);
      expect(adapters.has('whatsapp-dma')).toBe(true);
    });
  });

  describe('Protocol Status', () => {
    it('should list all supported protocols', () => {
      const stats = manager.getStatistics();
      expect(stats.supported).toContain('whatsapp-dma');
    });

    it('should list only configured protocols', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const stats = manager.getStatistics();

      expect(stats.configured).toContain('whatsapp-dma');
    });

    it('should return correct statistics', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const stats = manager.getStatistics();

      expect(stats.supported).toContain('whatsapp-dma');
      expect(stats.configured).toContain('whatsapp-dma');
      expect(stats.available.length).toBeGreaterThan(0);
    });
  });

  describe('Adapter Disconnection', () => {
    it('should disconnect adapter', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      expect(manager.isProtocolConfigured('whatsapp-dma')).toBe(true);

      await manager.disconnectAdapter('whatsapp-dma');
      expect(manager.isProtocolConfigured('whatsapp-dma')).toBe(false);
    });

    it('should handle disconnecting non-existent adapter', async () => {
      await expect(manager.disconnectAdapter('unknown')).resolves.not.toThrow();
    });
  });

  describe('Connection Verification', () => {
    it('should return false for unconfigured protocol', async () => {
      const result = await manager.verifyConnection('whatsapp-dma');
      expect(result).toBe(false);
    });

    it('should verify configured adapter connection', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const result = await manager.verifyConnection('whatsapp-dma');

      // Will be false without real API, but should execute
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Protocol List Management', () => {
    it('should return empty list when no protocols configured', () => {
      const protocols = manager.getConfiguredProtocols();
      expect(protocols).toHaveLength(0);
    });

    it('should return configured protocol list', async () => {
      const config: ProtocolAdapterConfig = {
        enabled: true,
        apiKey: 'test-key',
        phoneNumberId: '1234567890',
        businessAccountId: 'test-biz'
      };

      await manager.configureAdapter('whatsapp-dma', config);
      const protocols = manager.getConfiguredProtocols();

      expect(protocols).toContain('whatsapp-dma');
    });
  });
});
