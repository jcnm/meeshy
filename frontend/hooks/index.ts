// Hooks React personnalisés pour Meeshy

// Hook de messaging unifié (migration vers Socket.IO COMPLETE)
export { useMessaging } from './use-messaging';
export { useSocketIOMessaging } from './use-socketio-messaging';
export { useTypingIndicator } from './use-typing-indicator';

// Traduction unifiée
export { useTranslation } from './use-translation';

// Interface utilisateur et notifications
export { useNotifications } from './use-notifications';
export { useOnlinePresence } from './use-online-presence';
export { useUserPreferences } from './use-user-preferences';
export { useFontPreference } from './use-font-preference';
