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

// ConversationLink est maintenant importé depuis @shared/types

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

// Langues d'interface supportées
export const INTERFACE_LANGUAGES: LanguageCode[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
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
  identifier?: string;
  name: string;
  description?: string;
  avatar?: string | null;
  isPrivate: boolean;
  maxMembers?: number;
  createdBy: string;
  members: any[]; // Array of member objects
  conversations: string[];
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string | null;
  };
  _count?: {
    members: number;
    Conversation: number;
  };
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
