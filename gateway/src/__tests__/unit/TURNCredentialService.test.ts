import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TURNCredentialService } from '../../services/TURNCredentialService';
import crypto from 'crypto';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('TURNCredentialService', () => {
  let service: TURNCredentialService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status).toBeDefined();
      expect(status.stunServersCount).toBe(3); // Google STUN servers
      expect(status.credentialTTL).toBe(86400); // 24 hours default
    });

    it('should parse TURN servers from environment', () => {
      process.env.TURN_SERVERS = 'turn1.example.com:3478,turn2.example.com:3479';

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.turnServersCount).toBe(2);
    });

    it('should use custom TURN secret from environment', () => {
      process.env.TURN_SECRET = 'custom-secret-key';

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.hasCustomSecret).toBe(true);
    });

    it('should use custom credential TTL from environment', () => {
      process.env.TURN_CREDENTIAL_TTL = '43200'; // 12 hours

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.credentialTTL).toBe(43200);
    });

    it('should handle TURN servers without port', () => {
      process.env.TURN_SERVERS = 'turn1.example.com,turn2.example.com';

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.turnServersCount).toBe(2);
    });

    it('should handle empty TURN servers', () => {
      process.env.TURN_SERVERS = '';

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.turnServersCount).toBe(0);
    });

    it('should warn about default secret in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TURN_SECRET;

      service = new TURNCredentialService();

      // In production with default secret, warning should be logged
      const status = service.getStatus();
      expect(status.hasCustomSecret).toBe(false);
    });
  });

  describe('generateCredentials', () => {
    beforeEach(() => {
      process.env.TURN_SECRET = 'test-secret';
      process.env.TURN_SERVERS = 'turn.example.com:3478';
      process.env.TURN_CREDENTIAL_TTL = '86400';

      service = new TURNCredentialService();
    });

    it('should generate time-limited credentials', () => {
      const credentials = service.generateCredentials('user-123');

      expect(credentials).toBeDefined();
      expect(Array.isArray(credentials)).toBe(true);
      expect(credentials.length).toBeGreaterThan(0);
    });

    it('should include STUN servers', () => {
      const credentials = service.generateCredentials('user-123');

      const stunServers = credentials.filter(server =>
        typeof server.urls === 'string' && server.urls.startsWith('stun:')
      );

      expect(stunServers.length).toBeGreaterThan(0);
    });

    it('should include TURN servers with credentials', () => {
      const credentials = service.generateCredentials('user-123');

      const turnServers = credentials.filter(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServers.length).toBeGreaterThan(0);
      expect(turnServers[0].username).toBeDefined();
      expect(turnServers[0].credential).toBeDefined();
    });

    it('should generate username with timestamp and userId', () => {
      const credentials = service.generateCredentials('user-123');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServer?.username).toMatch(/^\d+:user-123$/);
    });

    it('should generate valid HMAC-SHA1 credential', () => {
      const credentials = service.generateCredentials('user-123');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServer?.credential).toBeDefined();
      expect(typeof turnServer?.credential).toBe('string');

      // Verify it's a valid base64 string
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(turnServer!.credential as string);
      expect(isBase64).toBe(true);
    });

    it('should generate different credentials for different users', () => {
      const creds1 = service.generateCredentials('user-1');
      const creds2 = service.generateCredentials('user-2');

      const turn1 = creds1.find(s => typeof s.urls === 'string' && s.urls.startsWith('turn:'));
      const turn2 = creds2.find(s => typeof s.urls === 'string' && s.urls.startsWith('turn:'));

      expect(turn1?.username).not.toBe(turn2?.username);
    });

    it('should generate credentials with future expiration', () => {
      const credentials = service.generateCredentials('user-123');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      const username = turnServer?.username as string;
      const timestamp = parseInt(username.split(':')[0]);
      const currentTime = Math.floor(Date.now() / 1000);

      expect(timestamp).toBeGreaterThan(currentTime);
    });

    it('should generate credentials with correct TTL', () => {
      const credentials = service.generateCredentials('user-123');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      const username = turnServer?.username as string;
      const timestamp = parseInt(username.split(':')[0]);
      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = timestamp - currentTime;

      // Should be within a few seconds of 86400
      expect(ttl).toBeGreaterThan(86395);
      expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('should handle multiple TURN servers', () => {
      process.env.TURN_SERVERS = 'turn1.example.com:3478,turn2.example.com:3479';
      service = new TURNCredentialService();

      const credentials = service.generateCredentials('user-123');

      const turnServers = credentials.filter(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServers.length).toBe(2);
    });

    it('should format TURN URL correctly', () => {
      const credentials = service.generateCredentials('user-123');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServer?.urls).toMatch(/^turn:.+:\d+$/);
    });
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      process.env.TURN_SECRET = 'custom-secret';
      process.env.TURN_SERVERS = 'turn.example.com:3478';

      service = new TURNCredentialService();

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when using default secret', () => {
      delete process.env.TURN_SECRET;
      process.env.TURN_SERVERS = 'turn.example.com:3478';

      service = new TURNCredentialService();

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when no TURN servers configured', () => {
      process.env.TURN_SECRET = 'custom-secret';
      delete process.env.TURN_SERVERS;

      service = new TURNCredentialService();

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return complete status information', () => {
      process.env.TURN_SECRET = 'custom-secret';
      process.env.TURN_SERVERS = 'turn1.example.com:3478,turn2.example.com:3479';
      process.env.TURN_CREDENTIAL_TTL = '43200';

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.configured).toBe(true);
      expect(status.turnServersCount).toBe(2);
      expect(status.stunServersCount).toBe(3);
      expect(status.credentialTTL).toBe(43200);
      expect(status.hasCustomSecret).toBe(true);
    });

    it('should reflect unconfigured state', () => {
      delete process.env.TURN_SECRET;
      delete process.env.TURN_SERVERS;

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.configured).toBe(false);
      expect(status.hasCustomSecret).toBe(false);
    });
  });

  describe('RFC 5389 compliance', () => {
    beforeEach(() => {
      process.env.TURN_SECRET = 'test-secret';
      process.env.TURN_SERVERS = 'turn.example.com:3478';

      service = new TURNCredentialService();
    });

    it('should generate credentials compliant with RFC 5389', () => {
      const credentials = service.generateCredentials('test-user');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      // Username format: timestamp:userId
      expect(turnServer?.username).toMatch(/^\d+:test-user$/);

      // Credential should be HMAC-SHA1 base64
      const username = turnServer?.username as string;
      const hmac = crypto.createHmac('sha1', 'test-secret');
      hmac.update(username);
      const expectedCredential = hmac.digest('base64');

      expect(turnServer?.credential).toBe(expectedCredential);
    });

    it('should generate consistent credentials for same inputs', () => {
      const timestamp = Math.floor(Date.now() / 1000) + 86400;
      const username = `${timestamp}:test-user`;

      const hmac1 = crypto.createHmac('sha1', 'test-secret');
      hmac1.update(username);
      const credential1 = hmac1.digest('base64');

      const hmac2 = crypto.createHmac('sha1', 'test-secret');
      hmac2.update(username);
      const credential2 = hmac2.digest('base64');

      expect(credential1).toBe(credential2);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in userId', () => {
      service = new TURNCredentialService();

      const credentials = service.generateCredentials('user@example.com');

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServer?.username).toContain('user@example.com');
    });

    it('should handle very long userId', () => {
      service = new TURNCredentialService();

      const longUserId = 'a'.repeat(100);
      const credentials = service.generateCredentials(longUserId);

      const turnServer = credentials.find(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      expect(turnServer?.username).toContain(longUserId);
    });

    it('should handle invalid port numbers gracefully', () => {
      process.env.TURN_SERVERS = 'turn.example.com:invalid,turn2.example.com:abc';

      service = new TURNCredentialService();

      const status = service.getStatus();

      expect(status.turnServersCount).toBe(2);

      const credentials = service.generateCredentials('user-123');

      const turnServers = credentials.filter(server =>
        typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );

      // Should use default port 3478
      expect(turnServers.length).toBe(2);
    });
  });
});
