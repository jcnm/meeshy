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
  isDeleted?: boolean;
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

export type TranslationModelType = 
  | 'MT5_SMALL' 
  | 'MT5_BASE' 
  | 'MT5_LARGE' 
  | 'MT5_XL' 
  | 'MT5_XXL'
  | 'NLLB_200M' 
  | 'NLLB_DISTILLED_600M' 
  | 'NLLB_DISTILLED_1_3B'
  | 'NLLB_1_3B' 
  | 'NLLB_3_3B'
  | 'NLLB_54B';

export interface ModelCost {
  energyConsumption: number; // en Wh (Watt-heure)
  computationalCost: number; // score relatif de 1-10
  co2Equivalent: number; // en grammes de CO2
  monetaryEquivalent: number; // en centimes d'euro
  memoryUsage: number; // en MB
  inferenceTime: number; // en millisecondes
}

export interface TranslationModel {
  name: TranslationModelType;
  displayName: string;
  family: 'MT5' | 'NLLB';
  size: string;
  parameters: string;
  isLoaded: boolean;
  model?: unknown;
  cost: ModelCost;
  color: string; // Couleur pour la bordure
  quality: 'basic' | 'good' | 'high' | 'excellent' | 'premium';
}

// Configuration des modèles avec leurs coûts et couleurs - du plus léger au plus lourd
export const TRANSLATION_MODELS: Record<TranslationModelType, Omit<TranslationModel, 'isLoaded' | 'model'>> = {
  // Famille MT5 - Google's Multilingual T5
  MT5_SMALL: {
    name: 'MT5_SMALL',
    displayName: 'MT5 Small',
    family: 'MT5',
    size: 'Small',
    parameters: '300M',
    cost: {
      energyConsumption: 0.02, // 0.02 Wh par traduction
      computationalCost: 1,
      co2Equivalent: 0.01, // 10 milligrammes
      monetaryEquivalent: 0.005, // 0.005 centime
      memoryUsage: 1200, // 1.2 GB
      inferenceTime: 150 // 150ms
    },
    color: '#22c55e', // Vert - très efficace (le plus léger)
    quality: 'basic'
  },
  
  MT5_BASE: {
    name: 'MT5_BASE',
    displayName: 'MT5 Base',
    family: 'MT5',
    size: 'Base',
    parameters: '580M',
    cost: {
      energyConsumption: 0.05, // 0.05 Wh par traduction
      computationalCost: 2,
      co2Equivalent: 0.025, // 25 milligrammes
      monetaryEquivalent: 0.01, // 0.01 centime
      memoryUsage: 2300, // 2.3 GB
      inferenceTime: 250 // 250ms
    },
    color: '#84cc16', // Vert clair - efficace
    quality: 'high'
  },

  MT5_LARGE: {
    name: 'MT5_LARGE',
    displayName: 'MT5 Large',
    family: 'MT5',
    size: 'Large',
    parameters: '1.2B',
    cost: {
      energyConsumption: 0.1, // 0.1 Wh par traduction
      computationalCost: 4,
      co2Equivalent: 0.05, // 50 milligrammes
      monetaryEquivalent: 0.02, // 0.02 centime
      memoryUsage: 4800, // 4.8 GB
      inferenceTime: 400 // 400ms
    },
    color: '#eab308', // Jaune - moyen
    quality: 'excellent'
  },

  MT5_XL: {
    name: 'MT5_XL',
    displayName: 'MT5 XL',
    family: 'MT5',
    size: 'XL',
    parameters: '3.7B',
    cost: {
      energyConsumption: 0.25, // 0.25 Wh par traduction
      computationalCost: 6,
      co2Equivalent: 0.125, // 125 milligrammes
      monetaryEquivalent: 0.05, // 0.05 centime
      memoryUsage: 14800, // 14.8 GB
      inferenceTime: 800 // 800ms
    },
    color: '#f97316', // Orange - coûteux
    quality: 'excellent'
  },

  MT5_XXL: {
    name: 'MT5_XXL',
    displayName: 'MT5 XXL',
    family: 'MT5',
    size: 'XXL',
    parameters: '13B',
    cost: {
      energyConsumption: 0.6, // 0.6 Wh par traduction
      computationalCost: 8,
      co2Equivalent: 0.3, // 300 milligrammes
      monetaryEquivalent: 0.12, // 0.12 centime
      memoryUsage: 52000, // 52 GB
      inferenceTime: 1500 // 1.5s
    },
    color: '#dc2626', // Rouge - très coûteux
    quality: 'premium'
  },

  // Famille NLLB - Meta's No Language Left Behind
  NLLB_200M: {
    name: 'NLLB_200M',
    displayName: 'NLLB 200M',
    family: 'NLLB',
    size: '200M',
    parameters: '200M',
    cost: {
      energyConsumption: 0.03, // 0.03 Wh par traduction
      computationalCost: 2,
      co2Equivalent: 0.015, // 15 milligrammes
      monetaryEquivalent: 0.008, // 0.008 centime
      memoryUsage: 800, // 800 MB
      inferenceTime: 200 // 200ms
    },
    color: '#16a34a', // Vert foncé - ultra efficace
    quality: 'basic'
  },

  NLLB_DISTILLED_600M: {
    name: 'NLLB_DISTILLED_600M',
    displayName: 'NLLB Distilled 600M',
    family: 'NLLB',
    size: 'distilled-600M',
    parameters: '600M',
    cost: {
      energyConsumption: 0.022, // 0.022 Wh par traduction
      computationalCost: 2,
      co2Equivalent: 0.011, // 11 milligrammes
      monetaryEquivalent: 0.008, // 0.008 centime
      memoryUsage: 800, // 800 MB
      inferenceTime: 200 // 200ms
    },
    color: '#22c55e', // Vert - très efficace
    quality: 'high'
  },

  NLLB_DISTILLED_1_3B: {
    name: 'NLLB_DISTILLED_1_3B',
    displayName: 'NLLB Distilled 1.3B',
    family: 'NLLB',
    size: 'distilled-1.3B',
    parameters: '1.3B',
    cost: {
      energyConsumption: 0.045, // 0.045 Wh par traduction
      computationalCost: 3,
      co2Equivalent: 0.023, // 23 milligrammes
      monetaryEquivalent: 0.015, // 0.015 centime
      memoryUsage: 1300, // 1.3 GB
      inferenceTime: 300 // 300ms
    },
    color: '#84cc16', // Vert clair - efficace
    quality: 'excellent'
  },

  NLLB_1_3B: {
    name: 'NLLB_1_3B',
    displayName: 'NLLB 1.3B',
    family: 'NLLB',
    size: '1.3B',
    parameters: '1.3B',
    cost: {
      energyConsumption: 0.15, // 0.15 Wh par traduction
      computationalCost: 5,
      co2Equivalent: 0.075, // 75 milligrammes
      monetaryEquivalent: 0.04, // 0.04 centime
      memoryUsage: 5200, // 5.2 GB
      inferenceTime: 600 // 600ms
    },
    color: '#a3a3a3', // Gris - neutre
    quality: 'excellent'
  },

  NLLB_3_3B: {
    name: 'NLLB_3_3B',
    displayName: 'NLLB 3.3B',
    family: 'NLLB',
    size: '3.3B',
    parameters: '3.3B',
    cost: {
      energyConsumption: 0.35, // 0.35 Wh par traduction
      computationalCost: 7,
      co2Equivalent: 0.175, // 175 milligrammes
      monetaryEquivalent: 0.08, // 0.08 centime
      memoryUsage: 13200, // 13.2 GB
      inferenceTime: 1200 // 1.2s
    },
    color: '#f59e0b', // Orange - coûteux
    quality: 'premium'
  },

  NLLB_54B: {
    name: 'NLLB_54B',
    displayName: 'NLLB 54B',
    family: 'NLLB',
    size: '54B',
    parameters: '54B',
    cost: {
      energyConsumption: 1.2, // 1.2 Wh par traduction
      computationalCost: 10,
      co2Equivalent: 0.624, // 624 milligrammes
      monetaryEquivalent: 0.45, // 0.45 centime
      memoryUsage: 54000, // 54 GB
      inferenceTime: 5000 // 5s
    },
    color: '#991b1b', // Rouge foncé - extrêmement coûteux
    quality: 'premium'
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
