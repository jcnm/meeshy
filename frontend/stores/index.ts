/**
 * Pure Zustand stores - Efficient state management for Meeshy application
 */

// Auth Store
export {
  useAuthStore,
  useUser,
  useIsAuthenticated,
  useIsAuthChecking,
  useAuthActions,
} from './auth-store';

// App Store
export {
  useAppStore,
  useTheme,
  useIsOnline,
  useNotifications,
  useIsInitialized,
  useAppActions,
} from './app-store';

// Language Store
export {
  useLanguageStore,
  useCurrentInterfaceLanguage,
  useCurrentMessageLanguage,
  useAvailableLanguages,
  useUserLanguageConfig,
  useLanguageActions,
} from './language-store';

// I18n Store
export {
  useI18nStore,
  useCurrentI18nLanguage,
  useI18nLoading,
  useI18nError,
  useTranslate,
  useI18nActions,
} from './i18n-store';

// Conversation Store
export {
  useConversationStore,
  useConversations,
  useCurrentConversation,
  useConversationMessages,
  useConversationLoading,
  useTypingUsers,
  useConversationActions,
} from './conversation-store';

// Store Initializer
export { StoreInitializer } from './store-initializer';
