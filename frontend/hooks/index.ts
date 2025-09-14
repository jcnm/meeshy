// Hooks React personnalisés pour Meeshy

// Hook de messaging unifié (Socket.IO + Envoi + Typing)
export { useSocketIOMessaging } from './use-socketio-messaging';
export { useMessaging } from './use-messaging'; // Nouveau hook fusionné

// Traduction unifiée
export { useTranslation } from './use-translation'; // Étendu avec les stats
export { useMessageTranslations } from './use-message-translations';
export { useMessageLoader } from './use-message-loader';
export { useConversationMessages } from './use-conversation-messages';

// Langues unifiées
export { useLanguage } from './use-language'; // Nouveau hook fusionné

// Interface utilisateur et notifications
export { useNotifications } from './use-notifications';
export { useFontPreference } from './use-font-preference';
export { useFixRadixZIndex } from './use-fix-z-index';

// Authentification
export { useAuth } from './use-auth';
export { useAuthGuard } from './use-auth-guard';

// Hooks legacy supprimés - migration vers les nouveaux hooks unifiés terminée
