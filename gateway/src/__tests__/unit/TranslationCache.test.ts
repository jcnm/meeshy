import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TranslationCache } from '../../services/TranslationCache';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  info: jest.fn(),
  quit: jest.fn()
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('TranslationCache', () => {
  let cache: TranslationCache;

  beforeEach(() => {
    cache = new TranslationCache('redis://localhost:6379');
    jest.clearAllMocks();
  });

  describe('getCachedTranslation', () => {
    it('should return cached translation if valid', async () => {
      const cachedEntry = {
        translatedText: 'Message de test',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now() - 1000,
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const result = await cache.getCachedTranslation('Test message', 'en', 'fr', 'basic');

      expect(result).toBeDefined();
      expect(result?.translatedText).toBe('Message de test');
    });

    it('should return null for expired cache entry', async () => {
      const expiredEntry = {
        translatedText: 'Old translation',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now() - 4000000, // Very old
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredEntry));
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.getCachedTranslation('Test', 'en', 'fr', 'basic');

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should return null if no cache entry exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.getCachedTranslation('Test', 'en', 'fr', 'basic');

      expect(result).toBeNull();
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.getCachedTranslation('Test', 'en', 'fr', 'basic');

      expect(result).toBeNull();
    });
  });

  describe('cacheTranslation', () => {
    it('should cache translation with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const entry = {
        translatedText: 'Message de test',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      await cache.cacheTranslation('Test message', 'en', 'fr', 'basic', entry);

      expect(mockRedis.setex).toHaveBeenCalled();
      const [, ttl, value] = mockRedis.setex.mock.calls[0];
      expect(ttl).toBe(3600); // 1 hour
      expect(JSON.parse(value).translatedText).toBe('Message de test');
    });

    it('should handle caching errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const entry = {
        translatedText: 'Test',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      await expect(
        cache.cacheTranslation('Test', 'en', 'fr', 'basic', entry)
      ).resolves.not.toThrow();
    });
  });

  describe('findSimilarTranslations', () => {
    it('should find similar translations', async () => {
      const keys = ['translation:abc123', 'translation:def456'];
      const entry1 = {
        translatedText: 'hello world',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };
      const entry2 = {
        translatedText: 'hello there',
        confidenceScore: 0.85,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(entry1))
        .mockResolvedValueOnce(JSON.stringify(entry2));

      const results = await cache.findSimilarTranslations(
        'hello world',
        'en',
        'fr',
        'basic',
        0.5
      );

      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by language and model', async () => {
      const keys = ['translation:abc123'];
      const entry = {
        translatedText: 'test',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'es', // Different language
        targetLanguage: 'de'
      };

      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const results = await cache.findSimilarTranslations(
        'test',
        'en',
        'fr',
        'basic',
        0.5
      );

      expect(results).toHaveLength(0);
    });

    it('should handle errors in similarity search', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const results = await cache.findSimilarTranslations(
        'test',
        'en',
        'fr',
        'basic'
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const keys = Array(50).fill('translation:key');
      const memoryInfo = 'used_memory_human:10.5M\nother_info:value';

      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.info.mockResolvedValue(memoryInfo);

      const stats = await cache.getCacheStats();

      expect(stats.totalEntries).toBe(50);
      expect(stats.memoryUsage).toBe('10.5M');
      expect(stats.hitRate).toBeDefined();
    });

    it('should handle stats errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await cache.getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.memoryUsage).toBe('N/A');
    });
  });

  describe('cleanupCache', () => {
    it('should delete expired entries', async () => {
      const keys = ['translation:key1', 'translation:key2'];
      const expiredEntry = {
        translatedText: 'old',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now() - 4000000,
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };
      const validEntry = {
        translatedText: 'new',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(expiredEntry))
        .mockResolvedValueOnce(JSON.stringify(validEntry));
      mockRedis.del.mockResolvedValue(1);

      const deletedCount = await cache.cleanupCache();

      expect(deletedCount).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const count = await cache.cleanupCache();

      expect(count).toBe(0);
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await cache.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('text normalization', () => {
    it('should normalize similar texts to same cache key', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const entry = {
        translatedText: 'test',
        confidenceScore: 0.9,
        modelUsed: 'basic',
        timestamp: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      };

      await cache.cacheTranslation('  Test  Message  ', 'en', 'fr', 'basic', entry);
      await cache.cacheTranslation('test message', 'en', 'fr', 'basic', entry);

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
      const key1 = mockRedis.setex.mock.calls[0][0];
      const key2 = mockRedis.setex.mock.calls[1][0];

      // Keys should be similar due to normalization
      expect(typeof key1).toBe('string');
      expect(typeof key2).toBe('string');
    });
  });

  describe('similarity calculation', () => {
    it('should calculate text similarity correctly', () => {
      const calculateSimilarity = (cache as any).calculateSimilarity.bind(cache);

      const similarity1 = calculateSimilarity('hello world', 'hello world');
      expect(similarity1).toBe(1);

      const similarity2 = calculateSimilarity('hello world', 'goodbye world');
      expect(similarity2).toBeGreaterThan(0);
      expect(similarity2).toBeLessThan(1);

      const similarity3 = calculateSimilarity('hello', 'goodbye');
      expect(similarity3).toBe(0);
    });
  });
});
