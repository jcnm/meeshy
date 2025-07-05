/**
 * Hook React pour gérer les traductions avec persistance
 */

import { useState, useEffect, useCallback } from 'react';
import { translationService, TranslationRequest, TranslationResult, CachedTranslation } from '@/lib/translation-service';
import { TranslatedMessage, SUPPORTED_LANGUAGES } from '@/types';
import { toast } from 'sonner';

export interface UseTranslationHookResult {
  translate: (messageId: string, targetLanguage: string, forceRetranslate?: boolean) => Promise<void>;
  loadMessageTranslations: (messageId: string) => Promise<void>;
  isTranslating: boolean;
  translations: Record<string, CachedTranslation[]>; // messageId -> translations
}

export function useMessageTranslation(
  messages: TranslatedMessage[],
  setMessages: React.Dispatch<React.SetStateAction<TranslatedMessage[]>>,
  currentUserLanguage: string
): UseTranslationHookResult {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<Record<string, CachedTranslation[]>>({});

  /**
   * Charge les traductions existantes pour un message
   */
  const loadMessageTranslations = useCallback(async (messageId: string) => {
    try {
      const messageTranslations = await translationService.getMessageTranslations(messageId);
      
      setTranslations(prev => ({
        ...prev,
        [messageId]: messageTranslations
      }));

      // Mettre à jour le message avec les traductions chargées
      if (messageTranslations.length > 0) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            const translations = messageTranslations.map(t => ({
              language: t.targetLanguage,
              content: t.translatedText,
              flag: getLanguageFlag(t.targetLanguage),
              createdAt: new Date(t.timestamp),
              modelUsed: t.modelUsed,
              modelCost: undefined // TODO: récupérer depuis TRANSLATION_MODELS
            }));

            // Trouver la traduction pour la langue par défaut de l'utilisateur
            const userLanguageTranslation = messageTranslations.find(
              t => t.targetLanguage === currentUserLanguage
            );

            return {
              ...msg,
              translations,
              translatedContent: userLanguageTranslation?.translatedText,
              isTranslated: !!userLanguageTranslation,
              showingOriginal: !userLanguageTranslation,
              targetLanguage: userLanguageTranslation?.targetLanguage
            };
          }
          return msg;
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des traductions:', error);
    }
  }, [setMessages, currentUserLanguage]);

  /**
   * Charge les traductions pour tous les messages au démarrage
   */
  useEffect(() => {
    const loadAllTranslations = async () => {
      for (const message of messages) {
        await loadMessageTranslations(message.id);
      }
    };

    if (messages.length > 0) {
      loadAllTranslations();
    }
  }, [messages, loadMessageTranslations]);

  /**
   * Effectue une traduction
   */
  const translate = useCallback(async (
    messageId: string, 
    targetLanguage: string, 
    forceRetranslate = false
  ) => {
    if (isTranslating) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) {
      toast.error('Message non trouvé');
      return;
    }

    setIsTranslating(true);

    try {
      const request: TranslationRequest = {
        text: message.content,
        sourceLanguage: message.originalLanguage || 'fr',
        targetLanguage,
        messageId,
        forceRetranslate
      };

      const result: TranslationResult = await translationService.translate(request);
      
      // Créer l'objet translation pour l'interface
      const translation = {
        language: targetLanguage,
        content: result.translatedText,
        flag: getLanguageFlag(targetLanguage),
        createdAt: new Date(),
        modelUsed: result.modelUsed,
        modelCost: undefined // TODO: récupérer depuis TRANSLATION_MODELS
      };

      // Mettre à jour le message dans l'état local
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          // Si c'est une retraduction vers une langue existante, remplacer
          const existingTranslations = msg.translations || [];
          const updatedTranslations = existingTranslations.filter(t => t.language !== targetLanguage);
          updatedTranslations.push(translation);

          // Si c'est la langue par défaut de l'utilisateur, mettre à jour le contenu affiché
          const isUserLanguage = targetLanguage === currentUserLanguage;

          return {
            ...msg,
            translations: updatedTranslations,
            ...(isUserLanguage && {
              translatedContent: result.translatedText,
              isTranslated: true,
              showingOriginal: false,
              targetLanguage
            })
          };
        }
        return msg;
      }));

      // Recharger les traductions depuis le cache pour être sûr
      await loadMessageTranslations(messageId);

      const statusText = result.fromCache ? 'Traduction chargée depuis le cache' : 'Traduction effectuée';
      toast.success(`${statusText} (${result.modelUsed})`);

    } catch (error) {
      console.error('Erreur de traduction:', error);
      toast.error('Erreur lors de la traduction');

      // Marquer le message comme ayant échoué
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, translationFailed: true }
          : msg
      ));
    } finally {
      setIsTranslating(false);
    }
  }, [isTranslating, messages, setMessages, currentUserLanguage, loadMessageTranslations]);

  return {
    translate,
    loadMessageTranslations,
    isTranslating,
    translations
  };
}

/**
 * Helper function pour obtenir le drapeau d'une langue
 */
function getLanguageFlag(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  return language?.flag || '🌐';
}
