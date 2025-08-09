/**
 * Hook de messagerie unifié - Migration vers Socket.IO
 * 
 * ⚠️ OBSOLÈTE : Ce fichier est un alias temporaire vers useSocketIOMessaging
 * Utilisez directement useSocketIOMessaging dans vos nouveaux composants
 */

'use client';

// Réexporter le hook Socket.IO sous l'ancien nom pour compatibilité
export { 
  useSocketIOMessaging as useMessaging
} from './use-socketio-messaging';

// Réexporter les types pour compatibilité
export type { 
  UseSocketIOMessagingOptions as UseMessagingOptions,
  UseSocketIOMessagingReturn as UseMessagingReturn
} from './use-socketio-messaging';
