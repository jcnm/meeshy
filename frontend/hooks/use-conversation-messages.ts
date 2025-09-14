/**
 * Hook spécialisé pour ConversationLayoutResponsive
 * - Messages récents en bas, anciens en haut
 * - Scroll vers le haut pour charger plus de messages anciens
 * - Ordre chronologique strict (anciens → récents)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiService } from '@/services/api.service';
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
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
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
  const loadMessages = useCallback(async (isLoadMore = false) => {
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

      const response = await apiService.get<{ success: boolean; data: Message[] }>(
        `/api/conversations/${conversationId}/messages`,
        {
          limit: limit.toString(),
          offset: currentOffset.toString()
        }
      );

      const data = response.data;
      
      console.log(`[Conversation] 📡 RÉPONSE API - status: ${response.status}, ok: ${response.ok}`);
      
      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du chargement des messages');
      }

      const newMessages = data.data.messages || [];
      const hasMoreMessages = data.data.hasMore || false;
      
      console.log(`[Conversation] 📡 DONNÉES REÇUES - success: ${data.success}, messages count: ${newMessages.length}, hasMore: ${hasMoreMessages}`);

      if (isLoadMore) {
        // Pour ConversationLayoutResponsive : ajouter les messages plus anciens au début
        console.log(`[Conversation] 📝 TRAITEMENT loadMore - nouveaux messages: ${newMessages.length}`);
        setMessages(prev => {
          // Éviter les doublons
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter((m: Message) => !existingIds.has(m.id));
          
          console.log(`[Conversation] 📝 FILTRAGE DOUBLONS - existants: ${prev.length}, nouveaux: ${newMessages.length}, uniques: ${uniqueNewMessages.length}`);
          
          if (uniqueNewMessages.length === 0) {
            console.log('[Conversation] 📝 Aucun nouveau message unique, pas de mise à jour');
            return prev;
          }
          
          // Ajouter les nouveaux messages au début (les plus anciens)
          const result = [...uniqueNewMessages, ...prev];
          console.log(`[Conversation] 📝 MISE À JOUR MESSAGES - total: ${result.length}`);
          return result;
        });
        setOffset(prev => prev + limit);
        offsetRef.current += limit; // Mettre à jour la ref immédiatement
      } else {
        // Premier chargement : garder l'ordre du backend (récents en premier)
        // MessagesDisplay avec reverseOrder=true va inverser pour afficher anciens en haut, récents en bas
        console.log(`[Conversation] 📝 PREMIER CHARGEMENT - messages: ${newMessages.length}`);
        setMessages(newMessages);
        setOffset(limit);
        offsetRef.current = limit; // Mettre à jour la ref immédiatement
        setIsInitialized(true);
      }

      setHasMore(hasMoreMessages);
      console.log(`[Conversation] ✅ FIN loadMessages - hasMore: ${hasMoreMessages}, total messages: ${messages.length + newMessages.length}`);

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
  }, [conversationId, currentUser, enabled, limit, offset]);

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
  }, [loadMessages, isLoadingMore, hasMore, enabled, messages.length]);

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
    let wasAdded = false;
    setMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }

      wasAdded = true;
      // Ajouter le nouveau message à la fin (en bas)
      return [...prev, message];
    });
    return wasAdded;
  }, []);

  // Fonction pour mettre à jour un message
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  // Fonction pour supprimer un message
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Gestion du scroll infini (scroll vers le haut pour charger plus anciens)
  useEffect(() => {
    if (!enabled || !actualContainerRef.current || !isInitialized) {
      console.log(`[Conversation] 📜 Scroll listener non attaché - enabled: ${enabled}, container: ${!!actualContainerRef.current}, initialized: ${isInitialized}`);
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
  }, [enabled, isInitialized, isLoadingMore, hasMore, threshold, loadMore]);

  // Chargement initial
  useEffect(() => {
    if (conversationId && currentUser && enabled && !isInitialized) {
      loadMessages(false);
      
      // Attendre que les messages soient chargés puis vérifier si on a besoin de plus
      setTimeout(() => {
        if (actualContainerRef.current) {
          lastScrollTopRef.current = actualContainerRef.current.scrollTop;
          
          // Vérifier si on a besoin de charger plus de messages pour remplir le conteneur
          const container = actualContainerRef.current;
          const { scrollHeight, clientHeight } = container;
          
          if (scrollHeight <= clientHeight + 100 && hasMore) {
            loadMore();
          }
        }
      }, 200);
    }
  }, [conversationId, currentUser, enabled, isInitialized, loadMessages, actualContainerRef, hasMore, loadMore]);

  // Chargement automatique si le conteneur n'est pas assez rempli
  useEffect(() => {
    if (!isInitialized || isLoadingMore || !hasMore || !actualContainerRef.current) return;

    const container = actualContainerRef.current;
    const { scrollHeight, clientHeight } = container;
    
    if (scrollHeight <= clientHeight + 50 && hasMore) {
      loadMore();
    }
  }, [isInitialized, isLoadingMore, hasMore, loadMore, messages.length]);

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