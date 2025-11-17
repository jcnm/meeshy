/**
 * Mocks de services avec comportements cohérents
 * Ces mocks simulent le comportement réel des services externes
 */

import { jest } from '@jest/globals';
import Redis from 'ioredis';

/**
 * Mock Redis avec un stockage en mémoire simulé
 */
export function createMockRedis(): jest.Mocked<Redis> {
  const storage = new Map<string, string>();
  const expirations = new Map<string, number>();

  const checkExpiration = (key: string): boolean => {
    const expiration = expirations.get(key);
    if (expiration && Date.now() > expiration) {
      storage.delete(key);
      expirations.delete(key);
      return true;
    }
    return false;
  };

  return {
    get: jest.fn().mockImplementation(async (key: string) => {
      if (checkExpiration(key)) return null;
      return storage.get(key) || null;
    }),
    set: jest.fn().mockImplementation(async (key: string, value: string, ...args: any[]) => {
      storage.set(key, value);

      // Handle EX (seconds) option
      if (args[0] === 'EX' && typeof args[1] === 'number') {
        const ttlMs = args[1] * 1000;
        expirations.set(key, Date.now() + ttlMs);
      }

      return 'OK';
    }),
    setex: jest.fn().mockImplementation(async (key: string, seconds: number, value: string) => {
      storage.set(key, value);
      expirations.set(key, Date.now() + seconds * 1000);
      return 'OK';
    }),
    del: jest.fn().mockImplementation(async (...keys: string[]) => {
      let deleted = 0;
      keys.forEach(key => {
        if (storage.delete(key)) deleted++;
        expirations.delete(key);
      });
      return deleted;
    }),
    exists: jest.fn().mockImplementation(async (...keys: string[]) => {
      let count = 0;
      keys.forEach(key => {
        if (!checkExpiration(key) && storage.has(key)) count++;
      });
      return count;
    }),
    expire: jest.fn().mockImplementation(async (key: string, seconds: number) => {
      if (!storage.has(key)) return 0;
      expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }),
    ttl: jest.fn().mockImplementation(async (key: string) => {
      const expiration = expirations.get(key);
      if (!expiration) return -1;
      const remaining = Math.ceil((expiration - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }),
    keys: jest.fn().mockImplementation(async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(storage.keys()).filter(key => regex.test(key));
    }),
    mget: jest.fn().mockImplementation(async (...keys: string[]) => {
      return keys.map(key => {
        if (checkExpiration(key)) return null;
        return storage.get(key) || null;
      });
    }),
    incr: jest.fn().mockImplementation(async (key: string) => {
      const current = parseInt(storage.get(key) || '0', 10);
      const newValue = current + 1;
      storage.set(key, newValue.toString());
      return newValue;
    }),
    decr: jest.fn().mockImplementation(async (key: string) => {
      const current = parseInt(storage.get(key) || '0', 10);
      const newValue = current - 1;
      storage.set(key, newValue.toString());
      return newValue;
    }),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    sadd: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    srem: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zrem: jest.fn().mockResolvedValue(1),
    flushall: jest.fn().mockImplementation(async () => {
      storage.clear();
      expirations.clear();
      return 'OK';
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn().mockReturnValue(true),
    // @ts-ignore - Mock minimum needed
    _storage: storage,
    _expirations: expirations,
  } as any;
}

/**
 * Mock ZMQ Socket avec files d'attente de messages
 */
export function createMockZMQSocket() {
  const sentMessages: any[] = [];
  const receivedMessages: any[] = [];

  return {
    send: jest.fn().mockImplementation(async (message: any) => {
      sentMessages.push(message);
      return Promise.resolve();
    }),
    receive: jest.fn().mockImplementation(async () => {
      if (receivedMessages.length > 0) {
        return receivedMessages.shift();
      }
      return null;
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    bind: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    // Helpers pour les tests
    _pushReceivedMessage: (msg: any) => receivedMessages.push(msg),
    _getSentMessages: () => [...sentMessages],
    _clearSentMessages: () => sentMessages.splice(0, sentMessages.length),
    _clearReceivedMessages: () => receivedMessages.splice(0, receivedMessages.length),
  };
}

/**
 * Mock Socket.IO pour WebSocket
 */
export function createMockSocketIO() {
  const emittedEvents: Array<{ event: string; data: any }> = [];

  return {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn().mockImplementation((event: string, data: any) => {
      emittedEvents.push({ event, data });
      return true;
    }),
    in: jest.fn().mockReturnThis(),
    except: jest.fn().mockReturnThis(),
    sockets: {
      emit: jest.fn().mockImplementation((event: string, data: any) => {
        emittedEvents.push({ event, data });
      }),
    },
    // Helpers
    _getEmittedEvents: () => [...emittedEvents],
    _clearEmittedEvents: () => emittedEvents.splice(0, emittedEvents.length),
    _findEvent: (eventName: string) => emittedEvents.find(e => e.event === eventName),
  };
}

/**
 * Mock Logger qui enregistre les logs pour vérification
 */
export function createMockLogger() {
  const logs: Array<{ level: string; message: string; meta?: any }> = [];

  return {
    info: jest.fn().mockImplementation((message: string, meta?: any) => {
      logs.push({ level: 'info', message, meta });
    }),
    warn: jest.fn().mockImplementation((message: string, meta?: any) => {
      logs.push({ level: 'warn', message, meta });
    }),
    error: jest.fn().mockImplementation((message: string, meta?: any) => {
      logs.push({ level: 'error', message, meta });
    }),
    debug: jest.fn().mockImplementation((message: string, meta?: any) => {
      logs.push({ level: 'debug', message, meta });
    }),
    // Helpers
    _getLogs: () => [...logs],
    _clearLogs: () => logs.splice(0, logs.length),
    _findLog: (message: string) => logs.find(log => log.message.includes(message)),
  };
}

/**
 * Mock TranslationService qui simule les traductions
 */
export function createMockTranslationService() {
  return {
    handleNewMessage: jest.fn().mockImplementation(async (messageId: string, content: string, originalLanguage: string) => {
      // Simuler une traduction
      return {
        status: 'pending',
        messageId,
        originalLanguage,
        translations: {
          en: content,
          fr: content.replace(/Hello/g, 'Bonjour'),
          es: content.replace(/Hello/g, 'Hola'),
        },
      };
    }),
    translateDirect: jest.fn().mockImplementation(async (content: string, targetLang: string) => {
      const translations: Record<string, string> = {
        en: content,
        fr: content.replace(/Hello/g, 'Bonjour'),
        es: content.replace(/Hello/g, 'Hola'),
      };
      return translations[targetLang] || content;
    }),
    retranslateMessage: jest.fn().mockResolvedValue({ status: 'success' }),
  };
}

/**
 * Mock MLS Service pour chiffrement
 */
export function createMockMLSService() {
  return {
    encryptMessage: jest.fn().mockImplementation(async (conversationId: string, plaintext: string) => {
      // Simuler un message chiffré E2E
      return {
        ciphertext: Buffer.from(plaintext).toString('base64'),
        encryptionMode: 'e2e_only' as const,
      };
    }),
    decryptMessage: jest.fn().mockImplementation(async (conversationId: string, ciphertext: string) => {
      // Simuler un déchiffrement
      return Buffer.from(ciphertext, 'base64').toString('utf8');
    }),
    getConversationEncryptionMode: jest.fn().mockResolvedValue('none' as const),
  };
}

/**
 * Mock ServerKeyManager pour chiffrement hybride
 */
export function createMockServerKeyManager() {
  return {
    encrypt: jest.fn().mockImplementation(async (plaintext: Buffer, nonce: Buffer, key: Buffer) => {
      // Simuler chiffrement AES-GCM
      return Buffer.concat([plaintext, Buffer.from('auth-tag')]);
    }),
    decrypt: jest.fn().mockImplementation(async (ciphertext: Buffer, nonce: Buffer, key: Buffer) => {
      // Simuler déchiffrement
      return ciphertext.subarray(0, -8); // Remove fake auth tag
    }),
    getConversationKey: jest.fn().mockImplementation(async (conversationId: string) => {
      return Buffer.from('a'.repeat(64), 'hex');
    }),
    secureWipe: jest.fn(),
    rotateConversationKey: jest.fn().mockResolvedValue('newEncryptedKey'),
  };
}
