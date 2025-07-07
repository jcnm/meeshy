// ===== ENUMS ET CONSTANTES =====

export type UserRole = 'BIGBOSS' | 'ADMIN' | 'MODO' | 'AUDIT' | 'ANALYST' | 'USER';

export interface UserPermissions {
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageGroups: boolean;
  canManageConversations: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canViewAuditLogs: boolean;
  canManageNotifications: boolean;
  canManageTranslations: boolean;
}

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group'
}

export enum ParticipantRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator', 
  MEMBER = 'member'
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read'
}

// ===== INTERFACES PRINCIPALES =====

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName?: string | undefined;
  email: string;
  phoneNumber?: string | undefined;
  avatar?: string | undefined;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string | undefined;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  isOnline: boolean;
  lastSeen?: Date | undefined;
  createdAt: Date;
  lastActiveAt: Date;
  role: UserRole;
  isActive: boolean;
  deactivatedAt?: Date | undefined;
  permissions?: UserPermissions; // Optionnel, calculé dynamiquement
}

// Version publique de User sans données sensibles
export type UserSafe = Omit<User, 'email' | 'phoneNumber'>;

export interface Conversation {
  id: string;
  type: ConversationType;
  title?: string;
  description?: string;
  groupId?: string; // Référence au groupe si c'est une conversation de groupe
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  participants?: ConversationParticipant[];
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
  group?: Group; // Relation avec le groupe
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt?: Date;
  isAdmin: boolean;
  isModerator: boolean;
  user?: User;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  originalLanguage: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  replyToId?: string;
  createdAt: Date;
  updatedAt: Date;
  sender?: User;
  replyTo?: Message;
}

export interface MessageResponse {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  sender?: User; // Ajout de l'objet sender complet
  originalLanguage: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  conversationId: string;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  title: string;
  description?: string;
  image?: string;
  isPublic: boolean;
  maxMembers?: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  members?: GroupMember[];
  conversations?: Conversation[]; // Un groupe peut avoir plusieurs conversations
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  user?: User;
}

export interface ConversationResponse {
  id: string;
  type: ConversationType;
  title?: string;
  name?: string; // Alias pour compatibilité
  description?: string;
  isGroup: boolean;
  isPrivate: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: MessageResponse;
  unreadCount: number;
  participants: ConversationParticipant[];
}

// ===== TYPES POUR WEBSOCKETS =====

export interface TypingEvent {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface MessageEvent {
  type: 'new_message' | 'message_edited' | 'message_deleted';
  message: MessageResponse;  // Utiliser MessageResponse pour WebSocket
  conversationId: string;
}

export interface UserStatusEvent {
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface ConversationEvent {
  type: 'user_joined' | 'user_left' | 'conversation_updated';
  conversationId: string;
  userId?: string;
  data?: Record<string, unknown>;
}

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== TYPES POUR CACHE TRADUCTION =====

export interface TranslationCache {
  key: string;
  originalMessage: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedMessage: string;
  timestamp: Date;
}

// ===== TYPES POUR AUTHENTIFICATION =====

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// ===== TYPES POUR PAGINATION =====

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Interface pour l'utilisateur avec permissions calculées (utilisée dans les contrôleurs admin)
export interface UserWithPermissions extends User {
  permissions: UserPermissions;
}
