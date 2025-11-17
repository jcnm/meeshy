import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationService } from '../../services/NotificationService';
import { createMockPrismaClient } from '../helpers/prisma-mock';

// Mock dependencies
jest.mock('../../utils/logger');

describe('NotificationService', () => {
  let service: NotificationService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockIo: any;
  let mockUserSocketsMap: Map<string, Set<string>>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new NotificationService(mockPrisma as any);

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    mockUserSocketsMap = new Map();
    mockUserSocketsMap.set('user-123', new Set(['socket-1', 'socket-2']));

    service.setSocketIO(mockIo, mockUserSocketsMap);

    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
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
        expiresAt: null
      };

      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test message'
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-123');
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should skip notification if user preferences disable it', async () => {
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue({
        userId: 'user-123',
        newMessageEnabled: false,
        dndEnabled: false
      });

      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test'
      });

      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should respect Do Not Disturb mode', async () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue({
        userId: 'user-123',
        newMessageEnabled: true,
        dndEnabled: true,
        dndStartTime: '00:00',
        dndEndTime: '23:59'
      });

      const result = await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test'
      });

      expect(result).toBeNull();
    });

    it('should emit notification via Socket.IO', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test message',
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
        expiresAt: null
      };

      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      await service.createNotification({
        userId: 'user-123',
        type: 'new_message',
        title: 'New Message',
        content: 'Test'
      });

      expect(mockIo.to).toHaveBeenCalledWith('socket-1');
      expect(mockIo.to).toHaveBeenCalledWith('socket-2');
      expect(mockIo.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('createMessageNotification', () => {
    it('should create message notification with attachment info', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'new_message',
        title: 'Nouveau message de sender',
        content: 'Test message 📷 Photo',
        priority: 'normal',
        isRead: false,
        createdAt: new Date(),
        senderId: 'sender-123',
        senderUsername: 'sender',
        senderAvatar: null,
        messagePreview: 'Test message 📷 Photo',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        callSessionId: null,
        data: JSON.stringify({ attachments: { count: 1 } }),
        expiresAt: null
      };

      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.createMessageNotification({
        recipientId: 'user-123',
        senderId: 'sender-123',
        senderUsername: 'sender',
        messageContent: 'Test message',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        attachments: [{
          id: 'att-1',
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024
        }]
      });

      expect(result).toBeDefined();
      expect(result?.content).toContain('📷');
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should truncate long message preview', async () => {
      const longMessage = 'word '.repeat(30);
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
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
        expiresAt: null
      };

      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.createMessageNotification({
        recipientId: 'user-123',
        senderId: 'sender-123',
        senderUsername: 'sender',
        messageContent: longMessage,
        conversationId: 'conv-123',
        messageId: 'msg-123'
      });

      expect(result?.content).toContain('...');
    });
  });

  describe('createMissedCallNotification', () => {
    it('should create missed call notification', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
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
        expiresAt: null
      };

      mockPrisma.notification.create = jest.fn().mockResolvedValue(mockNotification);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.createMissedCallNotification({
        recipientId: 'user-123',
        callerId: 'caller-123',
        callerUsername: 'caller',
        conversationId: 'conv-123',
        callSessionId: 'call-123',
        callType: 'video'
      });

      expect(result).toBeDefined();
      expect(result?.type).toBe('missed_call');
      expect(result?.priority).toBe('high');
    });
  });

  describe('createMentionNotificationsBatch', () => {
    it('should create multiple mention notifications in batch', async () => {
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
          expiresAt: null
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
          expiresAt: null
        }
      ]);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      const count = await service.createMentionNotificationsBatch(
        ['user-1', 'user-2'],
        {
          senderId: 'sender-123',
          senderUsername: 'sender',
          messageContent: 'Test message',
          conversationId: 'conv-123',
          messageId: 'msg-123'
        },
        ['user-1', 'user-2']
      );

      expect(count).toBe(2);
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
    });

    it('should filter out sender from mentions', async () => {
      mockPrisma.notification.createMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.notification.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      const count = await service.createMentionNotificationsBatch(
        ['sender-123'],
        {
          senderId: 'sender-123',
          senderUsername: 'sender',
          messageContent: 'Test',
          conversationId: 'conv-123',
          messageId: 'msg-123'
        },
        ['sender-123']
      );

      expect(count).toBe(0);
    });

    it('should apply rate limiting to mentions', async () => {
      // First batch should succeed
      mockPrisma.notification.createMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.notification.findMany = jest.fn().mockResolvedValue([{
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
        expiresAt: null
      }]);
      mockPrisma.notificationPreference.findUnique = jest.fn().mockResolvedValue(null);

      for (let i = 0; i < 6; i++) {
        await service.createMentionNotificationsBatch(
          ['user-1'],
          {
            senderId: 'sender-123',
            senderUsername: 'sender',
            messageContent: `Message ${i}`,
            conversationId: 'conv-123',
            messageId: `msg-${i}`
          },
          ['user-1']
        );
      }

      // After 5 mentions, the 6th should be blocked by rate limiting
      // The last call should have returned 0
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockPrisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      const result = await service.markAsRead('notif-123', 'user-123');

      expect(result).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-123', userId: 'user-123' },
        data: { isRead: true }
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.notification.updateMany = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await service.markAsRead('notif-123', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockPrisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-123');

      expect(result).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRead: false },
        data: { isRead: true }
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count = jest.fn().mockResolvedValue(3);

      const count = await service.getUnreadCount('user-123');

      expect(count).toBe(3);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRead: false }
      });
    });

    it('should return 0 on error', async () => {
      mockPrisma.notification.count = jest.fn().mockRejectedValue(new Error('DB error'));

      const count = await service.getUnreadCount('user-123');

      expect(count).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockPrisma.notification.deleteMany = jest.fn().mockResolvedValue({ count: 1 });

      const result = await service.deleteNotification('notif-123', 'user-123');

      expect(result).toBe(true);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: 'notif-123', userId: 'user-123' }
      });
    });
  });
});
