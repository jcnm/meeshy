export interface User {
  id: string;
  username: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  isOnline: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}

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

export interface Conversation {
  id: string;
  linkId: string;
  participants: string[];
  messages: Message[];
  createdAt: Date;
  lastMessageAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  originalLanguage: string;
  sender?: User;
}

export interface TranslationCache {
  key: string;
  originalMessage: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedMessage: string;
  timestamp: Date;
}

export interface TranslatedMessage extends Message {
  originalContent?: string;
  translatedContent?: string;
  targetLanguage?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  showingOriginal?: boolean;
  translationError?: string;
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

export interface TranslationModel {
  name: 'MT5' | 'NLLB';
  isLoaded: boolean;
  model?: unknown;
}

export interface LanguageCode {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
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
