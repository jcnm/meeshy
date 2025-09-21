/**
 * Hook spécialisé pour ConversationLayoutResponsive
 * - Messages récents en bas, anciens en haut
 * - Scroll vers le haut pour charger plus de messages anciens
 * - Ordre chronologique strict (anciens → récents)
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { apiService } from '@/services/api.service';
import { debounce } from '@/utils/debounce';
import type { User, Message } from '@shared/types';

export interface ConversationMessagesOptions {
  limit?: number;
  enabled?: boolean;
  threshold?: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export interface ConversationMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => boolean;
  updateMessage: (messageId: string, updates: Partial<Message> | ((prev: Message) => Message)) => void;
  removeMessage: (messageId: string) => void;
}

export function useConversationMessages(
  conversationId: string | null,
  currentUser: User | null,
  options: ConversationMessagesOptions = {}
): ConversationMessagesReturn {
  const {
    limit = 20,
    enabled = true,
    threshold = 100,
    containerRef
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const defaultContainerRef = useRef<HTMLDivElement>(null);
  const actualContainerRef = containerRef || defaultContainerRef;
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const offsetRef = useRef<number>(0); // Ref pour l'offset pour éviter les problèmes de timing

  // Fonction pour charger les messages
  const loadMessagesInternal = useCallback(async (isLoadMore = false) => {
    if (!conversationId || !currentUser || !enabled) {
      console.log('[Conversation] loadMessages annulé - conditions non remplies:', {
        conversationId: !!conversationId,
        currentUser: !!currentUser,
        enabled
      });
      return;
    }

    console.log(`[Conversation] 🚀 DÉBUT loadMessages - isLoadMore: ${isLoadMore}, offset: ${offsetRef.current}`);

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setOffset(0);
      }

      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Calculer l'offset AVANT de faire l'appel API
      const currentOffset = isLoadMore ? offsetRef.current : 0;
      console.log(`[Conversation] 📊 OFFSET CALCULÉ - isLoadMore: ${isLoadMore}, offset actuel: ${offsetRef.current}, currentOffset: ${currentOffset}`);
      console.log(`[Conversation] 📡 APPEL API - conversationId: ${conversationId}`);
      console.log(`[Conversation] 📡 PARAMÈTRES - limit: ${limit}, offset: ${currentOffset}, isLoadMore: ${isLoadMore}`);

      const response = await apiService.get<{ success: boolean; data: { messages: Message[] } }>(
        `/conversations/${conversationId}/messages`,
        {
          limit: limit.toString(),
          offset: currentOffset.toString()
        }
      );

      const data = response.data;
      
      // Log uniquement en cas d'erreur ou en mode développement
      if (process.env.NODE_ENV === 'development' && (!data.success || response.status !== 200)) {
        console.log(`[Conversation] 📡 RÉPONSE API - status: ${response.status}`);
        console.log(`[Conversation] 📡 RÉPONSE DATA - success: ${data.success}, data structure:`, data);
      }
      
      if (!data.success) {
        throw new Error('Erreur lors du chargement des messages');
      }

      const newMessages = data.data.messages || [];
      const hasMoreMessages = (data.data as any).hasMore || false;
      
      // Log seulement les informations importantes
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Conversation] Messages loaded: ${newMessages.length}, hasMore: ${hasMoreMessages}`);
      }

      if (isLoadMore) {
        // Pour ConversationLayoutResponsive : ajouter les messages plus anciens au début
        setMessages(prev => {
          // Éviter les doublons
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter((m: Message) => !existingIds.has(m.id));
          
          if (uniqueNewMessages.length === 0) {
            return prev;
          }
          
          // Ajouter les nouveaux messages au début (les plus anciens)
          return [...uniqueNewMessages, ...prev];
        });
        setOffset(prev => prev + limit);
        offsetRef.current += limit; // Mettre à jour la ref immédiatement
      } else {
        // Premier chargement : garder l'ordre du backend (récents en premier)
        // MessagesDisplay avec reverseOrder=true va inverser pour afficher anciens en haut, récents en bas
        setMessages(newMessages);
        setOffset(limit);
        offsetRef.current = limit; // Mettre à jour la ref immédiatement
        setIsInitialized(true);
      }

      setHasMore(hasMoreMessages);
      // Log final seulement en mode développement
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Conversation] Load complete - hasMore: ${hasMoreMessages}, total: ${messages.length + newMessages.length}`);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Requête annulée, ne pas afficher d'erreur
      }
      
      console.error('Erreur lors du chargement des messages:', error);
      setError(error.message || 'Erreur lors du chargement des messages');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [conversationId, currentUser, enabled, limit]); // Retirer offset puisqu'on utilise offsetRef

  // Version debounced de loadMessages pour éviter les appels multiples
  const loadMessages = useMemo(
    () => debounce(loadMessagesInternal, 300),
    [loadMessagesInternal]
  );

  // Fonction pour charger plus de messages
  const loadMore = useCallback(async () => {
    console.log(`[Conversation] 🔄 loadMore appelé - isLoadingMore: ${isLoadingMore}, hasMore: ${hasMore}, enabled: ${enabled}`);
    
    if (isLoadingMore || !hasMore || !enabled) {
      console.log('[Conversation] 🔄 loadMore annulé - conditions non remplies');
        return;
      }

    // Protection contre les appels trop fréquents
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      console.log('[Conversation] 🔄 Appel trop fréquent, ignoré');
      return;
    }
    
    lastLoadTimeRef.current = now;
    console.log('[Conversation] 🔄 Chargement de plus de messages anciens...');
    await loadMessages(true);
  }, [loadMessages, isLoadingMore, hasMore, enabled]); // Retirer messages.length

  // Fonction pour rafraîchir les messages
  const refresh = useCallback(async () => {
    await loadMessages(false);
  }, [loadMessages]);

  // Fonction pour vider les messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setOffset(0);
    offsetRef.current = 0; // Reset ref
    setHasMore(true);
    setIsInitialized(false);
    setError(null);
  }, []);

  // Fonction pour ajouter un message (nouveaux messages en temps réel)
  const addMessage = useCallback((message: Message): boolean => {
    console.group('🆕 [USE-CONVERSATION-MESSAGES] AJOUT NOUVEAU MESSAGE');
    console.log('📬 [USE-CONVERSATION-MESSAGES] addMessage appelé', {
      messageId: message.id,
      conversationId: message.conversationId,
      content: message.content?.substring(0, 50) + '...',
      senderId: message.senderId,
      hasId: !!message.id,
      messageObject: message
    });
    
    let wasAdded = false;
    setMessages(prev => {
      console.log('📊 [USE-CONVERSATION-MESSAGES] Messages actuels:', prev.length);
      
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        console.log('🔄 [USE-CONVERSATION-MESSAGES] Message déjà présent, ignore');
        console.groupEnd();
        return prev;
      }

      wasAdded = true;
      const newMessages = [...prev, message];
      console.log('✅ [USE-CONVERSATION-MESSAGES] Message ajouté avec succès', {
        previousCount: prev.length,
        newCount: newMessages.length,
        addedMessageId: message.id
      });
      
      console.groupEnd();
      return newMessages;
    });
    
    if (!wasAdded) {
      console.groupEnd();
    }
    
    return wasAdded;
  }, []);

  // Fonction pour mettre à jour un message (support des callbacks)
  const updateMessage = useCallback((messageId: string, updates: Partial<Message> | ((prev: Message) => Message)) => {
    console.group(`📝 [USE-CONVERSATION-MESSAGES] MISE À JOUR MESSAGE ${messageId}`);
    console.log('🔄 [USE-CONVERSATION-MESSAGES] updateMessage appelé', {
      messageId,
      updatesType: typeof updates,
      isFunction: typeof updates === 'function'
    });
    
    let messageFound = false;
    let oldTranslationCount = 0;
    let newTranslationCount = 0;
    
    setMessages(prev => {
      console.log(`📊 [USE-CONVERSATION-MESSAGES] Messages en cours: ${prev.length}`);
      
      const result = prev.map(msg => {
        if (msg.id === messageId) {
          messageFound = true;
          oldTranslationCount = msg.translations?.length || 0;
          console.log(`✅ [USE-CONVERSATION-MESSAGES] Message trouvé: ${msg.content.substring(0, 50)}...`);
          console.log(`📊 [USE-CONVERSATION-MESSAGES] Traductions actuelles: ${oldTranslationCount}`);
          
          let updatedMessage;
          if (typeof updates === 'function') {
            console.log('🔧 [USE-CONVERSATION-MESSAGES] Application fonction de mise à jour...');
            updatedMessage = updates(msg);
          } else {
            console.log('🔧 [USE-CONVERSATION-MESSAGES] Application mise à jour directe...');
            updatedMessage = { ...msg, ...updates };
          }
          
          newTranslationCount = updatedMessage.translations?.length || 0;
          console.log(`📊 [USE-CONVERSATION-MESSAGES] Nouvelles traductions: ${newTranslationCount}`);
          console.log(`📈 [USE-CONVERSATION-MESSAGES] Évolution: ${oldTranslationCount} → ${newTranslationCount} (${newTranslationCount > oldTranslationCount ? '+' : ''}${newTranslationCount - oldTranslationCount})`);
          
          if (updatedMessage.translations && updatedMessage.translations.length > 0) {
            console.log('🌐 [USE-CONVERSATION-MESSAGES] Détail des traductions mises à jour:');
            updatedMessage.translations.forEach((t, idx) => {
              console.log(`  ${idx + 1}. ${t.targetLanguage}: "${t.translatedContent?.substring(0, 30)}..." (${t.translationModel})`);
            });
          }
          
          return updatedMessage;
        }
        return msg;
      });
      
      if (!messageFound) {
        console.warn(`⚠️ [USE-CONVERSATION-MESSAGES] Message ${messageId} non trouvé dans la liste`);
      } else {
        console.log(`✅ [USE-CONVERSATION-MESSAGES] Message ${messageId} mis à jour avec succès`);
      }
      
      console.groupEnd();
      return result;
    });
  }, []);

  // Fonction pour supprimer un message
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Gestion du scroll infini (scroll vers le haut pour charger plus anciens)
  useEffect(() => {
    if (!enabled || !actualContainerRef.current) {
      console.log(`[Conversation] 📜 Scroll listener non attaché - enabled: ${enabled}, container: ${!!actualContainerRef.current}`);
      return;
    }

    // Attendre que le DOM soit prêt avec un délai
    const timer = setTimeout(() => {
      if (!actualContainerRef.current) {
        console.log(`[Conversation] 📜 Scroll listener non attaché - container toujours null après délai`);
        return;
      }

    const container = actualContainerRef.current;
    console.log(`[Conversation] 📜 Attachement du listener de scroll sur le conteneur:`, {
      container: container,
      className: container.className,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      isMobile: window.innerWidth < 768,
      userAgent: navigator.userAgent,
      offsetHeight: container.offsetHeight
    });
    
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) {
        console.log(`[Conversation] 📜 Scroll ignoré - isLoadingMore: ${isLoadingMore}, hasMore: ${hasMore}`);
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // Vérifier qu'il y a vraiment eu un mouvement de scroll
      const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current);
      if (scrollDelta < 10) {
        console.log(`[Conversation] 📜 Scroll ignoré - mouvement trop petit: ${scrollDelta}px`);
        return; // Mouvement de scroll trop petit, ignorer
      }
      
      console.log(`[Conversation] 📜 Scroll détecté - scrollTop: ${scrollTop}, delta: ${scrollDelta}, lastScrollTop: ${lastScrollTopRef.current}`);
      lastScrollTopRef.current = scrollTop;

      // Annuler le timeout précédent
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce le scroll
      scrollTimeoutRef.current = setTimeout(() => {
        // Protection contre les conteneurs trop petits
        if (clientHeight >= scrollHeight) {
          console.log('[Conversation] 📜 Scroll ignoré - conteneur trop petit');
          return;
        }
        
        if (scrollHeight <= clientHeight + threshold) {
          console.log('[Conversation] 📜 Scroll ignoré - pas assez de contenu');
          return;
        }
        
        // Pour ConversationLayoutResponsive : scroll vers le haut pour charger plus anciens
        const isNearTop = scrollTop <= threshold;
        
        const shouldLoadMore = isNearTop;

        console.log(`[Conversation] 📜 ÉVALUATION SCROLL - scrollTop: ${scrollTop}, threshold: ${threshold}, isNearTop: ${isNearTop}, shouldLoadMore: ${shouldLoadMore}`);
        console.log(`[Conversation] 📜 POSITION SCROLL - scrollTop: ${scrollTop}, clientHeight: ${clientHeight}, scrollHeight: ${scrollHeight}, distanceFromTop: ${scrollTop}`);

        if (shouldLoadMore) {
          console.log(`[Conversation] 📜 ✅ DÉCLENCHEMENT CHARGEMENT - scrollTop: ${scrollTop}, threshold: ${threshold}, isNearTop: ${isNearTop}`);
          loadMore();
        }
      }, 100);
    };

      container.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, 100); // Délai de 100ms pour s'assurer que le DOM est prêt

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, actualContainerRef, isLoadingMore, hasMore, threshold, loadMore]);

  // Chargement initial
  useEffect(() => {
    if (conversationId && currentUser && enabled && !isInitialized) {
      console.log('[Conversation] 🔄 Initialisation du chargement des messages');
      loadMessages(false);
    }
  }, [conversationId, currentUser, enabled, isInitialized]); // Retirer les callbacks des dépendances

  // Vérification du contenu après initialisation
  useEffect(() => {
    if (!isInitialized || !actualContainerRef.current || isLoadingMore) return;

    const checkContentHeight = () => {
      if (!actualContainerRef.current || isLoadingMore || !hasMore) return;
      
      const container = actualContainerRef.current;
      const { scrollHeight, clientHeight } = container;
      
      if (scrollHeight <= clientHeight + 100) {
        console.log('[Conversation] 📏 Conteneur pas assez rempli, chargement de plus de messages');
        loadMore();
      }
    };

    const timeoutId = setTimeout(checkContentHeight, 300);
    return () => clearTimeout(timeoutId);
  }, [isInitialized, hasMore]); // Retirer loadMore des dépendances

  // Chargement automatique si le conteneur n'est pas assez rempli
  useEffect(() => {
    if (!isInitialized || isLoadingMore || !hasMore || !actualContainerRef.current) return;

    // Utiliser un timeout pour éviter les appels en boucle
    const checkAndLoadMore = () => {
      if (!actualContainerRef.current || isLoadingMore || !hasMore) return;
      
      const container = actualContainerRef.current;
      const { scrollHeight, clientHeight } = container;
      
      if (scrollHeight <= clientHeight + 50 && hasMore) {
        loadMore();
      }
    };

    const timeoutId = setTimeout(checkAndLoadMore, 500);
    return () => clearTimeout(timeoutId);
  }, [isInitialized, messages.length]); // Retirer loadMore et hasMore des dépendances

  // Nettoyage à la destruction
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    clearMessages,
    addMessage,
    updateMessage,
    removeMessage
  };
}