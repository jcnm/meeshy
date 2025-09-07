/**
 * Tests pour le service de notifications de messages
 */

import { PrismaClient } from '@prisma/client';
import { MessageNotificationService } from '../src/services/MessageNotificationService';
import { MeeshySocketIOManager } from '../src/socketio/MeeshySocketIOManager';

// Mock des dépendances
jest.mock('@prisma/client');
jest.mock('../src/socketio/MeeshySocketIOManager');

describe('MessageNotificationService', () => {
  let service: MessageNotificationService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockSocketManager: jest.Mocked<MeeshySocketIOManager>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockSocketManager = new MeeshySocketIOManager({} as any, mockPrisma) as jest.Mocked<MeeshySocketIOManager>;
    service = new MessageNotificationService(mockPrisma, mockSocketManager);
  });

  describe('sendMessageNotification', () => {
    it('devrait envoyer une notification pour un message d\'utilisateur authentifié', async () => {
      // Mock des données
      const messageId = 'msg-123';
      const conversationId = 'conv-456';
      const senderId = 'user-789';
      
      const mockMessage = {
        id: messageId,
        content: 'Bonjour, comment allez-vous ?',
        conversationId,
        createdAt: new Date(),
        sender: {
          id: senderId,
          username: 'jean.dupont',
          firstName: 'Jean',
          lastName: 'Dupont',
          displayName: 'Jean Dupont'
        },
        anonymousSender: null,
        conversation: {
          id: conversationId,
          type: 'direct',
          title: 'Conversation directe'
        },
        translations: [
          {
            targetLanguage: 'en',
            translatedContent: 'Hello, how are you?'
          },
          {
            targetLanguage: 'es',
            translatedContent: 'Hola, ¿cómo estás?'
          }
        ]
      };

      const mockParticipants = [
        { id: 'user-111', isAnonymous: false },
        { id: 'user-222', isAnonymous: false }
      ];

      // Mock des méthodes Prisma
      mockPrisma.message.findUnique.mockResolvedValue(mockMessage as any);
      mockPrisma.conversationMember.findMany.mockResolvedValue([
        { user: { id: 'user-111', isActive: true } },
        { user: { id: 'user-222', isActive: true } }
      ] as any);
      mockPrisma.anonymousParticipant.findMany.mockResolvedValue([]);

      // Mock des méthodes SocketIO
      mockSocketManager.isUserConnected.mockReturnValue(true);
      mockSocketManager.sendToUser.mockImplementation(() => true);

      // Exécuter le test
      await service.sendMessageNotification(messageId, conversationId, senderId, false);

      // Vérifications
      expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: messageId },
        include: expect.any(Object)
      });

      expect(mockSocketManager.sendToUser).toHaveBeenCalledTimes(2);
      expect(mockSocketManager.sendToUser).toHaveBeenCalledWith(
        'user-111',
        'newMessageNotification',
        expect.objectContaining({
          messageId,
          senderId,
          senderName: 'Jean Dupont',
          content: 'Bonjour, comment allez-vous ?',
          conversationId,
          conversationType: 'direct',
          translations: {
            en: 'Hello, how are you?',
            es: 'Hola, ¿cómo estás?'
          }
        })
      );
    });

    it('devrait envoyer une notification pour un message de participant anonyme', async () => {
      // Mock des données
      const messageId = 'msg-123';
      const conversationId = 'conv-456';
      const senderId = 'anon-789';
      
      const mockMessage = {
        id: messageId,
        content: 'Salut !',
        conversationId,
        createdAt: new Date(),
        sender: null,
        anonymousSender: {
          id: senderId,
          displayName: 'Invité'
        },
        conversation: {
          id: conversationId,
          type: 'direct',
          title: 'Conversation directe'
        },
        translations: []
      };

      const mockParticipants = [
        { id: 'user-111', isAnonymous: false }
      ];

      // Mock des méthodes Prisma
      mockPrisma.message.findUnique.mockResolvedValue(mockMessage as any);
      mockPrisma.conversationMember.findMany.mockResolvedValue([
        { user: { id: 'user-111', isActive: true } }
      ] as any);
      mockPrisma.anonymousParticipant.findMany.mockResolvedValue([]);

      // Mock des méthodes SocketIO
      mockSocketManager.isUserConnected.mockReturnValue(true);
      mockSocketManager.sendToUser.mockImplementation(() => true);

      // Exécuter le test
      await service.sendMessageNotification(messageId, conversationId, senderId, true);

      // Vérifications
      expect(mockSocketManager.sendToUser).toHaveBeenCalledWith(
        'user-111',
        'newMessageNotification',
        expect.objectContaining({
          messageId,
          senderId,
          senderName: 'Invité',
          content: 'Salut !',
          conversationId,
          conversationType: 'direct'
        })
      );
    });

    it('ne devrait pas envoyer de notification à l\'expéditeur', async () => {
      // Mock des données
      const messageId = 'msg-123';
      const conversationId = 'conv-456';
      const senderId = 'user-789';
      
      const mockMessage = {
        id: messageId,
        content: 'Message test',
        conversationId,
        createdAt: new Date(),
        sender: {
          id: senderId,
          username: 'jean.dupont',
          displayName: 'Jean Dupont'
        },
        anonymousSender: null,
        conversation: {
          id: conversationId,
          type: 'direct',
          title: 'Conversation directe'
        },
        translations: []
      };

      // Mock des méthodes Prisma
      mockPrisma.message.findUnique.mockResolvedValue(mockMessage as any);
      mockPrisma.conversationMember.findMany.mockResolvedValue([
        { user: { id: senderId, isActive: true } }, // L'expéditeur
        { user: { id: 'user-111', isActive: true } } // Un autre participant
      ] as any);
      mockPrisma.anonymousParticipant.findMany.mockResolvedValue([]);

      // Mock des méthodes SocketIO
      mockSocketManager.isUserConnected.mockReturnValue(true);
      mockSocketManager.sendToUser.mockImplementation(() => true);

      // Exécuter le test
      await service.sendMessageNotification(messageId, conversationId, senderId, false);

      // Vérifications - ne devrait être appelé qu'une seule fois (pour user-111, pas pour senderId)
      expect(mockSocketManager.sendToUser).toHaveBeenCalledTimes(1);
      expect(mockSocketManager.sendToUser).toHaveBeenCalledWith(
        'user-111',
        'newMessageNotification',
        expect.any(Object)
      );
    });
  });

  describe('sendTranslationNotification', () => {
    it('devrait envoyer une notification de traduction', async () => {
      // Mock des données
      const messageId = 'msg-123';
      const conversationId = 'conv-456';
      const translations = {
        fr: 'Bonjour',
        en: 'Hello',
        es: 'Hola'
      };

      const mockMessage = {
        id: messageId,
        content: 'Bonjour',
        conversationId,
        createdAt: new Date(),
        sender: {
          id: 'user-789',
          username: 'jean.dupont',
          displayName: 'Jean Dupont'
        },
        anonymousSender: null,
        conversation: {
          type: 'direct'
        }
      };

      // Mock des méthodes Prisma
      mockPrisma.message.findUnique.mockResolvedValue(mockMessage as any);
      mockPrisma.conversationMember.findMany.mockResolvedValue([
        { user: { id: 'user-111', isActive: true } }
      ] as any);
      mockPrisma.anonymousParticipant.findMany.mockResolvedValue([]);

      // Mock des méthodes SocketIO
      mockSocketManager.isUserConnected.mockReturnValue(true);
      mockSocketManager.sendToUser.mockImplementation(() => true);

      // Exécuter le test
      await service.sendTranslationNotification(messageId, conversationId, translations);

      // Vérifications
      expect(mockSocketManager.sendToUser).toHaveBeenCalledWith(
        'user-111',
        'newMessageNotification',
        expect.objectContaining({
          messageId,
          translations
        })
      );
    });
  });
});

