// User DTOs
export class CreateUserDto {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  displayName?: string;
  systemLanguage?: string;
  regionalLanguage?: string;
  autoTranslateEnabled?: boolean;
  translateToSystemLanguage?: boolean;
  translateToRegionalLanguage?: boolean;
  useCustomDestination?: boolean;
}

export class UpdateUserDto {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  phoneNumber?: string;
  systemLanguage?: string;
  regionalLanguage?: string;
  autoTranslateEnabled?: boolean;
  translateToSystemLanguage?: boolean;
  translateToRegionalLanguage?: boolean;
  useCustomDestination?: boolean;
}

export class LoginDto {
  username: string;
  password: string;
}

// Conversation DTOs
export class CreateConversationDto {
  type: 'direct' | 'group';
  title?: string;
  description?: string;
  participantIds: string[];
}

export class UpdateConversationDto {
  title?: string;
  description?: string;
  isActive?: boolean;
}

export class CreateConversationLinkDto {
  conversationId: string;
  linkId: string;
  maxUses?: number;
  expiresAt?: Date;
}

// Group DTOs
export class CreateGroupDto {
  title: string;
  description?: string;
  image?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

export class UpdateGroupDto {
  title?: string;
  description?: string;
  image?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

// Message DTOs
export class CreateMessageDto {
  content: string;
  conversationId: string;
  originalLanguage?: string;
  replyToId?: string;
}

export class UpdateMessageDto {
  content: string;
}

// Link DTOs
export class JoinConversationDto {
  conversationId: string;
  linkId?: string; // Pour les liens d'invitation
}

export class CreateLinkDto {
  conversationId: string;
  expiresAt?: Date;
  maxUses?: number;
}

// Response Types
export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    displayName?: string;
    avatar?: string;
    systemLanguage: string;
    regionalLanguage: string;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
    isOnline: boolean;
    lastActiveAt: Date;
  };
}

export interface ConversationResponse {
  id: string;
  type: string;
  title?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  participants: Array<{
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    isOnline: boolean;
    role: string;
  }>;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
  };
  group?: {
    id: string;
    title: string;
    description?: string;
    image?: string;
    isPublic: boolean;
    memberCount: number;
  };
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
  conversationId: string; // Ajouter conversationId
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// WebSocket Events
export interface TypingEvent {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface MessageEvent {
  type: 'new_message' | 'message_edited' | 'message_deleted';
  message: MessageResponse;
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
