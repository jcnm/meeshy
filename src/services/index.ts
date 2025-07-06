// Export des services principaux
export { apiService, ApiService, ApiServiceError } from './apiService';
export { groupsService, GroupsService } from './groupsService';
export { conversationsService, ConversationsService } from './conversationsService';

// Export des types
export type { ApiResponse, ApiError, ApiConfig } from './apiService';
export type {
  CreateGroupDto,
  UpdateGroupDto,
  InviteMemberDto,
  GroupFilters,
  GroupsResponse,
} from './groupsService';

// Service mock pour les tests
export { mockApiService } from './mockApiService';
