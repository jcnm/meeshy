import { conversationsService } from '../../services/conversations.service';
import { apiService } from '../../services/api.service';
import type { Conversation, Message } from '../../types/socketio';

// Mock the apiService
jest.mock('../../services/api.service', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Helper pour créer un mock Conversation valide
const createMockConversation = (overrides?: Partial<Conversation>): Conversation => ({
  id: '1',
  identifier: 'test-conversation',
  type: 'direct',
  title: 'Test Conversation',
  isActive: true,
  isArchived: false,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  members: [],
  lastMessage: undefined,
  unreadCount: 0,
  ...overrides,
});

describe('ConversationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should fetch all conversations', async () => {
      const mockConversations: Conversation[] = [
        createMockConversation(),
      ];

      mockApiService.get.mockResolvedValue({
        data: mockConversations,
        status: 200,
        message: 'Success',
      });

      const result = await conversationsService.getConversations();

      expect(mockApiService.get).toHaveBeenCalledWith('/conversations');
      expect(result).toEqual(mockConversations);
    });

    it('should handle empty conversations list', async () => {
      mockApiService.get.mockResolvedValue({
        data: [],
        status: 200,
        message: 'Success',
      });

      const result = await conversationsService.getConversations();

      expect(result).toEqual([]);
    });
  });

  describe('getConversation', () => {
    it('should fetch a specific conversation', async () => {
      const mockConversation = createMockConversation();

      mockApiService.get.mockResolvedValue({
        data: mockConversation,
        status: 200,
        message: 'Success',
      });

      const result = await conversationsService.getConversation('1');

      expect(mockApiService.get).toHaveBeenCalledWith('/conversations/1');
      expect(result).toEqual(mockConversation);
    });
  });

  describe('createConversation', () => {
    it('should create a new group conversation', async () => {
      const createData = {
        type: 'group' as const,
        title: 'New Group Conversation',
        participants: ['user1', 'user2'],
      };

      const mockCreatedConversation = createMockConversation({
        id: '2',
        identifier: 'new-group-conversation',
        type: 'group',
        title: 'New Group Conversation',
      });

      mockApiService.post.mockResolvedValue({
        data: mockCreatedConversation,
        status: 201,
        message: 'Created',
      });

      const result = await conversationsService.createConversation(createData);

      expect(mockApiService.post).toHaveBeenCalledWith('/conversations', createData);
      expect(result).toEqual(mockCreatedConversation);
    });

    it('should create a direct conversation', async () => {
      const createData = {
        type: 'direct' as const,
        participants: ['user1'],
      };

      const mockConversation = createMockConversation({
        id: '3',
        identifier: 'direct-user1',
        type: 'direct',
        title: undefined,
      });

      mockApiService.post.mockResolvedValue({
        data: mockConversation,
        status: 201,
        message: 'Created',
      });

      const result = await conversationsService.createConversation(createData);

      expect(mockApiService.post).toHaveBeenCalledWith('/conversations', createData);
      expect(result.type).toBe('direct');
    });
  });

  describe('deleteConversation', () => {
    it('should delete a conversation', async () => {
      mockApiService.delete.mockResolvedValue({
        data: {},
        status: 204,
        message: 'Deleted',
      });

      await conversationsService.deleteConversation('1');

      expect(mockApiService.delete).toHaveBeenCalledWith('/conversations/1');
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const messageData = {
        content: 'Hello world',
        originalLanguage: 'en',
      };

      const mockMessage: Message = {
        id: '1',
        conversationId: '1',
        senderId: 'user1',
        content: 'Hello world',
        originalLanguage: 'en',
        messageType: 'text',
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: 'user1',
          username: 'testuser',
          email: 'test@example.com',
          phoneNumber: '',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER' as const,
          permissions: {
            canAccessAdmin: false,
            canManageUsers: false,
            canManageGroups: false,
            canManageConversations: false,
            canViewAnalytics: false,
            canModerateContent: false,
            canViewAuditLogs: false,
            canManageNotifications: false,
            canManageTranslations: false,
          },
          systemLanguage: 'en',
          regionalLanguage: 'en',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          lastSeen: new Date(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        },
      };

      mockApiService.post.mockResolvedValue({
        data: mockMessage,
        status: 201,
        message: 'Created',
      });

      const result = await conversationsService.sendMessage('1', messageData);

      expect(mockApiService.post).toHaveBeenCalledWith('/conversations/1/messages', messageData);
      expect(result).toEqual(mockMessage);
    });
  });

  describe('markAsRead', () => {
    it('should mark conversation as read', async () => {
      mockApiService.post.mockResolvedValue({
        data: {},
        status: 200,
        message: 'Success',
      });

      await conversationsService.markAsRead('1');

      expect(mockApiService.post).toHaveBeenCalledWith('/conversations/1/read');
    });
  });

  describe('searchConversations', () => {
    it('should search conversations', async () => {
      const mockConversations: Conversation[] = [
        createMockConversation(),
      ];

      mockApiService.get.mockResolvedValue({
        data: mockConversations,
        status: 200,
        message: 'Success',
      });

      const result = await conversationsService.searchConversations('test');

      expect(mockApiService.get).toHaveBeenCalledWith('/conversations/search', { q: 'test' });
      expect(result).toEqual(mockConversations);
    });

    it('should handle empty search results', async () => {
      mockApiService.get.mockResolvedValue({
        data: [],
        status: 200,
        message: 'Success',
      });

      const result = await conversationsService.searchConversations('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('updateConversation', () => {
    it('should update conversation', async () => {
      const updateData = {
        title: 'Updated Conversation Title',
      };

      const mockUpdatedConversation = createMockConversation({
        id: '1',
        identifier: 'updated-conversation',
        type: 'group',
        title: 'Updated Conversation Title',
      });

      mockApiService.patch.mockResolvedValue({
        data: mockUpdatedConversation,
        status: 200,
        message: 'Updated',
      });

      const result = await conversationsService.updateConversation('1', updateData);

      expect(mockApiService.patch).toHaveBeenCalledWith('/conversations/1', updateData);
      expect(result).toEqual(mockUpdatedConversation);
    });
  });

  describe('Error handling', () => {
    it('should propagate API errors', async () => {
      const mockError = new Error('Network error');
      mockApiService.get.mockRejectedValue(mockError);

      await expect(conversationsService.getConversations()).rejects.toThrow('Network error');
    });
  });
});
