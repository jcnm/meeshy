/**
 * Tests unitaires pour utils/normalize.ts
 * Tests de toutes les fonctions de normalisation
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeEmail,
  normalizeUsername,
  capitalizeName,
  normalizeDisplayName,
  normalizeUserData,
} from '../../utils/normalize';

describe('normalize utils', () => {
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('should handle already normalized email', () => {
      expect(normalizeEmail('test@example.com')).toBe('test@example.com');
    });

    it('should handle empty string', () => {
      expect(normalizeEmail('')).toBe('');
    });

    it('should handle email with spaces around', () => {
      expect(normalizeEmail('\t  Test@Example.COM  \n')).toBe('test@example.com');
    });
  });

  describe('normalizeUsername', () => {
    it('should convert username to lowercase', () => {
      expect(normalizeUsername('JohnDoe')).toBe('johndoe');
    });

    it('should trim whitespace', () => {
      expect(normalizeUsername('  johndoe  ')).toBe('johndoe');
    });

    it('should handle already normalized username', () => {
      expect(normalizeUsername('johndoe')).toBe('johndoe');
    });

    it('should handle username with numbers', () => {
      expect(normalizeUsername('User123')).toBe('user123');
    });

    it('should handle username with underscores', () => {
      expect(normalizeUsername('John_Doe_123')).toBe('john_doe_123');
    });
  });

  describe('capitalizeName', () => {
    it('should capitalize first letter of single word', () => {
      expect(capitalizeName('john')).toBe('John');
    });

    it('should capitalize first letter and lowercase rest', () => {
      expect(capitalizeName('JOHN')).toBe('John');
    });

    it('should handle already capitalized name', () => {
      expect(capitalizeName('John')).toBe('John');
    });

    it('should handle multiple words (full name)', () => {
      expect(capitalizeName('john doe')).toBe('John Doe');
    });

    it('should handle mixed case multiple words', () => {
      expect(capitalizeName('jOhN dOe')).toBe('John Doe');
    });

    it('should trim whitespace', () => {
      expect(capitalizeName('  john  ')).toBe('John');
    });

    it('should handle hyphenated names', () => {
      expect(capitalizeName('jean-paul')).toBe('Jean-paul');
    });

    it('should handle names with apostrophes', () => {
      expect(capitalizeName("o'connor")).toBe("O'connor");
    });

    it('should handle empty string', () => {
      expect(capitalizeName('')).toBe('');
    });

    it('should handle single letter', () => {
      expect(capitalizeName('a')).toBe('A');
    });

    it('should handle multiple spaces between words', () => {
      expect(capitalizeName('john  doe')).toBe('John  Doe');
    });
  });

  describe('normalizeDisplayName', () => {
    it('should convert display name to lowercase', () => {
      expect(normalizeDisplayName('John Doe')).toBe('john doe');
    });

    it('should trim whitespace', () => {
      expect(normalizeDisplayName('  john doe  ')).toBe('john doe');
    });

    it('should handle already normalized display name', () => {
      expect(normalizeDisplayName('john doe')).toBe('john doe');
    });

    it('should handle mixed case', () => {
      expect(normalizeDisplayName('JoHn DoE')).toBe('john doe');
    });
  });

  describe('normalizeUserData', () => {
    it('should normalize all fields when provided', () => {
      const result = normalizeUserData({
        email: 'Test@Example.COM',
        username: 'JohnDoe',
        firstName: 'john',
        lastName: 'DOE',
        displayName: 'John Doe',
      });

      expect(result).toEqual({
        email: 'test@example.com',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'john doe',
      });
    });

    it('should handle partial data', () => {
      const result = normalizeUserData({
        email: 'Test@Example.COM',
        username: 'JohnDoe',
      });

      expect(result).toEqual({
        email: 'test@example.com',
        username: 'johndoe',
      });
    });

    it('should handle empty object', () => {
      const result = normalizeUserData({});

      expect(result).toEqual({});
    });

    it('should handle only email', () => {
      const result = normalizeUserData({
        email: 'Test@Example.COM',
      });

      expect(result).toEqual({
        email: 'test@example.com',
      });
    });

    it('should handle only username', () => {
      const result = normalizeUserData({
        username: 'JohnDoe',
      });

      expect(result).toEqual({
        username: 'johndoe',
      });
    });

    it('should handle only firstName and lastName', () => {
      const result = normalizeUserData({
        firstName: 'john',
        lastName: 'doe',
      });

      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should preserve undefined fields', () => {
      const result = normalizeUserData({
        email: 'Test@Example.COM',
        username: undefined,
      });

      expect(result).toEqual({
        email: 'test@example.com',
      });
      expect(result.username).toBeUndefined();
    });

    it('should handle whitespace in all fields', () => {
      const result = normalizeUserData({
        email: '  Test@Example.COM  ',
        username: '  JohnDoe  ',
        firstName: '  john  ',
        lastName: '  DOE  ',
        displayName: '  John Doe  ',
      });

      expect(result).toEqual({
        email: 'test@example.com',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'john doe',
      });
    });

    it('should handle compound first and last names', () => {
      const result = normalizeUserData({
        firstName: 'jean-paul',
        lastName: 'de la fontaine',
      });

      expect(result).toEqual({
        firstName: 'Jean-paul',
        lastName: 'De La Fontaine',
      });
    });

    it('should be idempotent (applying twice gives same result)', () => {
      const data = {
        email: 'Test@Example.COM',
        username: 'JohnDoe',
        firstName: 'john',
        lastName: 'DOE',
        displayName: 'John Doe',
      };

      const result1 = normalizeUserData(data);
      const result2 = normalizeUserData(result1);

      expect(result1).toEqual(result2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in email', () => {
      expect(normalizeEmail('Test+Tag@Example.COM')).toBe('test+tag@example.com');
    });

    it('should handle Unicode characters in names', () => {
      expect(capitalizeName('françois')).toBe('François');
      expect(capitalizeName('josé')).toBe('José');
    });

    it('should handle very long inputs', () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      expect(normalizeEmail(longEmail.toUpperCase())).toBe(longEmail);
    });

    it('should handle names with numbers', () => {
      expect(capitalizeName('user123')).toBe('User123');
    });
  });
});
