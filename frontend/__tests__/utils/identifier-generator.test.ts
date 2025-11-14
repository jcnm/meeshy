/**
 * Tests unitaires pour le générateur d'identifiants
 */

import {
  generateIdentifier,
  validateIdentifier,
  generateShortIdentifier,
  generateFixedLengthIdentifier,
  extractBaseIdentifier
} from '@/utils/identifier-generator';

describe('identifier-generator', () => {
  describe('generateIdentifier', () => {
    it('devrait générer un identifiant à partir d\'un texte simple', () => {
      const result = generateIdentifier('Ma Super Conversation');

      // Doit contenir "ma-super-conversation" suivi d'un tiret et 6-10 caractères hex
      expect(result).toMatch(/^ma-super-conversation-[a-f0-9]{6,10}$/);
    });

    it('devrait normaliser les accents', () => {
      const result = generateIdentifier('Communauté Développeurs');

      // Les accents doivent être supprimés
      expect(result).toMatch(/^communaute-developpeurs-[a-f0-9]{6,10}$/);
    });

    it('devrait supprimer les caractères spéciaux', () => {
      const result = generateIdentifier('Test@#$%^&*()Conversation!!!');

      // Seuls les caractères alphanumériques et tirets doivent rester
      expect(result).toMatch(/^testconversation-[a-f0-9]{6,10}$/);
    });

    it('devrait remplacer les espaces par des tirets', () => {
      const result = generateIdentifier('Plusieurs   espaces   ici');

      // Les espaces multiples doivent être remplacés par un seul tiret
      expect(result).toMatch(/^plusieurs-espaces-ici-[a-f0-9]{6,10}$/);
    });

    it('devrait limiter la longueur de la base', () => {
      const longText = 'a'.repeat(100);
      const result = generateIdentifier(longText, 30);

      // La partie base ne doit pas dépasser 30 caractères (plus tiret + hex)
      expect(result.length).toBeLessThanOrEqual(30 + 1 + 10);
    });

    it('devrait retourner une chaîne vide pour un texte vide', () => {
      expect(generateIdentifier('')).toBe('');
      expect(generateIdentifier('   ')).toBe('');
    });

    it('devrait générer des identifiants uniques', () => {
      const id1 = generateIdentifier('Test');
      const id2 = generateIdentifier('Test');

      // Les suffixes doivent être différents (très haute probabilité)
      expect(id1).not.toBe(id2);
    });

    it('devrait accepter une longueur de base personnalisée', () => {
      const result = generateIdentifier('Super Long Titre', 10);

      // La partie base doit être tronquée à 10 caractères max
      const baseLength = result.lastIndexOf('-');
      expect(baseLength).toBeLessThanOrEqual(10);
    });

    it('devrait gérer les textes avec uniquement des caractères spéciaux', () => {
      const result = generateIdentifier('@#$%^&*()');

      // Doit retourner une chaîne vide car pas de caractères valides
      expect(result).toBe('');
    });

    it('devrait supprimer les tirets en début et fin', () => {
      const result = generateIdentifier('-test-conversation-');

      expect(result).toMatch(/^test-conversation-[a-f0-9]{6,10}$/);
    });

    it('devrait générer un suffixe hex entre 6 et 10 caractères', () => {
      const results = Array.from({ length: 20 }, () => generateIdentifier('test'));

      results.forEach(result => {
        const parts = result.split('-');
        const hexSuffix = parts[parts.length - 1];

        expect(hexSuffix.length).toBeGreaterThanOrEqual(6);
        expect(hexSuffix.length).toBeLessThanOrEqual(10);
        expect(hexSuffix).toMatch(/^[a-f0-9]+$/);
      });
    });
  });

  describe('validateIdentifier', () => {
    it('devrait valider un identifiant correct', () => {
      expect(validateIdentifier('ma-conversation-7f3a2b')).toBe(true);
      expect(validateIdentifier('lien-test-abc123def')).toBe(true);
      expect(validateIdentifier('test@user-123abc')).toBe(true);
      expect(validateIdentifier('test_user_123')).toBe(true);
    });

    it('devrait rejeter les identifiants avec espaces', () => {
      expect(validateIdentifier('ma conversation')).toBe(false);
    });

    it('devrait rejeter les identifiants avec caractères spéciaux', () => {
      expect(validateIdentifier('test!conversation')).toBe(false);
      expect(validateIdentifier('test#conversation')).toBe(false);
      expect(validateIdentifier('test$conversation')).toBe(false);
    });

    it('devrait rejeter les chaînes vides', () => {
      expect(validateIdentifier('')).toBe(false);
      expect(validateIdentifier('   ')).toBe(false);
    });

    it('devrait accepter les majuscules', () => {
      expect(validateIdentifier('MaConversation-ABC123')).toBe(true);
    });

    it('devrait accepter les underscores et arobase', () => {
      expect(validateIdentifier('user_name@domain-123')).toBe(true);
    });
  });

  describe('generateShortIdentifier', () => {
    it('devrait générer un identifiant de 6 caractères hex', () => {
      const result = generateShortIdentifier();

      expect(result).toMatch(/^[a-f0-9]{6}$/);
      expect(result.length).toBe(6);
    });

    it('devrait générer des identifiants uniques', () => {
      const id1 = generateShortIdentifier();
      const id2 = generateShortIdentifier();

      // Très haute probabilité qu'ils soient différents
      expect(id1).not.toBe(id2);
    });

    it('devrait générer plusieurs identifiants courts valides', () => {
      const results = Array.from({ length: 10 }, () => generateShortIdentifier());

      results.forEach(result => {
        expect(result).toMatch(/^[a-f0-9]{6}$/);
        expect(result.length).toBe(6);
      });
    });
  });

  describe('generateFixedLengthIdentifier', () => {
    it('devrait générer un identifiant de 8 caractères par défaut', () => {
      const result = generateFixedLengthIdentifier();

      expect(result).toMatch(/^[a-f0-9]{8}$/);
      expect(result.length).toBe(8);
    });

    it('devrait générer un identifiant de longueur spécifiée', () => {
      expect(generateFixedLengthIdentifier(6)).toMatch(/^[a-f0-9]{6}$/);
      expect(generateFixedLengthIdentifier(10)).toMatch(/^[a-f0-9]{10}$/);
      expect(generateFixedLengthIdentifier(12)).toMatch(/^[a-f0-9]{12}$/);
      expect(generateFixedLengthIdentifier(16)).toMatch(/^[a-f0-9]{16}$/);
    });

    it('devrait limiter la longueur minimale à 6', () => {
      const result = generateFixedLengthIdentifier(3);

      expect(result.length).toBe(6);
    });

    it('devrait limiter la longueur maximale à 16', () => {
      const result = generateFixedLengthIdentifier(20);

      expect(result.length).toBe(16);
    });

    it('devrait générer des identifiants uniques', () => {
      const results = Array.from({ length: 10 }, () => generateFixedLengthIdentifier(10));
      const unique = new Set(results);

      // Tous doivent être uniques
      expect(unique.size).toBe(10);
    });
  });

  describe('extractBaseIdentifier', () => {
    it('devrait extraire la partie base d\'un identifiant complet', () => {
      expect(extractBaseIdentifier('ma-conversation-7f3a2b')).toBe('ma-conversation');
      expect(extractBaseIdentifier('lien-test-abc123de')).toBe('lien-test');
    });

    it('devrait gérer les identifiants avec plusieurs tirets', () => {
      expect(extractBaseIdentifier('ma-super-conversation-7f3a2b')).toBe('ma-super-conversation');
      expect(extractBaseIdentifier('test-lien-partage-abc123def')).toBe('test-lien-partage');
    });

    it('devrait retourner l\'identifiant complet si pas de suffixe hex reconnu', () => {
      expect(extractBaseIdentifier('simple-identifier')).toBe('simple-identifier');
      expect(extractBaseIdentifier('test')).toBe('test');
    });

    it('devrait retourner une chaîne vide pour un identifiant vide', () => {
      expect(extractBaseIdentifier('')).toBe('');
    });

    it('devrait gérer les suffixes hex de différentes longueurs (6-10)', () => {
      expect(extractBaseIdentifier('test-7f3a2b')).toBe('test');
      expect(extractBaseIdentifier('test-7f3a2bc9')).toBe('test');
      expect(extractBaseIdentifier('test-7f3a2bc9d4')).toBe('test');
    });

    it('devrait ne pas extraire si le suffixe n\'est pas hex', () => {
      expect(extractBaseIdentifier('test-notahex')).toBe('test-notahex');
      expect(extractBaseIdentifier('test-12g456')).toBe('test-12g456');
    });

    it('devrait ne pas extraire si le suffixe est trop court', () => {
      expect(extractBaseIdentifier('test-abc')).toBe('test-abc');
      expect(extractBaseIdentifier('test-12345')).toBe('test-12345');
    });

    it('devrait ne pas extraire si le suffixe est trop long', () => {
      expect(extractBaseIdentifier('test-' + 'a'.repeat(11))).toBe('test-' + 'a'.repeat(11));
    });
  });

  describe('Intégration - Génération et validation', () => {
    it('devrait générer des identifiants valides', () => {
      const titles = [
        'Ma Conversation',
        'Lien Communauté',
        'Test Simple',
        'Développeurs Français',
        'Chat Équipe'
      ];

      titles.forEach(title => {
        const identifier = generateIdentifier(title);
        expect(validateIdentifier(identifier)).toBe(true);
      });
    });

    it('devrait pouvoir extraire la base d\'un identifiant généré', () => {
      const title = 'Test Conversation';
      const identifier = generateIdentifier(title);
      const base = extractBaseIdentifier(identifier);

      expect(base).toBe('test-conversation');
    });

    it('devrait générer des identifiants de longueur raisonnable', () => {
      const identifier = generateIdentifier('Test');

      // 4 chars (test) + 1 (tiret) + 6-10 (hex) = 11-15 chars
      expect(identifier.length).toBeGreaterThanOrEqual(11);
      expect(identifier.length).toBeLessThanOrEqual(15);
    });
  });

  describe('Cas limites et edge cases', () => {
    it('devrait gérer les textes avec des chiffres', () => {
      const result = generateIdentifier('Test123 456');
      expect(result).toMatch(/^test123-456-[a-f0-9]{6,10}$/);
    });

    it('devrait gérer les textes mixtes (majuscules/minuscules)', () => {
      const result = generateIdentifier('TeSt CoNvErSaTiOn');
      expect(result).toMatch(/^test-conversation-[a-f0-9]{6,10}$/);
    });

    it('devrait gérer les émojis et caractères Unicode', () => {
      const result = generateIdentifier('Test 🎉 Conversation 🚀');
      expect(result).toMatch(/^test-conversation-[a-f0-9]{6,10}$/);
    });

    it('devrait gérer les textes avec tirets multiples', () => {
      const result = generateIdentifier('test---conversation---lien');
      expect(result).toMatch(/^test-conversation-lien-[a-f0-9]{6,10}$/);
    });
  });
});
