// Import des types partagés
import type { 
  User, 
  Conversation, 
  Message, 
  LanguageCode 
} from '@shared/types';

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  spokenLanguage: string;
  receiveLanguage: string;
  conversationLinkId: string;
}

export interface ConversationLink {
  id: string;
  createdBy: string;
  participants: string[];
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  url?: string;
}

// Conversation est maintenant importé depuis @shared/types

// Message est maintenant importé depuis @shared/types

// TranslationCache est maintenant importé depuis @shared/types (MessageTranslationCache)

// TranslatedMessage est maintenant importé depuis @shared/types

export interface ChatRoom {
  id: string;
  participantIds: string[];
  messages: Message[];
  createdAt: Date;
}

// SocketResponse est maintenant importé depuis @shared/types

export interface TranslationModel {
  name: 'MT5' | 'NLLB';
  isLoaded: boolean;
  model?: unknown;
}

// LanguageCode est maintenant importé depuis @shared/types

// SUPPORTED_LANGUAGES is now imported from @shared/types to avoid conflicts

// Langues d'interface supportées (focus on FR, EN, PT for now)
export const INTERFACE_LANGUAGES: LanguageCode[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
];

export interface JoinConversationResponse {
  user: User;
  conversation: Conversation;
  isNewUser: boolean;
  existingUserFound?: boolean;
}

export interface AppState {
  currentUser?: User;
  conversations: Conversation[];
  currentConversation?: Conversation;
  isAuthenticated: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  conversations: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'group_invite' | 'conversation_invite' | 'system' | 'translation_error' | 'model_update' | 'user_joined' | 'user_left' | 'typing';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}
