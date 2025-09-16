/**
 * Hook avancé pour la gestion optimisée des messages avec traductions
 * Améliore les performances et la gestion des erreurs
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import type { User, Message, TranslatedMessage, MessageWithTranslations, MessageTranslation, TranslationData } from '@shared/types';

interface UseAdvancedMessageLoaderOptions {
  // Options de base
  conversationId?: string;
  currentUser: User;
  
  // Options avancées
  enableCache?: boolean; // Cache des messages par conversation
  maxCacheSize?: number; // Taille max du cache (nombre de conversations)
  retryAttempts?: number; // Nombre de tentatives en cas d'erreur
  debounceMs?: number; // Délai de debounce pour les rechargements
  
  // Options de pagination
  pageSize?: number; // Nombre de messages par page
  enableInfiniteScroll?: boolean; // Pagination infinie
  
  // Callbacks
  onError?: (error: Error) => void;
  onLoadComplete?: (messageCount: number) => void;
  onTranslationUpdate?: (messageId: string, translationCount: number) => void;
}

interface UseAdvancedMessageLoaderReturn {
  // États de base
  messages: Message[];
  translatedMessages: TranslatedMessage[];
  isLoading: boolean;
  error: string | null;
  
  // États avancés
  hasNextPage: boolean;
  isLoadingMore: boolean;
  totalMessages: number;
  cacheHitRate: number;
  
  // Actions de base
  loadMessages: (conversationId: string, options?: { refresh?: boolean }) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
  updateMessageTranslations: (messageId: string, translations: TranslationData[]) => void;
  
  // Actions avancées
  loadMoreMessages: () => Promise<void>;
  retryLastOperation: () => Promise<void>;
  clearCache: () => void;
  preloadConversation: (conversationId: string) => Promise<void>;
  
  // Utilitaires
  getMessageById: (messageId: string) => Message | undefined;
  getTranslationProgress: (messageId: string) => { completed: number; total: number };
}

// Cache global partagé entre toutes les instances
const messageCache = new Map<string, {
  messages: Message[];
  timestamp: number;
  translatedMessages: TranslatedMessage[];
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PAGE_SIZE = 50;
const MAX_CACHE_SIZE = 10;

export function useAdvancedMessageLoader(
  options: UseAdvancedMessageLoaderOptions
): UseAdvancedMessageLoaderReturn {
  const {
    conversationId,
    currentUser,
    enableCache = true,
    maxCacheSize = MAX_CACHE_SIZE,
    retryAttempts = 3,
    debounceMs = 300,
    pageSize = DEFAULT_PAGE_SIZE,
    enableInfiniteScroll = true,
    onError,
    onLoadComplete,
    onTranslationUpdate
  } = options;

  // États de base
  const [messages, setMessages] = useState<Message[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<TranslatedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États avancés
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalMessages, setTotalMessages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [cacheHitCount, setCacheHitCount] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);

  // Refs pour éviter les appels multiples
  const loadingRef = useRef(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastOperationRef = useRef<(() => Promise<void>) | null>(null);

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getRequiredTranslations,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage
  } = useMessageTranslations({ currentUser });

  // Nettoyage du cache si trop grand
  const cleanupCache = useCallback(() => {
    if (messageCache.size > maxCacheSize) {
      const entries = Array.from(messageCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toDelete = entries.slice(0, entries.length - maxCacheSize);
      toDelete.forEach(([key]) => messageCache.delete(key));
    }
  }, [maxCacheSize]);

  // Calcul du taux de hit du cache
  const cacheHitRate = totalRequests > 0 ? (cacheHitCount / totalRequests) * 100 : 0;

  // Fonction pour obtenir depuis le cache
  const getFromCache = useCallback((convId: string) => {
    if (!enableCache) return null;
    
    const cached = messageCache.get(convId);
    if (!cached) return null;
    
    // Vérifier si le cache n'est pas expiré
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      messageCache.delete(convId);
      return null;
    }
    
    return cached;
  }, [enableCache]);

  // Fonction pour sauvegarder dans le cache
  const saveToCache = useCallback((convId: string, msgs: Message[], translated: TranslatedMessage[]) => {
    if (!enableCache) return;
    
    messageCache.set(convId, {
      messages: msgs,
      translatedMessages: translated,
      timestamp: Date.now()
    });
    
    cleanupCache();
  }, [enableCache, cleanupCache]);

  // Fonction de chargement des messages avec retry et cache
  const loadMessages = useCallback(async (
    targetConversationId: string, 
    loadOptions: { refresh?: boolean } = {}
  ) => {
    const { refresh = false } = loadOptions;
    
    if (loadingRef.current && !refresh) {
      console.log('🔄 Chargement déjà en cours, ignoré');
      return;
    }

    // Débounce pour éviter les appels multiples
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    return new Promise<void>((resolve, reject) => {
      debounceRef.current = setTimeout(async () => {
        try {
          loadingRef.current = true;
          setIsLoading(true);
          setError(null);
          setTotalRequests(prev => prev + 1);

          // Vérifier le cache d'abord (sauf si refresh)
          if (!refresh) {
            const cached = getFromCache(targetConversationId);
            if (cached) {
              console.log('📦 Messages récupérés depuis le cache');
              setMessages(cached.messages);
              setTranslatedMessages(cached.translatedMessages);
              setCacheHitCount(prev => prev + 1);
              onLoadComplete?.(cached.messages.length);
              resolve();
              return;
            }
          }

          // Sauvegarde de l'opération pour retry
          const operation = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
              throw new Error('Token d\'authentification manquant');
            }

            const response = await fetch(
              buildApiUrl(`/conversations/${targetConversationId}/messages?limit=${pageSize}&page=${currentPage}`),
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!response.ok) {
              throw new Error(`Erreur HTTP: ${response.status}`);
            }

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

            return existingMessages;
          };

          lastOperationRef.current = operation;

          // Exécuter avec retry
          let lastError: Error | null = null;
          let messages: any[] = [];
          
          for (let attempt = 0; attempt < retryAttempts; attempt++) {
            try {
              messages = await operation();
              break;
            } catch (err) {
              lastError = err as Error;
              if (attempt < retryAttempts - 1) {
                console.log(`🔄 Tentative ${attempt + 1}/${retryAttempts} échouée, retry...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              }
            }
          }

          if (lastError && messages.length === 0) {
            throw lastError;
          }

          // Traiter les messages
          const sortedMessages = messages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          const processedMessages = sortedMessages.map(msg => 
            processMessageWithTranslations(msg)
          );

          // Mettre à jour les états
          setMessages(sortedMessages);
          setTranslatedMessages(processedMessages as TranslatedMessage[]);
          setTotalMessages(messages.length);
          setHasNextPage(messages.length >= pageSize);

          // Sauvegarder dans le cache
          saveToCache(targetConversationId, sortedMessages, processedMessages as TranslatedMessage[]);

          console.log(`✅ Messages chargés: ${messages.length} (cache hit rate: ${cacheHitRate.toFixed(1)}%)`);
          onLoadComplete?.(messages.length);
          resolve();

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur de chargement';
          setError(errorMessage);
          onError?.(error as Error);
          console.error('❌ Erreur chargement messages:', error);
          reject(error);
        } finally {
          setIsLoading(false);
          loadingRef.current = false;
        }
      }, debounceMs);
    });
  }, [
    currentPage, 
    pageSize, 
    retryAttempts, 
    debounceMs, 
    getFromCache, 
    saveToCache, 
    processMessageWithTranslations,
    cacheHitRate,
    onLoadComplete,
    onError
  ]);

  // Chargement de pages supplémentaires
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasNextPage) return;

    setIsLoadingMore(true);
    try {
      setCurrentPage(prev => prev + 1);
      await loadMessages(conversationId);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, isLoadingMore, hasNextPage, loadMessages]);

  // Retry de la dernière opération
  const retryLastOperation = useCallback(async () => {
    if (lastOperationRef.current && conversationId) {
      await loadMessages(conversationId, { refresh: true });
    }
  }, [conversationId, loadMessages]);

  // Préchargement d'une conversation
  const preloadConversation = useCallback(async (convId: string) => {
    if (getFromCache(convId)) return; // Déjà en cache
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(
        buildApiUrl(`/conversations/${convId}/messages?limit=${Math.min(pageSize, 20)}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        let messages = data.messages || data.data?.messages || data.data || data;
        if (Array.isArray(messages)) {
          const processed = messages.map(msg => processMessageWithTranslations(msg));
          saveToCache(convId, messages, processed as TranslatedMessage[]);
          console.log(`📦 Conversation ${convId} préchargée en cache`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erreur préchargement:', error);
    }
  }, [pageSize, getFromCache, saveToCache, processMessageWithTranslations]);

  // Autres fonctions utilitaires
  const clearMessages = useCallback(() => {
    setMessages([]);
    setTranslatedMessages([]);
    setCurrentPage(0);
    setHasNextPage(true);
    setTotalMessages(0);
    setError(null);
  }, []);

  const addMessage = useCallback((message: Message) => {
    console.log('📬 Ajout nouveau message:', message.id);
    
    if (conversationId && message.conversationId !== conversationId) {
      return;
    }
    
    const processedMessage = processMessageWithTranslations(message);
    
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
    
    setTranslatedMessages(prev => {
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, processedMessage as TranslatedMessage];
    });

    // Invalider le cache pour cette conversation
    if (conversationId) {
      messageCache.delete(conversationId);
    }
  }, [conversationId, processMessageWithTranslations]);

  const updateMessageTranslations = useCallback((messageId: string, translations: TranslationData[]) => {
    console.log('🌐 Mise à jour traductions:', messageId, translations.length);
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const existingTranslations = (msg as any).translations || [];
        const mergedTranslations = [...existingTranslations];
        
        translations.forEach(newTranslation => {
          const existingIndex = mergedTranslations.findIndex(
            existing => existing.targetLanguage === newTranslation.targetLanguage
          );
          
          const messageTranslation = {
            id: `${messageId}_${newTranslation.targetLanguage}`,
            messageId,
            sourceLanguage: newTranslation.sourceLanguage,
            targetLanguage: newTranslation.targetLanguage,
            translatedContent: newTranslation.translatedContent,
            translationModel: (newTranslation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
            cacheKey: newTranslation.cacheKey || `${messageId}_${newTranslation.targetLanguage}`,
            cached: Boolean(newTranslation.cached),
            confidenceScore: newTranslation.confidenceScore,
            createdAt: newTranslation.createdAt ? new Date(newTranslation.createdAt) : new Date(),
          };
          
          if (existingIndex >= 0) {
            mergedTranslations[existingIndex] = messageTranslation;
          } else {
            mergedTranslations.push(messageTranslation);
          }
        });
        
        return { ...msg, translations: mergedTranslations };
      }
      return msg;
    }));

    // Mettre à jour aussi les messages traduits
    setTranslatedMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const updatedMessage = {
          ...msg,
          translations: translations.map(t => ({
            messageId,
            sourceLanguage: t.sourceLanguage,
            targetLanguage: t.targetLanguage,
            translatedContent: t.translatedContent,
            translationModel: t.translationModel as 'basic' | 'medium' | 'premium',
            cacheKey: t.cacheKey,
            cached: Boolean(t.cached),
            confidenceScore: t.confidenceScore,
            createdAt: new Date(),
          }))
        };
        
        const reprocessed = processMessageWithTranslations(updatedMessage);
        return reprocessed as TranslatedMessage;
      }
      return msg;
    }));

    onTranslationUpdate?.(messageId, translations.length);

    // Invalider le cache
    if (conversationId) {
      messageCache.delete(conversationId);
    }
  }, [conversationId, processMessageWithTranslations, onTranslationUpdate]);

  const clearCache = useCallback(() => {
    messageCache.clear();
    setCacheHitCount(0);
    setTotalRequests(0);
    console.log('🗑️ Cache vidé');
  }, []);

  const getMessageById = useCallback((messageId: string) => {
    return messages.find(msg => msg.id === messageId);
  }, [messages]);

  const getTranslationProgress = useCallback((messageId: string) => {
    const message = getMessageById(messageId);
    if (!message) return { completed: 0, total: 0 };
    
    const requiredLanguages = getUserLanguagePreferences();
    const availableTranslations = (message as any).translations || [];
    
    return {
      completed: availableTranslations.length,
      total: requiredLanguages.length
    };
  }, [getMessageById, getUserLanguagePreferences]);

  // Nettoyage automatique du cache expiré
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of messageCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          messageCache.delete(key);
        }
      }
    }, CACHE_TTL);

    return () => clearInterval(cleanup);
  }, []);

  return {
    // États de base
    messages,
    translatedMessages,
    isLoading,
    error,
    
    // États avancés
    hasNextPage,
    isLoadingMore,
    totalMessages,
    cacheHitRate,
    
    // Actions de base
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations,
    
    // Actions avancées
    loadMoreMessages,
    retryLastOperation,
    clearCache,
    preloadConversation,
    
    // Utilitaires
    getMessageById,
    getTranslationProgress
  };
}