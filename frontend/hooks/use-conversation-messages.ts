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
} from '@/shared/types';
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
      console.log('📬 Messages déjà chargés pour cette conversation, pas de rechargement');
      return;
    }

    try {
      setIsLoadingMessages(true);
      console.log(`📬 Chargement des messages pour la conversation: ${targetConversationId} (isNew: ${isNewConversation})`);

      // Nettoyer les messages existants si changement de conversation
      if (conversationId !== targetConversationId && messages.length > 0) {
        console.log('🧹 Nettoyage des messages avant chargement de la nouvelle conversation');
        setMessages([]);
        setTranslatedMessages([]);
      }

      let response;
      
      if (isAnonymousMode && linkId) {
        // Mode anonyme : utiliser les routes des liens partagés
        const sessionToken = localStorage.getItem('anonymous_session_token');
        
        if (!sessionToken) {
          console.log('⚠️ Pas de session anonyme disponible');
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
          console.log('⚠️ Pas de token d\'authentification disponible');
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
        console.log('🔍 Debug: Structure complète de responseData:', responseData);
        
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
        
        console.log('✅ Messages existants chargés:', existingMessages.length);
        
        // Debug: Afficher le contenu des premiers messages
        if (existingMessages.length > 0) {
          console.log('🔍 Debug: Premier message reçu:', existingMessages[0]);
          console.log('🔍 Debug: Traductions du premier message:', existingMessages[0]?.translations);
        }
        
        // Vérifier que la conversation sélectionnée n'a pas changé
        if (conversationId !== targetConversationId) {
          console.log('🚫 Conversation changée pendant le chargement, abandon');
          return;
        }
        
        // Vérifier que existingMessages est bien un tableau
        if (!Array.isArray(existingMessages)) {
          console.error('❌ existingMessages n\'est pas un tableau:', typeof existingMessages, existingMessages);
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
        
        // Debug: Vérifier les messages triés
        console.log('🔍 Debug: Messages triés avant traitement:', sortedMessages.slice(0, 2).map(m => ({
          id: m.id,
          content: m.content,
          senderId: m.senderId,
          createdAt: m.createdAt,
          translations: m.translations?.length || 0
        })));

        // Utiliser le hook pour traiter les messages avec traductions
        const bubbleMessages: BubbleStreamMessage[] = sortedMessages
          .map((msg: any, index: number) => {
            const processed = processMessageWithTranslations(msg);
            if (index < 3) {
              console.log(`📬 Message ${index + 1} (${processed.id}): ${processed.translations.length} traductions`);
            }
            return processed;
          });

        // Mettre à jour les messages traduits
        setTranslatedMessages(bubbleMessages);
        
        // Compter les traductions disponibles et les traductions manquantes
        const totalTranslations = bubbleMessages.reduce((sum, msg) => sum + (msg.translations?.length ?? 0), 0);
        
        // 🐛 DEBUG: Résumé simple du chargement
        console.log(`📊 Chargement terminé: ${bubbleMessages.length} messages, ${totalTranslations} traductions au total`);
        const translatedMessagesCount = bubbleMessages.filter(msg => msg.isTranslated).length;
        
        // Identifier les messages nécessitant des traductions
        const messagesNeedingTranslation = bubbleMessages.filter(msg => {
          const required = getRequiredTranslations(msg);
          return required.length > 0;
        });
        
        console.log(`📊 Statistiques traductions détaillées:`, {
          totalMessages: bubbleMessages.length,
          totalTranslations,
          translatedMessages: translatedMessagesCount,
          messagesNeedingTranslation: messagesNeedingTranslation.length,
          userPreferredLanguage: resolveUserPreferredLanguage(),
          userLanguagePreferences: getUserLanguagePreferences()
        });
        
        toast.success(`📨 ${existingMessages.length} messages chargés (${totalTranslations} traductions, ${messagesNeedingTranslation.length} nécessitent traduction)`);
        
        // TODO: Déclencher la traduction automatique des messages manquants si activée
        if (currentUser.autoTranslateEnabled && messagesNeedingTranslation.length > 0) {
          console.log(`🔄 ${messagesNeedingTranslation.length} messages à traduire automatiquement`);
          // Ici on pourrait déclencher les traductions en arrière-plan
        }
        
      } else {
        console.log('⚠️ Impossible de charger les messages existants. Status:', response.status);
        try {
          const errorData = await response.text();
          console.log('🔍 Debug: Réponse d\'erreur:', errorData);
        } catch (e) {
          console.log('🔍 Debug: Impossible de lire la réponse d\'erreur');
        }
        toast.error('Erreur lors du chargement des messages');
        
        // Vérifier si cette conversation est toujours celle demandée
        if (conversationId !== targetConversationId) {
          console.log('🚫 Conversation changée pendant l\'erreur, abandon');
          return;
        }

        // Laisser la liste de messages vide
        setMessages([]);
        setTranslatedMessages([]);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
      toast.error('Erreur de connexion lors du chargement des messages');
      
      // Vérifier si cette conversation est toujours celle demandée
      if (conversationId !== targetConversationId) {
        console.log('🚫 Conversation changée pendant l\'erreur, abandon');
        return;
      }

      // Laisser la liste de messages vide
      setMessages([]);
      setTranslatedMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUser?.id, processMessageWithTranslations, getRequiredTranslations, resolveUserPreferredLanguage, getUserLanguagePreferences, conversationId]);

  // Fonction pour vider les messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setTranslatedMessages([]);
  }, []);

  // Fonction pour ajouter un nouveau message en temps réel
  const addMessage = useCallback((message: Message) => {
    console.log('📬 Ajout nouveau message en temps réel:', message.id);
    
    // Vérifier que le message appartient à la conversation actuelle
    if (conversationId && message.conversationId !== conversationId) {
      console.log('📬 Message ignoré - appartient à une autre conversation');
      return;
    }
    
    // Traiter le message avec les traductions
    const processedMessage = processMessageWithTranslations(message);
    
    // Mettre à jour les messages bruts et traduits de manière optimisée
    setMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        console.log('📬 Message déjà présent, pas de doublon');
        return prev;
      }
      // Ajouter le nouveau message à la fin (ordre chronologique)
      return [...prev, message as MessageWithTranslations];
    });
    
    setTranslatedMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        console.log('📬 Message traduit déjà présent, pas de doublon');
        return prev;
      }
      // Ajouter le nouveau message traduit à la fin (ordre chronologique)
      return [...prev, processedMessage];
    });
  }, [processMessageWithTranslations, conversationId]);

  // Fonction pour mettre à jour les traductions d'un message existant
  const updateMessageTranslations = useCallback((messageId: string, translations: TranslationData[]) => {
    console.log('🌐 Mise à jour traductions pour message:', messageId, translations);
    
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
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              cached: Boolean(newTranslation.cached),
              createdAt: new Date(),
              confidenceScore: newTranslation.confidenceScore,
            };
          } else {
            // Ajouter la nouvelle traduction
            mergedTranslations.push({
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              cached: Boolean(newTranslation.cached),
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
          messageId,
          sourceLanguage: (msg as any).originalLanguage || 'auto',
          targetLanguage: t.language,
          translatedContent: t.content,
          translationModel: 'basic' as 'basic' | 'medium' | 'premium',
          cacheKey: `${messageId}_${t.language}`,
          cached: true,
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
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              cached: Boolean(newTranslation.cached),
              confidenceScore: newTranslation.confidenceScore ?? 0.9,
            };
          } else {
            mergedTranslations.push({
              messageId,
              sourceLanguage: newTranslation.sourceLanguage,
              targetLanguage: newTranslation.targetLanguage,
              translatedContent: newTranslation.translatedContent,
              translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: newTranslation.cacheKey,
              cached: Boolean(newTranslation.cached),
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
        console.log('🔄 Message retraité avec traductions fusionnées:', {
          messageId,
          originalContent: updatedMessage.content,
          isTranslated: reprocessedMessage.isTranslated,
          translationsCount: mergedTranslations.length,
          newTranslationsAdded: translations.length
        });
        
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
