// ===== ENUMS ET CONSTANTES =====

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
}

// Version publique de User sans données sensibles
export type UserSafe = Omit<User, 'email' | 'phoneNumber'>;

export interface Conversation {
  id: string;
  type: ConversationType;
  title?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  participants?: ConversationParticipant[];
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
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
  conversationId: string;
  title: string;
  description?: string;
  image?: string;
  isPublic: boolean;
  maxMembers?: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  members?: GroupMember[];
  conversation?: Conversation;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  user?: User;
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
  message: Message;
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
