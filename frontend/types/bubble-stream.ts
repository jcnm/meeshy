/**
 * Interface pour les extensions de Message avec traductions
 * Utilisé dans les composants BubbleMessage et stream pages
 */
import type { Message, User, BubbleTranslation } from '@shared/types';

export interface BubbleStreamMessage extends Message {
  location?: string;
  originalLanguage: string;
  isTranslated: boolean;
  translatedFrom?: string;
  translations: BubbleTranslation[];
  originalContent: string; // Contenu original de l'auteur
}

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
