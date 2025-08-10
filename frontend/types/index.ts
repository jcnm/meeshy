export type UserRole = 'BIGBOSS' | 'ADMIN' | 'MODO' | 'AUDIT' | 'ANALYST' | 'USER';

// ===== EXPORT DES NOUVEAUX TYPES SOCKET.IO =====
export * from './socketio';

// Import explicite pour éviter les conflits
import type { Message, User, UserPermissions, TranslatedMessage } from './socketio';

// ===== TYPES COMPLÉMENTAIRES =====

export interface Translation {
  language: string;
  content: string;
  flag: string;
  createdAt: Date;
}

// Interface pour les traductions enrichies des bulles de message
export interface BubbleTranslation {
  language: string;
  content: string;
  status: 'pending' | 'translating' | 'completed';
  timestamp: Date;
  confidence: number; // 0-1 pour la qualité de traduction
}

export interface TranslationCache {
  key: string;
  originalMessage: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedMessage: string;
  timestamp: Date;
}

export interface ChatRoom {
  id: string;
  participantIds: string[];
  messages: Message[];
  createdAt: Date;
}

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LanguageCode {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  { code: 'auto', name: 'Détection automatique', flag: '🔍' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
];

export interface Conversation {
  id: string;
  type: string;
  title?: string;
  name?: string;
  description?: string;
  groupId?: string; // Référence au groupe si c'est une conversation de groupe
  isGroup?: boolean;
  isPrivate?: boolean;
  isActive: boolean;
  maxMembers?: number;
  createdAt: Date;
  updatedAt: Date;
  participants?: ThreadMember[];
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface ThreadMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: Date;
  role: 'ADMIN' | 'MEMBER';
  user: User;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Date;
  role: 'ADMIN' | 'MEMBER';
  user: User;
}

// Types obsolètes - utiliser ThreadMember à la place
export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: Date;
  role: 'ADMIN' | 'MEMBER';
  user: User;
}

export interface ConversationParticipant {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  role: string;
}

export interface AuthRequest {
  username: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  systemLanguage?: string;
  regionalLanguage?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface ConversationLink {
  id: string;
  conversationId: string;
  linkId: string;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  createdAt: Date;
  conversation: Conversation;
}

export interface TypingIndicator {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  user: User;
}

export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastActiveAt: Date;
}

export type AuthMode = 'welcome' | 'login' | 'register' | 'join';

export interface Group {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  maxMembers?: number;
  createdAt: Date;
  updatedAt: Date;
  members: GroupMember[];
  conversations: Conversation[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'group_invite' | 'conversation_invite' | 'system' | 'translation_error' | 'user_joined' | 'user_left' | 'typing';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

// Request types for conversations
export interface CreateConversationRequest {
  name?: string;
  participants: string[];
  isGroup?: boolean;
  description?: string;
}

export interface SendMessageRequest {
  content: string;
  originalLanguage?: string;
  replyToId?: string;
}

// Types pour WebSocket temps réel
export interface SocketEvent {
  type: 'message' | 'typing' | 'presence' | 'notification' | 'conversation_update' | 'group_update';
  data: unknown;
  timestamp: string;
  userId?: string;
  conversationId?: string;
  groupId?: string;
}

export interface PresenceEvent {
  userId: string;
  isOnline: boolean;
  lastActiveAt: string;
  username: string;
}

export interface MessageEvent {
  message: Message;
  conversationId: string;
  senderId: string;
  type: 'new' | 'updated' | 'deleted';
}

export interface NotificationEvent {
  notification: Notification;
  userId: string;
  type: 'new' | 'read' | 'deleted';
}

export interface ConversationUpdateEvent {
  conversationId: string;
  type: 'member_added' | 'member_removed' | 'settings_updated' | 'deleted';
  data: unknown;
}

export interface GroupUpdateEvent {
  groupId: string;
  type: 'member_added' | 'member_removed' | 'settings_updated' | 'deleted';
  data: unknown;
}

// Utilitaires pour les rôles et permissions
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  BIGBOSS: 6,
  ADMIN: 5,
  MODO: 4,
  AUDIT: 3,
  ANALYST: 2,
  USER: 1,
};

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  BIGBOSS: {
    canAccessAdmin: true,
    canManageUsers: true,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: true,
    canModerateContent: true,
    canViewAuditLogs: true,
    canManageNotifications: true,
    canManageTranslations: true,
  },
  ADMIN: {
    canAccessAdmin: true,
    canManageUsers: true,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: true,
    canModerateContent: true,
    canViewAuditLogs: true,
    canManageNotifications: true,
    canManageTranslations: false,
  },
  MODO: {
    canAccessAdmin: true,
    canManageUsers: false,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: false,
    canModerateContent: true,
    canViewAuditLogs: false,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  AUDIT: {
    canAccessAdmin: true,
    canManageUsers: false,
    canManageGroups: false,
    canManageConversations: false,
    canViewAnalytics: true,
    canModerateContent: false,
    canViewAuditLogs: true,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  ANALYST: {
    canAccessAdmin: false,
    canManageUsers: false,
    canManageGroups: false,
    canManageConversations: false,
    canViewAnalytics: true,
    canModerateContent: false,
    canViewAuditLogs: false,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  USER: {
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
};
