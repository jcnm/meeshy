import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import { messageTranslationService } from '@/services/message-translation.service';
import type { 
  User, 
  Message, 
  MessageWithTranslations, 
  TranslationData,
  BubbleTranslation 
} from '@shared/types';
import type { BubbleStreamMessage } from '@/types/bubble-stream';

interface UseConversationMessagesProps {
  currentUser: User;
  conversationId?: string;
  isAnonymousMode?: boolean;
  linkId?: string;
}

interface UseConversationMessagesReturn {
  messages: MessageWithTranslations[];
  translatedMessages: BubbleStreamMessage[];
  isLoadingMessages: boolean;
  loadMessages: (conversationId: string, isNewConversation?: boolean) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
  updateMessageTranslations: (messageId: string, translations: TranslationData[]) => void;
  refreshMessages: () => Promise<void>;
}

/**
 * Hook factorized pour la gestion des messages et traductions dans les conversations
 * Extrait de la logique commune entre BubbleStreamPage et ConversationLayoutResponsive
 */
export function useConversationMessages({ 
  currentUser, 
  conversationId,
  isAnonymousMode = false,
  linkId
}: UseConversationMessagesProps): UseConversationMessagesReturn {
  const [messages, setMessages] = useState<MessageWithTranslations[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<BubbleStreamMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getRequiredTranslations,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage
  } = useMessageTranslations({ currentUser });

  // Fonction pour charger les messages depuis l'API
  const loadMessages = useCallback(async (targetConversationId: string, isNewConversation = false) => {
    if (!currentUser?.id) return;
    
    // Optimisation: éviter les rechargements inutiles
    if (!isNewConversation && conversationId === targetConversationId && messages.length > 0) {
      return;
    }

    try {
      setIsLoadingMessages(true);

      // Nettoyer les messages existants si changement de conversation
      if (conversationId !== targetConversationId && messages.length > 0) {
        setMessages([]);
        setTranslatedMessages([]);
      }

      let response;
      
      if (isAnonymousMode && linkId) {
        // Mode anonyme : utiliser les routes des liens partagés
        const sessionToken = localStorage.getItem('anonymous_session_token');
        
        if (!sessionToken) {
          setIsLoadingMessages(false);
          return;
        }
        
        response = await fetch(buildApiUrl(`/links/${linkId}/messages`), {
          headers: {
            'X-Session-Token': sessionToken,
            'Content-Type': 'application/json'
          }
        });
      } else {
        // Mode normal : utiliser les routes des conversations
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          setIsLoadingMessages(false);
          return;
        }
        
        response = await fetch(buildApiUrl(`/conversations/${targetConversationId}/messages`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
      
      if (response.ok) {
        const responseData = await response.json();
        
        // Gérer différents formats de réponse
        let existingMessages = [];
        if (responseData.data?.messages) {
          existingMessages = responseData.data.messages;
        } else if (responseData.messages) {
          existingMessages = responseData.messages;
        } else if (Array.isArray(responseData.data)) {
          existingMessages = responseData.data;
        } else if (Array.isArray(responseData)) {
          existingMessages = responseData;
        }
        
        // Vérifier que la conversation sélectionnée n'a pas changé
        if (conversationId !== targetConversationId) {
          return;
        }
        
        // Vérifier que existingMessages est bien un tableau
        if (!Array.isArray(existingMessages)) {
          toast.error('Format de données invalide');
          setIsLoadingMessages(false);
          return;
        }
        
        // Trier les messages par date de création
        const sortedMessages = existingMessages.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Mettre à jour les messages APRÈS avoir vérifié la cohérence
        setMessages(sortedMessages);

        // Utiliser le hook pour traiter les messages avec traductions
        const bubbleMessages: BubbleStreamMessage[] = sortedMessages
          .map((msg: any) => processMessageWithTranslations(msg));

        // Mettre à jour les messages traduits
        setTranslatedMessages(bubbleMessages);
        
        // Compter les traductions disponibles et les traductions manquantes
        const totalTranslations = bubbleMessages.reduce((sum, msg) => sum + (msg.translations?.length ?? 0), 0);
        
        // Identifier les messages nécessitant des traductions
        const messagesNeedingTranslation = bubbleMessages.filter(msg => {
          const required = getRequiredTranslations(msg);
          return required.length > 0;
        });
        
        toast.success(`📨 ${existingMessages.length} messages chargés (${totalTranslations} traductions, ${messagesNeedingTranslation.length} nécessitent traduction)`);
        
        // Déclencher la traduction automatique des messages manquants si activée OU si c'est le chargement initial
        // Mais PAS en mode anonyme (permissions limitées)
        const shouldTriggerTranslations = !isAnonymousMode && (currentUser.autoTranslateEnabled || isNewConversation);
        
        if (shouldTriggerTranslations && messagesNeedingTranslation.length > 0) {
          const triggerReason = currentUser.autoTranslateEnabled ? 'auto-translate activé' : 'chargement initial';
          console.log(`🔄 Traduction déclenchée (${triggerReason}): ${messagesNeedingTranslation.length} messages nécessitent une traduction`);
          
          // Déclencher les traductions en arrière-plan pour les messages manquants
          const translationPromises = messagesNeedingTranslation.map(async (msg) => {
            try {
              const requiredLangs = getRequiredTranslations(msg);
              if (requiredLangs.length > 0) {
                console.log(`📝 Demande de traduction pour message ${msg.id} vers:`, requiredLangs);
                
                // Utiliser le service de traduction pour chaque langue requise
                const translationPromises = requiredLangs.map(lang => 
                  messageTranslationService.requestTranslation({
                    messageId: msg.id,
                    targetLanguage: lang,
                    sourceLanguage: msg.originalLanguage
                  })
                );
                
                const translations = await Promise.all(translationPromises);
                
                // Mettre à jour les traductions du message
                const validTranslations = translations.filter(t => t?.status === 'completed');
                if (validTranslations.length > 0) {
                  console.log(`✅ Traductions reçues pour message ${msg.id}:`, validTranslations.length);
                  // Note: updateMessageTranslations sera appelé automatiquement via WebSocket
                }
              }
            } catch (error) {
              console.error(`❌ Erreur traduction message ${msg.id}:`, error);
            }
          });
          
          // Ne pas attendre les traductions pour ne pas bloquer l'interface
          Promise.allSettled(translationPromises).then(() => {
            console.log('Toutes les demandes de traduction automatique ont été traitées');
          });
        }
        
      } else {
        console.error('Erreur lors du chargement des messages');
        
        // Vérifier si cette conversation est toujours celle demandée
        if (conversationId !== targetConversationId) {
          return;
        }

        // Laisser la liste de messages vide
        setMessages([]);
        setTranslatedMessages([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
      console.error('Erreur de connexion lors du chargement des messages');
      
      // Vérifier si cette conversation est toujours celle demandée
      if (conversationId !== targetConversationId) {
        return;
      }

      // Laisser la liste de messages vide
      setMessages([]);
      setTranslatedMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUser?.id, conversationId, messages.length, getRequiredTranslations, isAnonymousMode]);

  // Fonction pour vider les messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setTranslatedMessages([]);
  }, []);

  // Fonction pour ajouter un nouveau message en temps réel
  const addMessage = useCallback((message: Message) => {
    // Vérifier que le message appartient à la conversation actuelle
    if (conversationId && message.conversationId !== conversationId) {
      return;
    }
    
    // Traiter le message avec les traductions
    const processedMessage = processMessageWithTranslations(message);
    
    // Mettre à jour les messages bruts et traduits de manière optimisée
    setMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      // Ajouter le nouveau message à la fin (ordre chronologique)
      return [...prev, message as MessageWithTranslations];
    });
    
    setTranslatedMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      // Ajouter le nouveau message traduit à la fin (ordre chronologique)
      return [...prev, processedMessage];
    });
  }, [processMessageWithTranslations, conversationId]);

  // Fonction pour mettre à jour les traductions d'un message existant
  const updateMessageTranslations = useCallback((messageId: string, translations: TranslationData[]) => {
    
    // Mettre à jour les messages bruts - FUSION des traductions existantes avec les nouvelles
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const msgWithTranslations = msg as MessageWithTranslations;
        const existingTranslations = msgWithTranslations.translations || [];
        
        // Fusionner les traductions - garder les existantes et ajouter les nouvelles
        const mergedTranslations = [...existingTranslations];
        
        translations.forEach((newTranslation: TranslationData) => {
          const existingIndex = mergedTranslations.findIndex(
            existing => existing.targetLanguage === newTranslation.targetLanguage
          );
          
          if (existingIndex >= 0) {
            // Remplacer la traduction existante par la nouvelle
            mergedTranslations[existingIndex] = {
              id: `${messageId}_${newTranslation.targetLanguage}`,
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              createdAt: new Date(),
              confidenceScore: newTranslation.confidenceScore,
            };
          } else {
            // Ajouter la nouvelle traduction
            mergedTranslations.push({
              id: `${messageId}_${newTranslation.targetLanguage}`,
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              createdAt: new Date(),
              confidenceScore: newTranslation.confidenceScore,
            });
          }
        });
        
        return {
          ...msg,
          translations: mergedTranslations
        } as MessageWithTranslations;
      }
      return msg;
    }));
    
    // Mettre à jour les messages traduits
    setTranslatedMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Obtenir les traductions existantes du BubbleStreamMessage
        const existingBubbleTranslations = msg.translations || [];

        // Normaliser les traductions existantes (BubbleTranslation -> MessageTranslationCache)
        const normalizedExisting = existingBubbleTranslations.map((t: BubbleTranslation) => ({
          id: `${messageId}_${t.language}`,
          messageId,
          sourceLanguage: (msg as any).originalLanguage || 'auto',
          targetLanguage: t.language,
          translatedContent: t.content,
          translationModel: 'basic' as 'basic' | 'medium' | 'premium',
          cacheKey: `${messageId}_${t.language}`,
          confidenceScore: t.confidence ?? 0.9,
          createdAt: new Date(),
        }));

        // Fusionner les traductions normalisées avec les nouvelles
        const mergedTranslations = [...normalizedExisting];

        translations.forEach((newTranslation: TranslationData) => {
          const idx = mergedTranslations.findIndex((existing) => existing.targetLanguage === newTranslation.targetLanguage);
          if (idx >= 0) {
            mergedTranslations[idx] = {
              ...mergedTranslations[idx],
              id: `${messageId}_${newTranslation.targetLanguage}`,
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              confidenceScore: newTranslation.confidenceScore ?? 0.9,
            };
          } else {
            mergedTranslations.push({
              id: `${messageId}_${newTranslation.targetLanguage}`,
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              createdAt: new Date(),
              confidenceScore: newTranslation.confidenceScore ?? 0.9,
            });
          }
        });
        
        // Retraiter le message avec les traductions fusionnées
        const updatedMessage = {
          ...msg,
          translations: mergedTranslations
        };
        
        const reprocessedMessage = processMessageWithTranslations(updatedMessage) as BubbleStreamMessage;
        
        return reprocessedMessage;
      }
      return msg;
    }));
  }, [processMessageWithTranslations]);

  // Fonction pour recharger les messages de la conversation actuelle
  const refreshMessages = useCallback(async () => {
    if (conversationId) {
      await loadMessages(conversationId, true);
    }
  }, [conversationId]);

  return {
    messages,
    translatedMessages,
    isLoadingMessages,
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations,
    refreshMessages
  };
}
