// Export des services principaux
export { apiService, ApiService, ApiServiceError } from './api.service';
export { groupsService, GroupsService } from './groups.service';
export { conversationsService, ConversationsService } from './conversations.service';
export { notificationsService } from './notifications.service';
export { usersService } from './users.service';
export { messagesService } from './messages.service';

// Export des types
export type { ApiResponse, ApiError, ApiConfig } from './api.service';
export type {
  CreateGroupDto,
  UpdateGroupDto,
  InviteMemberDto,
  GroupFilters,
  GroupsResponse,
} from './groups.service';
export type { Notification, NotificationPreferences } from './notifications.service';
export type { UserStats, UpdateUserDto } from './users.service';
export type { Message, CreateMessageDto, UpdateMessageDto } from './messages.service';

// Services de modèles de traduction (Production Ready)
export { HuggingFaceTranslationService } from './simplified-translation.service';
// Service mock pour les tests
export { mockApiService } from './mock-api.service';
