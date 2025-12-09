/**
 * Tests pour les notifications de conversations directes
 */

import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '@/hooks/use-notifications';
import { buildMultilingualNotificationMessage, getNotificationTitle, getNotificationIcon } from '@/utils/notification-translations';

// Mock des dépendances
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  })),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Notifications pour conversations directes', () => {
  describe('buildMultilingualNotificationMessage', () => {
    it('devrait construire un message multilingue avec traductions', () => {
      const content = 'Bonjour, comment allez-vous ?';
      const translations = {
        fr: 'Bonjour, comment allez-vous ?',
        en: 'Hello, how are you?',
        es: 'Hola, ¿cómo estás?'
      };

      const result = buildMultilingualNotificationMessage(content, translations);
      
      expect(result).toContain('🇫🇷 Bonjour, comment allez-vous ?');
      expect(result).toContain('🇺🇸 Hello, how are you?');
      expect(result).toContain('🇪🇸 Hola, ¿cómo estás?');
    });

    it('devrait retourner le message original si pas de traductions', () => {
      const content = 'Message simple';
      const result = buildMultilingualNotificationMessage(content);
      
      expect(result).toBe('Message simple');
    });

    it('devrait tronquer les messages longs', () => {
      const longContent = 'Ceci est un message très long qui devrait être tronqué à trente caractères maximum';
      const result = buildMultilingualNotificationMessage(longContent);
      
      expect(result).toBe('Ceci est un message très long...');
    });
  });

  describe('getNotificationTitle', () => {
    it('devrait retourner le bon titre pour une conversation directe', () => {
      const title = getNotificationTitle('direct', 'Jean Dupont');
      expect(title).toBe('Message direct de Jean Dupont');
    });

    it('devrait retourner le bon titre pour une conversation de groupe', () => {
      const title = getNotificationTitle('group', 'Marie Martin');
      expect(title).toBe('Message de groupe de Marie Martin');
    });

    it('devrait retourner le bon titre pour une conversation publique', () => {
      const title = getNotificationTitle('public', 'Pierre Durand');
      expect(title).toBe('Message public de Pierre Durand');
    });
  });

  describe('getNotificationIcon', () => {
    it('devrait retourner la bonne icône pour chaque type de conversation', () => {
      expect(getNotificationIcon('direct')).toBe('💬');
      expect(getNotificationIcon('group')).toBe('👥');
      expect(getNotificationIcon('public')).toBe('🌐');
      expect(getNotificationIcon('global')).toBe('🌍');
    });
  });

  describe('useNotifications hook', () => {
    it('devrait initialiser correctement', () => {
      const { result } = renderHook(() => useNotifications());
      
      expect(result.current.notifications).toEqual([]);
      expect(result.current.isConnected).toBe(false);
      expect(typeof result.current.connectToNotifications).toBe('function');
      expect(typeof result.current.disconnectFromNotifications).toBe('function');
      expect(typeof result.current.markAsRead).toBe('function');
      expect(typeof result.current.clearAll).toBe('function');
    });

    it('devrait gérer les notifications de messages directs', async () => {
      const { result } = renderHook(() => useNotifications());
      
      // Simuler une notification de message direct
      const messageData = {
        messageId: 'msg-123',
        senderId: 'user-456',
        senderName: 'Jean Dupont',
        content: 'Salut ! Comment ça va ?',
        conversationId: 'conv-789',
        conversationType: 'direct',
        timestamp: new Date().toISOString(),
        translations: {
          fr: 'Salut ! Comment ça va ?',
          en: 'Hi! How are you?',
          es: '¡Hola! ¿Cómo estás?'
        }
      };

      // Connecter aux notifications
      await act(async () => {
        result.current.connectToNotifications('fake-token', 'current-user-id');
      });

      // Vérifier que la connexion est établie
      expect(result.current.isConnected).toBe(true);
    });
  });
});

