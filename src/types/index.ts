export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  phoneNumber?: string;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  isOnline: boolean;
  avatar?: string;
  lastSeen?: Date;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  originalLanguage: string;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sender: User;
}

export interface Translation {
  language: string;
  content: string;
  flag: string;
  createdAt: Date;
  modelUsed?: TranslationModelType;
  modelCost?: ModelCost;
}

export interface TranslationCache {
  key: string;
  originalMessage: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedMessage: string;
  timestamp: Date;
  modelUsed: TranslationModelType;
  modelCost: ModelCost;
}

export interface TranslatedMessage extends Message {
  originalContent?: string;
  translatedContent?: string;
  targetLanguage?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  showingOriginal?: boolean;
  translationError?: string;
  translationFailed?: boolean;
  translations?: Translation[];
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

export type TranslationModelType = 'MT5' | 'NLLB';

export interface ModelCost {
  energyConsumption: number; // en Wh (Watt-heure)
  computationalCost: number; // score relatif de 1-10
  co2Equivalent: number; // en grammes de CO2
  monetaryEquivalent: number; // en centimes d'euro
}

export interface TranslationModel {
  name: TranslationModelType;
  isLoaded: boolean;
  model?: unknown;
  cost: ModelCost;
  color: string; // Couleur pour la bordure
}

// Configuration des modèles avec leurs coûts et couleurs
export const TRANSLATION_MODELS: Record<TranslationModelType, Omit<TranslationModel, 'isLoaded' | 'model'>> = {
  MT5: {
    name: 'MT5',
    cost: {
      energyConsumption: 0.05, // 0.05 Wh par traduction
      computationalCost: 3,
      co2Equivalent: 0.025, // 25 milligrammes
      monetaryEquivalent: 0.01 // 0.01 centime
    },
    color: '#10B981' // Vert émeraude (modèle léger)
  },
  NLLB: {
    name: 'NLLB',
    cost: {
      energyConsumption: 0.2, // 0.2 Wh par traduction
      computationalCost: 8,
      co2Equivalent: 0.1, // 100 milligrammes
      monetaryEquivalent: 0.05 // 0.05 centime
    },
    color: '#F97316' // Orange corail (modèle lourd)
  }
};

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

export interface Conversation {
  id: string;
  type: string;
  title?: string;
  name?: string;
  description?: string;
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
