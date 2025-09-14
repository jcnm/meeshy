/**
 * Utilitaires pour la conversion entre types de messages
 */

import type { GatewayMessage, UIMessage, UITranslationState } from '@shared/types/message-types';
import { gatewayToUIMessage } from '@shared/types/message-types';
import type { User } from '@shared/types';

/**
 * Convertit une liste de GatewayMessage en UIMessage pour l'affichage
 */
export function convertGatewayMessagesToUI(
  gatewayMessages: GatewayMessage[],
  currentUser: User,
  userLanguage: string
): UIMessage[] {
  return gatewayMessages.map(gatewayMessage => 
    gatewayToUIMessage(gatewayMessage, userLanguage, {
      canEdit: gatewayMessage.senderId === currentUser.id,
      canDelete: gatewayMessage.senderId === currentUser.id,
      canTranslate: true,
      canReply: true
    })
  );
}

/**
 * Met à jour un UIMessage avec une nouvelle traduction
 */
export function addTranslationToUIMessage(
  uiMessage: UIMessage,
  targetLanguage: string,
  translatedContent: string,
  model: 'basic' | 'medium' | 'premium' = 'basic',
  confidence: number = 0.9
): UIMessage {
  const newTranslation: UITranslationState = {
    language: targetLanguage,
    content: translatedContent,
    status: 'completed',
    timestamp: new Date(),
    confidence,
    model,
    fromCache: false
  };

  // Remplacer ou ajouter la traduction
  const updatedTranslations = uiMessage.uiTranslations.filter(t => t.language !== targetLanguage);
  updatedTranslations.push(newTranslation);

  // Enlever la langue des états "translating"
  const updatedTranslatingLanguages = new Set(uiMessage.translatingLanguages);
  updatedTranslatingLanguages.delete(targetLanguage);

  return {
    ...uiMessage,
    uiTranslations: updatedTranslations,
    translatingLanguages: updatedTranslatingLanguages
  };
}

/**
 * Marque une langue comme "en cours de traduction"
 */
export function markLanguageAsTranslating(
  uiMessage: UIMessage,
  targetLanguage: string
): UIMessage {
  const translatingLanguages = new Set(uiMessage.translatingLanguages);
  translatingLanguages.add(targetLanguage);

  // Ajouter ou mettre à jour l'état UI
  const uiTranslations = [...uiMessage.uiTranslations];
  const existingIndex = uiTranslations.findIndex(t => t.language === targetLanguage);
  
  if (existingIndex >= 0) {
    uiTranslations[existingIndex] = {
      ...uiTranslations[existingIndex],
      status: 'translating'
    };
  } else {
    uiTranslations.push({
      language: targetLanguage,
      content: '',
      status: 'translating',
      timestamp: new Date(),
      fromCache: false
    });
  }

  return {
    ...uiMessage,
    translatingLanguages,
    uiTranslations
  };
}

/**
 * Marque une traduction comme échouée
 */
export function markTranslationAsFailed(
  uiMessage: UIMessage,
  targetLanguage: string,
  errorMessage: string
): UIMessage {
  const translatingLanguages = new Set(uiMessage.translatingLanguages);
  translatingLanguages.delete(targetLanguage);

  const uiTranslations = uiMessage.uiTranslations.map(t =>
    t.language === targetLanguage
      ? {
          ...t,
          status: 'failed' as const,
          error: errorMessage,
          timestamp: new Date()
        }
      : t
  );

  return {
    ...uiMessage,
    translatingLanguages,
    uiTranslations
  };
}