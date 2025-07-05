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
    if (!messageId) {
      console.warn('messageId est requis pour charger les traductions');
      return;
    }

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
      // Ne pas faire crash l'app, juste logger l'erreur
    }
  }, [setMessages, currentUserLanguage]);

  /**
   * Charge les traductions pour tous les messages au démarrage
   */
  useEffect(() => {
    const loadAllTranslations = async () => {
      if (!messages || messages.length === 0) {
        return;
      }

      console.log(`🔄 Chargement des traductions pour ${messages.length} messages`);

      try {
        // Charger les traductions en parallèle mais avec limite
        const batchSize = 5; // Limiter à 5 messages en parallèle
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          await Promise.allSettled(
            batch.map(message => {
              if (message.id) {
                return loadMessageTranslations(message.id);
              }
              return Promise.resolve();
            })
          );
        }

        console.log('✅ Toutes les traductions chargées');
      } catch (error) {
        console.error('Erreur lors du chargement global des traductions:', error);
        // Ne pas faire crash l'app pour cette erreur
      }
    };

    loadAllTranslations();
  }, [messages.length, loadMessageTranslations]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Effectue une traduction
   */
  const translate = useCallback(async (
    messageId: string, 
    targetLanguage: string, 
    forceRetranslate = false
  ) => {
    // Vérifications préliminaires
    if (!messageId || !targetLanguage) {
      console.error('messageId et targetLanguage sont requis');
      toast.error('Paramètres de traduction manquants');
      return;
    }

    if (isTranslating) {
      console.warn('Traduction déjà en cours, ignorer la nouvelle demande');
      return;
    }

    const message = messages.find(m => m.id === messageId);
    if (!message) {
      console.error(`Message ${messageId} non trouvé`);
      toast.error('Message non trouvé');
      return;
    }

    if (!message.content || message.content.trim().length === 0) {
      console.error('Contenu du message vide');
      toast.error('Impossible de traduire un message vide');
      return;
    }

    setIsTranslating(true);

    try {
      console.log(`🔄 Début traduction: ${messageId} vers ${targetLanguage}`);
      
      const request: TranslationRequest = {
        text: message.content,
        sourceLanguage: message.originalLanguage || 'auto', // Utiliser détection automatique si non définie
        targetLanguage,
        messageId,
        forceRetranslate
      };

      const result: TranslationResult = await translationService.translate(request);
      
      console.log(`✅ Traduction terminée: ${result.modelUsed}, fromCache: ${result.fromCache}`);
      
      // Créer l'objet translation pour l'interface
      const translation = {
        language: targetLanguage,
        content: result.translatedText,
        flag: getLanguageFlag(targetLanguage),
        createdAt: new Date(),
        modelUsed: result.modelUsed,
        modelCost: undefined // TODO: récupérer depuis TRANSLATION_MODELS
      };

      // Mettre à jour le message dans l'état local de manière sécurisée
      setMessages(prev => {
        try {
          return prev.map(msg => {
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
          });
        } catch (error) {
          console.error('Erreur mise à jour état messages:', error);
          return prev; // Retourner l'état précédent en cas d'erreur
        }
      });

      // Recharger les traductions depuis le cache pour être sûr
      try {
        await loadMessageTranslations(messageId);
      } catch (error) {
        console.warn('Erreur rechargement traductions:', error);
        // Ne pas faire crash pour cette erreur
      }

      const statusText = result.fromCache ? 'Traduction chargée depuis le cache' : 'Traduction effectuée';
      toast.success(`${statusText} (${result.modelUsed})`);

    } catch (error) {
      console.error('Erreur de traduction:', error);
      
      // Afficher un message d'erreur plus informatif
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(`Erreur lors de la traduction: ${errorMessage}`);

      // Marquer le message comme ayant échoué de manière sécurisée
      setMessages(prev => {
        try {
          return prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, translationFailed: true }
              : msg
          );
        } catch (updateError) {
          console.error('Erreur mise à jour échec traduction:', updateError);
          return prev;
        }
      });
    } finally {
      setIsTranslating(false);
      console.log(`🏁 Fin traduction pour ${messageId}`);
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
