// Hooks React personnalisés organisés

// Hooks optimisés (recommandés)
export * from './optimized';

// Hooks spécialisés utiles
export { useNotifications } from './use-notifications';
export { useOnlinePresence } from './use-online-presence';
export { useSimpleTranslation } from './use-simple-translation';
export { useTranslationCache } from './use-translation-cache';
export { useUserPreferences } from './use-user-preferences';
export { useModelStatus } from './useModelStatus';

// Note: Les hooks legacy sont disponibles dans ./legacy/ mais déconseillés
// Utiliser les hooks optimisés à la place pour de meilleures performances
