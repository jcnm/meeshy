/**
 * Tests unitaires pour utils/logger.ts
 * Tests du système de logging
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { logger, logError, logWarn } from '../../utils/logger';

describe('logger utils', () => {
  // Mock console methods
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('logger.info', () => {
    it('should not log info messages by default', () => {
      logger.info('Test info message');

      // info est vide dans le code (pas de console.log)
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should accept multiple arguments', () => {
      logger.info('Test', 'multiple', 'arguments');

      // Devrait ne pas planter
      expect(true).toBe(true);
    });

    it('should accept object arguments', () => {
      logger.info('Test object', { key: 'value' });

      // Devrait ne pas planter
      expect(true).toBe(true);
    });
  });

  describe('logger.error', () => {
    it('should log error messages to console', () => {
      logger.error('Test error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArg = consoleErrorSpy.mock.calls[0][0] as string;
      expect(callArg).toContain('ERROR');
      expect(callArg).toContain('Test error message');
    });

    it('should include timestamp in error logs', () => {
      logger.error('Error with timestamp');

      const callArg = consoleErrorSpy.mock.calls[0][0] as string;
      expect(callArg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format additional arguments', () => {
      logger.error('Error with args', 'arg1', 123);

      const callArg = consoleErrorSpy.mock.calls[0][0] as string;
      expect(callArg).toContain('arg1');
      expect(callArg).toContain('123');
    });

    it('should stringify object arguments', () => {
      logger.error('Error with object', { key: 'value', num: 42 });

      const callArg = consoleErrorSpy.mock.calls[0][0] as string;
      expect(callArg).toContain('key');
      expect(callArg).toContain('value');
    });

    it('should handle multiple object arguments', () => {
      logger.error('Multiple objects', { a: 1 }, { b: 2 });

      const callArg = consoleErrorSpy.mock.calls[0][0] as string;
      expect(callArg).toContain('"a":1');
      expect(callArg).toContain('"b":2');
    });
  });

  describe('logger.warn', () => {
    it('should log warning messages to console', () => {
      logger.warn('Test warning message');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const callArg = consoleWarnSpy.mock.calls[0][0] as string;
      expect(callArg).toContain('WARN');
      expect(callArg).toContain('Test warning message');
    });

    it('should include timestamp in warning logs', () => {
      logger.warn('Warning with timestamp');

      const callArg = consoleWarnSpy.mock.calls[0][0] as string;
      expect(callArg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format additional arguments', () => {
      logger.warn('Warning with args', 'arg1', true);

      const callArg = consoleWarnSpy.mock.calls[0][0] as string;
      expect(callArg).toContain('arg1');
      expect(callArg).toContain('true');
    });
  });

  describe('logger.debug', () => {
    it('should not log debug messages in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.DEBUG;

      logger.debug('Test debug message');

      // debug est vide en production
      expect(consoleLogSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug messages when DEBUG=false', () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'false';

      logger.debug('Test debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();

      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug;
      } else {
        delete process.env.DEBUG;
      }
    });

    it('should accept multiple arguments without crashing', () => {
      logger.debug('Debug', 'with', 'args');

      // Devrait ne pas planter
      expect(true).toBe(true);
    });
  });

  describe('logError utility', () => {
    it('should log error with Fastify-compatible logger', () => {
      const mockLogger = {
        error: jest.fn(),
      };

      logError(mockLogger, 'Test error', new Error('Error details'));

      expect(mockLogger.error).toHaveBeenCalledWith('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error details');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error'));
    });

    it('should log error message from Error object', () => {
      const mockLogger = {
        error: jest.fn(),
      };
      const error = new Error('Custom error message');

      logError(mockLogger, 'Error occurred', error);

      expect(mockLogger.error).toHaveBeenCalledWith('Custom error message');
    });

    it('should log error stack trace', () => {
      const mockLogger = {
        error: jest.fn(),
      };
      const error = new Error('Error with stack');

      logError(mockLogger, 'Error occurred', error);

      const stackCall = mockLogger.error.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Error:')
      );
      expect(stackCall).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const mockLogger = {
        error: jest.fn(),
      };

      logError(mockLogger, 'Error occurred', 'Simple string error');

      expect(mockLogger.error).toHaveBeenCalledWith('Simple string error');
    });

    it('should fallback to console.error if logger not provided', () => {
      logError(null, 'Test error', new Error('Details'));

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should fallback to console.error if logger.error is not a function', () => {
      const mockLogger = {
        error: 'not a function',
      };

      logError(mockLogger as any, 'Test error', new Error('Details'));

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle logger.error throwing exception', () => {
      const mockLogger = {
        error: jest.fn().mockImplementation(() => {
          throw new Error('Logger error');
        }),
      };

      // Should not throw, should fallback to console
      expect(() => {
        logError(mockLogger, 'Test error', new Error('Details'));
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('logWarn utility', () => {
    it('should log warning with Fastify-compatible logger', () => {
      const mockLogger = {
        warn: jest.fn(),
      };

      logWarn(mockLogger, 'Test warning', new Error('Warning details'));

      expect(mockLogger.warn).toHaveBeenCalledWith('Test warning');
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning details');
    });

    it('should log warning message from Error object', () => {
      const mockLogger = {
        warn: jest.fn(),
      };
      const error = new Error('Custom warning');

      logWarn(mockLogger, 'Warning occurred', error);

      expect(mockLogger.warn).toHaveBeenCalledWith('Custom warning');
    });

    it('should handle non-Error objects', () => {
      const mockLogger = {
        warn: jest.fn(),
      };

      logWarn(mockLogger, 'Warning occurred', 'Simple warning');

      expect(mockLogger.warn).toHaveBeenCalledWith('Simple warning');
    });

    it('should fallback to console.warn if logger not provided', () => {
      logWarn(null, 'Test warning', 'Details');

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should fallback to console.warn if logger.warn is not a function', () => {
      const mockLogger = {
        warn: 123,
      };

      logWarn(mockLogger as any, 'Test warning', 'Details');

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle logger.warn throwing exception', () => {
      const mockLogger = {
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Logger warn error');
        }),
      };

      // Should not throw, should fallback to console
      expect(() => {
        logWarn(mockLogger, 'Test warning', 'Details');
      }).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);
      logger.error(longMessage);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle special characters in messages', () => {
      logger.error('Message with \n newlines \t tabs');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle circular object references', () => {
      const obj: any = { a: 1 };
      obj.self = obj; // Circular reference

      // Should not throw
      expect(() => {
        logger.error('Circular object', obj);
      }).not.toThrow();
    });

    it('should handle undefined and null arguments', () => {
      logger.error('Message', undefined, null);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle array arguments', () => {
      logger.warn('Array args', [1, 2, 3], ['a', 'b']);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
