// Export des services principaux
export { apiService, ApiService, ApiServiceError } from './apiService';
export { groupsService, GroupsService } from './groupsService';
export { conversationsService, ConversationsService } from './conversationsService';
export { notificationsService } from './notificationsService';
export { usersService } from './usersService';
export { messagesService } from './messagesService';

// Export des types
export type { ApiResponse, ApiError, ApiConfig } from './apiService';
export type {
  CreateGroupDto,
  UpdateGroupDto,
  InviteMemberDto,
  GroupFilters,
  GroupsResponse,
} from './groupsService';
export type { Notification, NotificationPreferences } from './notificationsService';
export type { UserStats, UpdateUserDto } from './usersService';
export type { Message, CreateMessageDto, UpdateMessageDto } from './messagesService';

// Service mock pour les tests
export { mockApiService } from './mockApiService';
