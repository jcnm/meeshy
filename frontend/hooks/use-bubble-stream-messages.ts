/**
 * Hook spécialisé pour BubbleStreamPage
 * - Messages anciens en haut, récents en bas
 * - Scroll vers le haut pour charger plus de messages anciens
 * - Ordre chronologique strict (anciens → récents)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { buildApiUrl } from '@/lib/config';
import type { User, Message } from '@shared/types';

export interface BubbleStreamMessagesOptions {
  limit?: number;
  enabled?: boolean;
  threshold?: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export interface BubbleStreamMessagesReturn {
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

export function useBubbleStreamMessages(
  conversationId: string | null,
  currentUser: User | null,
  options: BubbleStreamMessagesOptions = {}
): BubbleStreamMessagesReturn {
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
      return;
    }

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
      const url = new URL(buildApiUrl(`/conversations/${conversationId}/messages`));
      url.searchParams.append('limit', limit.toString());
      url.searchParams.append('offset', currentOffset.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du chargement des messages');
      }

      const newMessages = data.data.messages || [];
      const hasMoreMessages = data.data.hasMore || false;

      if (isLoadMore) {
        // Pour BubbleStreamPage : ajouter les messages plus anciens au début
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
        // Premier chargement : garder l'ordre du backend
        setMessages(newMessages);
        setOffset(limit);
        offsetRef.current = limit; // Mettre à jour la ref immédiatement
        setIsInitialized(true);
      }

      setHasMore(hasMoreMessages);

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
    if (isLoadingMore || !hasMore || !enabled) {
      return;
    }
    
    // Protection contre les appels trop fréquents
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      return;
    }
    
    lastLoadTimeRef.current = now;
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
    offsetRef.current = 0; // Réinitialiser la ref
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

  // Gestion du scroll infini (scroll vers le bas pour charger plus anciens)
  useEffect(() => {
    if (!enabled || !actualContainerRef.current || !isInitialized) {
      return;
    }

    const container = actualContainerRef.current;
    
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // Vérifier qu'il y a vraiment eu un mouvement de scroll
      const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current);
      if (scrollDelta < 10) {
        return; // Mouvement de scroll trop petit, ignorer
      }
      
      lastScrollTopRef.current = scrollTop;

      // Annuler le timeout précédent
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce le scroll
      scrollTimeoutRef.current = setTimeout(() => {
        // Protection contre les conteneurs trop petits
        if (clientHeight >= scrollHeight) {
          return;
        }
        
        if (scrollHeight <= clientHeight + threshold) {
          return;
        }
        
        // Pour BubbleStreamPage : scroll vers le bas pour charger plus anciens
        // Les messages anciens sont en bas, donc on charge quand on est près du bas
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;
        
        // Charger plus de messages si on est près du bas (même si on ne scrolle plus activement)
        const shouldLoadMore = isNearBottom;

        if (shouldLoadMore) {
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
