import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import type { User, Message, TranslatedMessage, MessageWithTranslations, MessageTranslation, TranslationData, MessageTranslationCache } from '@shared/types';
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

  // Cache des messages pour éviter les rechargements inutiles
  const [messageCache, setMessageCache] = useState<Map<string, Message[]>>(new Map());
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

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
        
        console.log(`📥 [FRONTEND] Messages existants chargés: ${existingMessages.length}`);
        
        // Debug: Analyser TOUS les messages reçus avec leurs traductions
        console.log('🔍 [FRONTEND] Analyse complète des messages reçus:');
        existingMessages.slice(0, 5).forEach((msg: any, index: number) => {
          console.log(`  [${index}] Message ${msg.id}:`);
          console.log(`    - Content: ${msg.content?.substring(0, 50)}...`);
          console.log(`    - Original Language: ${msg.originalLanguage}`);
          console.log(`    - Translations: ${msg.translations?.length || 0} trouvées`);
          console.log(`    - Raw translations data:`, msg.translations);
          
          if (msg.translations && msg.translations.length > 0) {
            msg.translations.forEach((t: any, tIndex: number) => {
              console.log(`      [${tIndex}] ${t.targetLanguage || 'NO_LANG'}: ${t.translatedContent?.substring(0, 40) || 'NO_CONTENT'}...`);
              console.log(`          Model: ${t.translationModel || 'NO_MODEL'}, Cache: ${t.cacheKey || 'NO_CACHE'}`);
            });
          } else {
            console.log(`      ❌ Aucune traduction dans les données brutes`);
          }
          console.log('');
        });

        // Vérifier le format global de la réponse
        console.log('🔍 [FRONTEND] Format de réponse détaillé:', {
          responseDataKeys: Object.keys(responseData),
          dataKeys: responseData.data ? Object.keys(responseData.data) : 'NO_DATA',
          messagesType: Array.isArray(existingMessages) ? 'ARRAY' : typeof existingMessages,
          firstMessageKeys: existingMessages[0] ? Object.keys(existingMessages[0]) : 'NO_FIRST_MESSAGE'
        });
        
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
        console.log(`🔄 [MESSAGE_LOADER] Traitement de ${sortedMessages.length} messages...`);
        
        const bubbleMessages: BubbleStreamMessage[] = sortedMessages
          .map((msg: any, index: number) => {
            console.log(`📬 [MESSAGE_LOADER] Traitement message ${index + 1}/${sortedMessages.length}:`);
            const processed = processMessageWithTranslations(msg);
            
            console.log(`📬 [MESSAGE_LOADER] Message ${index + 1} traité:`, {
              id: processed.id,
              translationsCount: processed.translations.length,
              isTranslated: processed.isTranslated,
              originalLanguage: processed.originalLanguage,
              availableLanguages: processed.translations.map(t => t.language)
            });
            
            return processed;
          });

        // Mettre à jour les messages traduits
        setTranslatedMessages(bubbleMessages as unknown as TranslatedMessage[]);
        
        // Debug: Vérifier les messages stockés dans l'état
        console.log(`💾 [MESSAGE_LOADER] Messages stockés dans l'état:`, {
          totalBubbleMessages: bubbleMessages.length,
          translationsPerMessage: bubbleMessages.map(msg => ({
            id: msg.id,
            translationsCount: msg.translations.length,
            hasTranslations: msg.translations.length > 0
          }))
        });
        
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
        
        console.log(`Statistiques traductions détaillées:`, {
          totalMessages: bubbleMessages.length,
          totalTranslations,
          translatedMessages,
          messagesNeedingTranslation: messagesNeedingTranslation.length,
          userPreferredLanguage: resolveUserPreferredLanguage(),
          userLanguagePreferences: getUserLanguagePreferences()
        });
        
        console.log(`Messages chargés: ${existingMessages.length} (${totalTranslations} traductions, ${messagesNeedingTranslation.length} nécessitent traduction)`);
        
        // TODO: Déclencher la traduction automatique des messages manquants si activée
        if (currentUser.autoTranslateEnabled && messagesNeedingTranslation.length > 0) {
          console.log(`${messagesNeedingTranslation.length} messages à traduire automatiquement`);
          // Ici on pourrait déclencher les traductions en arrière-plan
        }
        
      } else {
        console.log('Impossible de charger les messages existants. Status:', response.status);
        try {
          const errorData = await response.text();
          console.log('Debug: Réponse d\'erreur:', errorData);
        } catch (e) {
          console.log('Debug: Impossible de lire la réponse d\'erreur');
        }
        console.error('Erreur lors du chargement des messages');
        
        // Vérifier si cette conversation est toujours celle demandée
        if (conversationId !== targetConversationId) {
          console.log('Conversation changée pendant l\'erreur, abandon');
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
        console.log('Conversation changée pendant l\'erreur, abandon');
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

  // Fonction utilitaire pour convertir TranslationData vers MessageTranslation
  const createMessageTranslation = useCallback((translation: TranslationData, messageId: string): MessageTranslation => ({
    id: `${messageId}_${translation.targetLanguage}`,
    messageId,
    sourceLanguage: translation.sourceLanguage,
    targetLanguage: translation.targetLanguage,
    translatedContent: translation.translatedContent,
    translationModel: (translation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
    cacheKey: translation.cacheKey || `${messageId}_${translation.targetLanguage}`,
    cached: Boolean(translation.cached),
    confidenceScore: translation.confidenceScore,
    createdAt: translation.createdAt ? new Date(translation.createdAt) : new Date(),
  }), []);

  // Fonction pour mettre à jour les traductions d'un message existant
  const updateMessageTranslations = useCallback((messageId: string, updaterOrTranslations: TranslationData[] | ((message: Message | null) => Message | null)) => {
    console.log('🌐 Mise à jour traductions pour message:', messageId);
    
    // Gérer les deux signatures: callback pattern ou array directe
    if (typeof updaterOrTranslations === 'function') {
      // Callback pattern utilisé dans ConversationLayoutResponsive
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const updatedMessage = updaterOrTranslations(msg);
          return updatedMessage || msg;
        }
        return msg;
      }));
      return;
    }
    
    // Array pattern (mode direct)
    const translations = updaterOrTranslations;
    console.log('🌐 Traductions à appliquer:', translations);
    
    // Mettre à jour les messages bruts - FUSION des traductions existantes avec les nouvelles
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Obtenir les traductions existantes (s'il y en a)
        const existingTranslations = (msg as any).translations || [];
        
        // Convertir les traductions existantes au bon format si nécessaire
        const validExistingTranslations: MessageTranslation[] = existingTranslations
          .filter((t: any) => t && typeof t === 'object')
          .map((t: any): MessageTranslation => ({
            id: t.id || `${messageId}_${t.targetLanguage}`,
            messageId: t.messageId || messageId,
            sourceLanguage: t.sourceLanguage,
            targetLanguage: t.targetLanguage,
            translatedContent: t.translatedContent,
            translationModel: (t.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
            cacheKey: t.cacheKey || `${messageId}_${t.targetLanguage}`,
            cached: Boolean(t.cached),
            confidenceScore: t.confidenceScore,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          }));
        
        // Fusionner avec les nouvelles traductions
        const mergedTranslations = [...validExistingTranslations];
        
        translations.forEach(newTranslation => {
          const existingIndex = mergedTranslations.findIndex(
            existing => existing.targetLanguage === newTranslation.targetLanguage
          );
          
          const messageTranslation = createMessageTranslation(newTranslation, messageId);
          
          if (existingIndex >= 0) {
            mergedTranslations[existingIndex] = messageTranslation;
          } else {
            mergedTranslations.push(messageTranslation);
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
