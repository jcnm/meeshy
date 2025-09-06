import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import type { User, Message, TranslatedMessage, MessageWithTranslations, TranslationData, MessageTranslationCache } from '@shared/types';
import type { BubbleStreamMessage } from '@/types/bubble-stream';

interface UseMessageLoaderProps {
  currentUser: User;
  conversationId?: string;
}

interface UseMessageLoaderReturn {
  messages: Message[];
  translatedMessages: TranslatedMessage[];
  isLoadingMessages: boolean;
  loadMessages: (conversationId: string, isNewConversation?: boolean) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
  updateMessageTranslations: (messageId: string, translations: TranslationData[]) => void;
}

export function useMessageLoader({ 
  currentUser, 
  conversationId 
}: UseMessageLoaderProps): UseMessageLoaderReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<TranslatedMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getRequiredTranslations,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage
  } = useMessageTranslations({ currentUser });

  // Fonction pour charger les messages existants depuis le serveur avec traductions optimisées
  const loadMessages = useCallback(async (targetConversationId: string, isNewConversation = false) => {
    if (!currentUser) return;
    
    // Si c'est une nouvelle conversation ou si on force le chargement, on continue
    // Sinon, vérifier si les messages sont déjà chargés pour cette conversation
    if (!isNewConversation && conversationId === targetConversationId && messages.length > 0) {
      console.log('📬 Messages déjà chargés pour cette conversation, pas de rechargement');
      return;
    }

    try {
      setIsLoadingMessages(true);
      console.log(`📬 Chargement des messages pour la conversation: ${targetConversationId} (isNew: ${isNewConversation})`);

      // Si on change de conversation, vider d'abord les messages existants
      if (conversationId !== targetConversationId && messages.length > 0) {
        console.log('🧹 Nettoyage des messages avant chargement de la nouvelle conversation');
        setMessages([]);
        setTranslatedMessages([]);
      }
      console.log(`📬 Chargement des messages pour la conversation ${targetConversationId}`);

      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.log('⚠️ Pas de token d\'authentification disponible');
        setIsLoadingMessages(false);
        return;
      }
      
      const response = await fetch(buildApiUrl(`/conversations/${targetConversationId}/messages`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
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
          console.log('🔍 Debug: Contenu du premier message:', {
            id: existingMessages[0]?.id,
            content: existingMessages[0]?.content,
            senderId: existingMessages[0]?.senderId,
            sender: existingMessages[0]?.sender,
            createdAt: existingMessages[0]?.createdAt
          });
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
          createdAt: m.createdAt
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
        setTranslatedMessages(bubbleMessages as unknown as TranslatedMessage[]);
        
        // Compter les traductions disponibles et les traductions manquantes
        const totalTranslations = bubbleMessages.reduce((sum, msg) => sum + (msg.translations?.length ?? 0), 0);
        
        // 🐛 DEBUG: Résumé simple du chargement
        console.log(`📊 Chargement terminé: ${bubbleMessages.length} messages, ${totalTranslations} traductions au total`);
        const translatedMessages = bubbleMessages.filter(msg => msg.isTranslated).length;
        
        // Identifier les messages nécessitant des traductions
        const messagesNeedingTranslation = bubbleMessages.filter(msg => {
          const required = getRequiredTranslations(msg);
          return required.length > 0;
        });
        
        console.log(`📊 Statistiques traductions détaillées:`, {
          totalMessages: bubbleMessages.length,
          totalTranslations,
          translatedMessages,
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
  }, [currentUser, processMessageWithTranslations, getRequiredTranslations, resolveUserPreferredLanguage, getUserLanguagePreferences, conversationId, messages.length]);

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
      return [...prev, message];
    });
    
    setTranslatedMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        console.log('📬 Message traduit déjà présent, pas de doublon');
        return prev;
      }
      // Ajouter le nouveau message traduit à la fin (ordre chronologique)
      return [...prev, processedMessage as unknown as TranslatedMessage];
    });
  }, [processMessageWithTranslations, conversationId]);

  // Fonction pour mettre à jour les traductions d'un message existant
  const updateMessageTranslations = useCallback((messageId: string, translations: TranslationData[]) => {
    console.log('🌐 Mise à jour traductions pour message:', messageId, translations);
    
    // Mettre à jour les messages bruts - FUSION des traductions existantes avec les nouvelles
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const msgWithTranslations = msg as MessageWithTranslations;
        const existingTranslations = (msgWithTranslations.translations as unknown as MessageTranslationCache[]) || [];
        
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
        const existingTranslations = (msg as MessageWithTranslations).translations || [];

        // Normaliser les traductions existantes (BubbleTranslation -> TranslationData)
        const normalizedExisting = existingTranslations.map((t: any): MessageTranslationCache => {
          if (t && typeof t === 'object' && 'targetLanguage' in t && 'translatedContent' in t) {
            // Assurer un translationModel typé et createdAt
            return {
              messageId: (t as any).messageId ?? messageId,
              sourceLanguage: (t as any).sourceLanguage,
              targetLanguage: (t as any).targetLanguage,
              translatedContent: (t as any).translatedContent,
              translationModel: ((t as any).translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
              cacheKey: (t as any).cacheKey ?? `${messageId}_${(t as any).targetLanguage}`,
              cached: Boolean((t as any).cached),
              createdAt: (t as any).createdAt ? new Date((t as any).createdAt) : new Date(),
              confidenceScore: (t as any).confidenceScore,
            };
          }
          // Convertir BubbleTranslation { language, content, confidence } -> TranslationData
          const normalized: MessageTranslationCache = {
            messageId,
            sourceLanguage: (msg as any).originalLanguage || 'auto',
            targetLanguage: t.language,
            translatedContent: t.content,
            translationModel: 'basic',
            cacheKey: `${messageId}_${t.language}`,
            cached: true,
            confidenceScore: t.confidence ?? 0.9,
            createdAt: new Date(),
          };
          return normalized;
        });

        // Fusionner les traductions normalisées avec les nouvelles
        const mergedTranslations: MessageTranslationCache[] = [...normalizedExisting];

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
              confidenceScore: newTranslation.confidenceScore,
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
              confidenceScore: newTranslation.confidenceScore,
            });
          }
        });
        
        // Retraiter le message avec les traductions fusionnées
        const updatedMessage = {
          ...msg,
          translations: mergedTranslations
        };
        
        const reprocessedMessage = processMessageWithTranslations(updatedMessage) as unknown as TranslatedMessage;
        console.log('🔄 Message retraité avec traductions fusionnées:', {
          messageId,
          originalContent: updatedMessage.content,
          translatedContent: reprocessedMessage.translatedContent,
          isTranslated: reprocessedMessage.isTranslated,
          translationsCount: mergedTranslations.length,
          newTranslationsAdded: translations.length
        });
        
        return reprocessedMessage;
      }
      return msg;
    }));
  }, [processMessageWithTranslations]);

  return {
    messages,
    translatedMessages,
    isLoadingMessages,
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations
  };
}
