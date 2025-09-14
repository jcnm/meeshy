/**
 * Interface pour les extensions de Message avec traductions
 * Utilisé dans les composants BubbleMessage et stream pages
 * @deprecated Utiliser UIMessage de message-types.ts
 */
import type { User } from '@shared/types';
import type { UIMessage } from '@shared/types/message-types';

export interface BubbleStreamMessage extends UIMessage {
  isTranslated: boolean;
  translatedFrom?: string;
}

// Alias pour compatibilité
export type { UIMessage as BubbleStreamMessageV2 };

export interface BubbleStreamPageProps {
  user: User;
  conversationId?: string; // Optionnel, par défaut "meeshy" pour la conversation globale
  isAnonymousMode?: boolean; // Mode anonyme pour les liens partagés
  linkId?: string; // ID du lien partagé en mode anonyme
  initialParticipants?: User[]; // Participants initiaux pour les sessions anonymes
}

/**
 * Types pour les choix de langues utilisateur
 */
export interface LanguageChoice {
  code: string;
  name: string;
  description: string;
  flag: string;
  isDefault: boolean;
}

/**
 * Configuration linguistique de l'utilisateur pour le stream
 */
export interface UserLanguageConfig {
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
}
