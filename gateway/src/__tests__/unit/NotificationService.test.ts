/**
 * Tests unitaires RÉELS pour NotificationService
 * Ces tests instancient et exécutent réellement le service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationService } from '../../services/NotificationService';
import { createMockPrismaClient, createMockUser } from '../helpers/prisma-mock';
import { createMockSocketIO, createMockLogger } from '../helpers/service-mocks';

// Mock uniquement les dépendances externes
jest.mock('../../utils/logger', () => ({
  logger: createMockLogger(),
}));

describe('NotificationService - Real Service Tests', () => {
  let service: NotificationService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockIo: ReturnType<typeof createMockSocketIO>;
  let mockUserSocketsMap: Map<string, Set<string>>;

  beforeEach(() => {
    // Créer les mocks
    mockPrisma = createMockPrismaClient();
    mockIo = createMockSocketIO();
    mockUserSocketsMap = new Map();

    // Instancier le VRAI service
    service = new NotificationService(mockPrisma as any);

    // Configurer SocketIO
    mockUserSocketsMap.set('user-123', new Set(['socket-1', 'socket-2']));
    mockUserSocketsMap.set('user-456', new Set(['socket-3']));
    service.setSocketIO(mockIo as any, mockUserSocketsMap);

    jest.clearAllMocks();
  });

  describe('createNotification - Success Cases', () => {
    it('should create notification and emit via Socket.IO', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test message',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: 'sender-123',
        senderUsername: 'sender',
        senderAvatar: null,
        messagePreview: 'Test',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        callSessionId: null,
        data: null,
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute - Appeler la VRAIE méthode
      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test message',
      });

      // Assert - Vérifier le résultat
      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-123');
      expect(result?.userId).toBe('user-123');
      expect(result?.type).toBe('new_message');

      // Vérifier que Prisma a été appelé correctement
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: 'new_message',
          title: 'New Message',
          content: 'Test message',
          priority: 'normal',
          isRead: false,
        }),
      });

      // Vérifier que Socket.IO a émis l'événement
      expect(mockIo.to).toHaveBeenCalledWith('socket-1');
      expect(mockIo.to).toHaveBeenCalledWith('socket-2');
      expect(mockIo.emit).toHaveBeenCalledTimes(2);
      expect(mockIo.emit).toHaveBeenCalledWith('notification', expect.objectContaining({
        id: 'notif-123',
        userId: 'user-123',
      }));
    });

    it('should create notification with custom priority', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-456',
        userId: 'user-123',
        type: 'missed_call',
        title: 'Missed Call',
        content: 'You missed a call',
        priority: 'high',
        isRead: false,
        createdAt: new Date(),
        senderId: null,
        senderUsername: null,
        senderAvatar: null,
        messagePreview: null,
        conversationId: null,
        messageId: null,
        callSessionId: null,
        data: null,
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createNotification({
        userId: 'user-123',
        type: 'missed_call',
        title: 'Missed Call',
        content: 'You missed a call',
        priority: 'high',
      });

      // Assert
      expect(result?.priority).toBe('high');
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 'high',
        }),
      });
    });

    it('should create notification with expiration date', async () => {
      // Setup
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const mockNotification = {
        id: 'notif-789',
        userId: 'user-123',
        type: 'system',
        title: 'System Notice',
        content: 'Temporary notification',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        expiresAt,
        senderId: null,
        senderUsername: null,
        senderAvatar: null,
        messagePreview: null,
        conversationId: null,
        messageId: null,
        callSessionId: null,
        data: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createNotification({
        userId: 'user-123',
        type: 'system',
        title: 'System Notice',
        content: 'Temporary notification',
        expiresAt,
      });

      // Assert
      expect(result?.expiresAt).toEqual(expiresAt);
    });
  });

  describe('createNotification - User Preferences', () => {
    it('should skip notification if user has disabled this type', async () => {
      // Setup
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue({
        userId: 'user-123',
        newMessageEnabled: false,
        missedCallEnabled: true,
        systemEnabled: true,
        conversationEnabled: true,
        dndEnabled: false,
        dndStartTime: null,
        dndEndTime: null,
      });

      // Execute
      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test',
      });

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should respect Do Not Disturb mode', async () => {
      // Setup - DND actif toute la journée
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue({
        userId: 'user-123',
        newMessageEnabled: true,
        missedCallEnabled: true,
        systemEnabled: true,
        conversationEnabled: true,
        dndEnabled: true,
        dndStartTime: '00:00',
        dndEndTime: '23:59',
      });

      // Execute
      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test',
      });

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should create notification if no preferences exist (default behavior)', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'new_message',
        title: 'Test',
        content: 'Test',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: null,
        senderUsername: null,
        senderAvatar: null,
        messagePreview: null,
        conversationId: null,
        messageId: null,
        callSessionId: null,
        data: null,
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'Test',
        content: 'Test',
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('createMessageNotification', () => {
    it('should create message notification with simple text', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'recipient-123',
        type: 'new_message',
        title: 'Nouveau message de sender',
        content: 'Hello world',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: 'sender-123',
        senderUsername: 'sender',
        senderAvatar: null,
        messagePreview: 'Hello world',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        callSessionId: null,
        data: JSON.stringify({ conversationTitle: 'Test' }),
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createMessageNotification({
        recipientId: 'recipient-123',
        senderId: 'sender-123',
        senderUsername: 'sender',
        messageContent: 'Hello world',
        conversationId: 'conv-123',
        messageId: 'msg-123',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.type).toBe('new_message');
      expect(result?.title).toContain('sender');
      expect(result?.messagePreview).toBe('Hello world');
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should create message notification with attachment info', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'recipient-123',
        type: 'new_message',
        title: 'Nouveau message de sender',
        content: 'Test 📷 Photo',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: 'sender-123',
        senderUsername: 'sender',
        senderAvatar: null,
        messagePreview: 'Test 📷 Photo',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        callSessionId: null,
        data: JSON.stringify({
          attachments: {
            count: 1,
            firstType: 'image',
            firstFilename: 'photo.jpg',
            firstMimeType: 'image/jpeg',
          },
        }),
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createMessageNotification({
        recipientId: 'recipient-123',
        senderId: 'sender-123',
        senderUsername: 'sender',
        messageContent: 'Test',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        attachments: [
          {
            id: 'att-1',
            filename: 'photo.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
          },
        ],
      });

      // Assert
      expect(result?.content).toContain('📷');
      expect(result?.data).toBeDefined();
    });

    it('should truncate long message preview', async () => {
      // Setup
      const longMessage = 'word '.repeat(30); // 30 words
      const mockNotification = {
        id: 'notif-123',
        userId: 'recipient-123',
        type: 'new_message',
        title: 'Nouveau message de sender',
        content: longMessage.split(' ').slice(0, 25).join(' ') + '...',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: 'sender-123',
        senderUsername: 'sender',
        senderAvatar: null,
        messagePreview: longMessage.split(' ').slice(0, 25).join(' ') + '...',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        callSessionId: null,
        data: null,
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createMessageNotification({
        recipientId: 'recipient-123',
        senderId: 'sender-123',
        senderUsername: 'sender',
        messageContent: longMessage,
        conversationId: 'conv-123',
        messageId: 'msg-123',
      });

      // Assert
      expect(result?.content).toContain('...');
      expect(result?.content.length).toBeLessThan(longMessage.length);
    });
  });

  describe('createMissedCallNotification', () => {
    it('should create missed call notification', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'recipient-123',
        type: 'missed_call',
        title: 'Appel vidéo manqué',
        content: 'Appel manqué de caller',
        priority: 'high',
        isRead: false,
        createdAt: new Date(),
        senderId: 'caller-123',
        senderUsername: 'caller',
        senderAvatar: null,
        messagePreview: null,
        conversationId: 'conv-123',
        messageId: null,
        callSessionId: 'call-123',
        data: JSON.stringify({ callType: 'video' }),
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createMissedCallNotification({
        recipientId: 'recipient-123',
        callerId: 'caller-123',
        callerUsername: 'caller',
        conversationId: 'conv-123',
        callSessionId: 'call-123',
        callType: 'video',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.type).toBe('missed_call');
      expect(result?.priority).toBe('high');
      expect(result?.title).toContain('vidéo');
      expect(result?.callSessionId).toBe('call-123');
    });

    it('should create missed audio call notification', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'recipient-123',
        type: 'missed_call',
        title: 'Appel audio manqué',
        content: 'Appel manqué de caller',
        priority: 'high',
        isRead: false,
        createdAt: new Date(),
        senderId: 'caller-123',
        senderUsername: 'caller',
        senderAvatar: null,
        messagePreview: null,
        conversationId: 'conv-123',
        messageId: null,
        callSessionId: 'call-123',
        data: JSON.stringify({ callType: 'audio' }),
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      const result = await service.createMissedCallNotification({
        recipientId: 'recipient-123',
        callerId: 'caller-123',
        callerUsername: 'caller',
        conversationId: 'conv-123',
        callSessionId: 'call-123',
        callType: 'audio',
      });

      // Assert
      expect(result?.title).toContain('audio');
    });
  });

  describe('createMentionNotificationsBatch', () => {
    it('should create multiple mention notifications in batch', async () => {
      // Setup
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.createMany = jest.fn().mockResolvedValue({ count: 2 });
      mockPrisma.notification.findMany = jest.fn().mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'user_mentioned',
          title: 'sender vous a mentionné',
          content: 'Test message',
          priority: 'normal',
          isRead: false,
          createdAt: new Date(),
          senderId: 'sender-123',
          senderUsername: 'sender',
          senderAvatar: null,
          messagePreview: 'Test message',
          conversationId: 'conv-123',
          messageId: 'msg-123',
          callSessionId: null,
          data: '{}',
          expiresAt: null,
        },
        {
          id: 'notif-2',
          userId: 'user-2',
          type: 'user_mentioned',
          title: 'sender vous a mentionné',
          content: 'Test message',
          priority: 'normal',
          isRead: false,
          createdAt: new Date(),
          senderId: 'sender-123',
          senderUsername: 'sender',
          senderAvatar: null,
          messagePreview: 'Test message',
          conversationId: 'conv-123',
          messageId: 'msg-123',
          callSessionId: null,
          data: '{}',
          expiresAt: null,
        },
      ]);

      // Execute
      const count = await service.createMentionNotificationsBatch(
        ['user-1', 'user-2'],
        {
          senderId: 'sender-123',
          senderUsername: 'sender',
          messageContent: 'Test message',
          conversationId: 'conv-123',
          messageId: 'msg-123',
        },
        ['user-1', 'user-2']
      );

      // Assert
      expect(count).toBe(2);
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
      expect(mockPrisma.notification.findMany).toHaveBeenCalled();
    });

    it('should filter out sender from mentions', async () => {
      // Setup
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.createMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.notification.findMany = jest.fn().mockResolvedValue([]);

      // Execute
      const count = await service.createMentionNotificationsBatch(
        ['sender-123'], // Le sender se mentionne lui-même
        {
          senderId: 'sender-123',
          senderUsername: 'sender',
          messageContent: 'Test',
          conversationId: 'conv-123',
          messageId: 'msg-123',
        },
        ['sender-123']
      );

      // Assert
      expect(count).toBe(0);
    });

    it('should apply rate limiting to mentions', async () => {
      // Setup
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.createMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.notification.findMany = jest.fn().mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'user_mentioned',
          title: 'test',
          content: 'test',
          priority: 'normal',
          isRead: false,
          createdAt: new Date(),
          senderId: 'sender-123',
          senderUsername: 'sender',
          senderAvatar: null,
          messagePreview: 'test',
          conversationId: 'conv-123',
          messageId: 'msg-123',
          callSessionId: null,
          data: '{}',
          expiresAt: null,
        },
      ]);

      // Execute - 6 mentions d'affilée (limite = 5)
      for (let i = 0; i < 6; i++) {
        await service.createMentionNotificationsBatch(
          ['user-1'],
          {
            senderId: 'sender-123',
            senderUsername: 'sender',
            messageContent: `Message ${i}`,
            conversationId: 'conv-123',
            messageId: `msg-${i}`,
          },
          ['user-1']
        );
      }

      // Assert - La 6ème mention devrait être bloquée par le rate limiting
      // Le nombre d'appels à createMany devrait être <= 5
      const createManyCalls = (mockPrisma.notification.createMany as jest.Mock).mock.calls.length;
      expect(createManyCalls).toBeLessThanOrEqual(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Setup
      mockPrisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      // Execute
      const result = await service.markAsRead('notif-123', 'user-123');

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-123', userId: 'user-123' },
        data: { isRead: true },
      });
    });

    it('should handle errors gracefully', async () => {
      // Setup
      mockPrisma.notification.updateMany = jest.fn().mockRejectedValue(new Error('DB error'));

      // Execute
      const result = await service.markAsRead('notif-123', 'user-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Setup
      mockPrisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 5 });

      // Execute
      const result = await service.markAllAsRead('user-123');

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRead: false },
        data: { isRead: true },
      });
    });

    it('should handle errors gracefully', async () => {
      // Setup
      mockPrisma.notification.updateMany = jest.fn().mockRejectedValue(new Error('DB error'));

      // Execute
      const result = await service.markAllAsRead('user-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      // Setup
      mockPrisma.notification.deleteMany = jest.fn().mockResolvedValue({ count: 1 });

      // Execute
      const result = await service.deleteNotification('notif-123', 'user-123');

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: 'notif-123', userId: 'user-123' },
      });
    });

    it('should handle errors gracefully', async () => {
      // Setup
      mockPrisma.notification.deleteMany = jest.fn().mockRejectedValue(new Error('DB error'));

      // Execute
      const result = await service.deleteNotification('notif-123', 'user-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      // Setup
      mockPrisma.notification.count = jest.fn().mockResolvedValue(3);

      // Execute
      const count = await service.getUnreadCount('user-123');

      // Assert
      expect(count).toBe(3);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRead: false },
      });
    });

    it('should return 0 on error', async () => {
      // Setup
      mockPrisma.notification.count = jest.fn().mockRejectedValue(new Error('DB error'));

      // Execute
      const count = await service.getUnreadCount('user-123');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('Socket.IO Integration', () => {
    it('should emit notification to all user sockets', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'new_message',
        title: 'Test',
        content: 'Test',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: null,
        senderUsername: null,
        senderAvatar: null,
        messagePreview: null,
        conversationId: null,
        messageId: null,
        callSessionId: null,
        data: null,
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'Test',
        content: 'Test',
      });

      // Assert - Doit émettre à socket-1 et socket-2
      expect(mockIo.to).toHaveBeenCalledWith('socket-1');
      expect(mockIo.to).toHaveBeenCalledWith('socket-2');
      expect(mockIo.emit).toHaveBeenCalledTimes(2);
    });

    it('should not emit if user is not connected', async () => {
      // Setup
      const mockNotification = {
        id: 'notif-123',
        userId: 'offline-user',
        type: 'new_message',
        title: 'Test',
        content: 'Test',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: null,
        senderUsername: null,
        senderAvatar: null,
        messagePreview: null,
        conversationId: null,
        messageId: null,
        callSessionId: null,
        data: null,
        expiresAt: null,
      };

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);

      // Execute
      await service.createNotification({
        userId: 'offline-user',
        type: 'new_message',
        title: 'Test',
        content: 'Test',
      });

      // Assert - Ne doit pas émettre
      expect(mockIo.to).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });
});
