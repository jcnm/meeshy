/**
 * Compatibility hooks for existing components
 * These provide the same interface as the old Context API hooks but use Zustand stores
 */

import { 
  useUser as useUserStore,
  useAuthActions,
  useCurrentInterfaceLanguage,
  useCurrentMessageLanguage,
  useUserLanguageConfig,
  useLanguageActions,
  useConversations as useConversationsStore,
  useCurrentConversation,
  useConversationActions,
} from '@/stores';

// Legacy useUser hook compatibility
export function useUser() {
  const user = useUserStore();
  const { setUser, logout } = useAuthActions();
  
  return {
    user,
    setUser,
    logout,
    isAuthChecking: false, // This is handled by the store now
  };
}

// Legacy useAppContext hook compatibility
export function useAppContext() {
  const user = useUserStore();
  
  return {
    state: {
      user,
      isAuthChecking: false,
      translationCache: {}, // This is handled by i18n store now
    },
    dispatch: () => {
      console.warn('[COMPATIBILITY] dispatch is deprecated, use direct store actions instead');
    },
  };
}

// Legacy useLanguage hook compatibility
export function useLanguage() {
  const currentInterfaceLanguage = useCurrentInterfaceLanguage();
  const userLanguageConfig = useUserLanguageConfig();
  const { setInterfaceLanguage, setCustomDestinationLanguage, isLanguageSupported } = useLanguageActions();
  
  return {
    userLanguageConfig,
    currentInterfaceLanguage,
    setCustomDestinationLanguage,
    setInterfaceLanguage,
    isLanguageSupported,
    getSupportedLanguages: () => [
      { code: 'fr', name: 'Français', nativeName: 'Français' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Español', nativeName: 'Español' },
      { code: 'de', name: 'Deutsch', nativeName: 'Deutsch' },
      { code: 'pt', name: 'Português', nativeName: 'Português' },
      { code: 'it', name: 'Italiano', nativeName: 'Italiano' },
    ],
  };
}

// Legacy useConversation hook compatibility
export function useConversation() {
  const conversations = useConversationsStore();
  const currentConversation = useCurrentConversation();
  const { loadConversations, selectConversation, addMessage, sendMessage, requestTranslation } = useConversationActions();
  
  return {
    conversations,
    currentConversation,
    isLoadingConversations: false,
    messages: new Map(), // This would need to be implemented based on your needs
    isLoadingMessages: new Map(),
    hasMoreMessages: new Map(),
    translatingMessages: new Map(),
    
    // Actions
    loadConversations,
    loadConversation: async (id: string) => {}, // Implement if needed
    selectConversation,
    addConversation: () => {}, // Implement if needed
    updateConversation: () => {}, // Implement if needed
    loadMessages: async () => {}, // Implement if needed
    addMessage,
    updateMessage: () => {}, // Implement if needed
    deleteMessage: () => {}, // Implement if needed
    requestTranslation,
    addTranslation: () => {}, // Implement if needed
    sendMessage,
  };
}

// Legacy useTranslationCache hook compatibility
export function useTranslationCache() {
  return {
    cache: {},
    addToCache: (key: string, data: any) => {
      console.warn('[COMPATIBILITY] addToCache is deprecated, use i18n store instead');
    },
  };
}
