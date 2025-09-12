/**
 * Hook pour la pagination infinie des messages avec scroll infini
 * Supporte les deux directions : scroll vers le haut (messages plus anciens) et scroll vers le bas
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { buildApiUrl } from '@/lib/config';
import type { User, Message } from '@shared/types';

export interface InfiniteMessagesOptions {
  direction: 'up' | 'down'; // 'up' = charger plus anciens en scrollant vers le haut, 'down' = charger plus récents en scrollant vers le bas
  limit?: number;
  enabled?: boolean;
  threshold?: number; // Distance du bord pour déclencher le chargement (en pixels)
  containerRef?: React.RefObject<HTMLDivElement | null>; // Référence du conteneur de scroll
  reverseInitialOrder?: boolean; // Si true, inverse l'ordre des messages lors du premier chargement
}

export interface InfiniteMessagesReturn {
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

export function useInfiniteMessages(
  conversationId: string | null,
  currentUser: User | null,
  options: InfiniteMessagesOptions = { direction: 'up' }
): InfiniteMessagesReturn {
  const {
    direction = 'up',
    limit = 20,
    enabled = true,
    threshold = 100,
    containerRef,
    reverseInitialOrder = true
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);

  const defaultContainerRef = useRef<HTMLDivElement>(null);
  const actualContainerRef = containerRef || defaultContainerRef;
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  // Fonction pour charger les messages
  const loadMessages = useCallback(async (isLoadMore = false) => {
    if (!conversationId || !currentUser || !enabled) return;

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

      const currentOffset = isLoadMore ? offset : 0;
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
        // Ajouter les nouveaux messages selon la direction
        if (direction === 'up') {
          // Messages plus anciens ajoutés au début
          // Le backend retourne toujours dans l'ordre décroissant, donc on inverse pour avoir l'ordre chronologique
          setMessages(prev => [...newMessages.reverse(), ...prev]);
        } else {
          // Messages plus récents ajoutés à la fin
          setMessages(prev => [...prev, ...newMessages]);
        }
        setOffset(prev => prev + limit);
      } else {
        // Premier chargement - les messages arrivent dans l'ordre décroissant (récents -> anciens)
        // Pour BubbleStreamPage (reverseInitialOrder=false), on garde l'ordre décroissant
        // Pour ConversationLayoutResponsive (reverseInitialOrder=true), on inverse
        setMessages(reverseInitialOrder ? [...newMessages].reverse() : newMessages);
        setOffset(limit);
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
  }, [conversationId, currentUser, enabled, limit, offset, direction]);

  // Fonction pour charger plus de messages
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !enabled) return;
    
    // Protection contre les appels trop fréquents (minimum 1 seconde entre les appels)
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      console.log('[InfiniteScroll] Appel trop fréquent, ignoré');
      return;
    }
    
    // Protection supplémentaire : vérifier qu'il y a des messages à charger
    if (messages.length === 0) {
      console.log('[InfiniteScroll] Aucun message existant, pas de chargement supplémentaire');
      return;
    }
    
    lastLoadTimeRef.current = now;
    console.log('[InfiniteScroll] Chargement de plus de messages...');
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
    setHasMore(true);
    setIsInitialized(false);
    setError(null);
  }, []);

  // Fonction pour ajouter un message
  const addMessage = useCallback((message: Message): boolean => {
    let wasAdded = false;
    setMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }

      wasAdded = true;
      if (direction === 'up') {
        // Nouveaux messages ajoutés à la fin (en bas) et triés par date
        const newMessages = [...prev, message];
        return newMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else {
        // Nouveaux messages ajoutés au début (en haut) et triés par date
        const newMessages = [message, ...prev];
        return newMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    });
    return wasAdded;
  }, [direction]);

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

  // Gestion du scroll infini
  useEffect(() => {
    if (!enabled || !actualContainerRef.current || !isInitialized) return;

    const container = actualContainerRef.current;
    
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // Vérifier qu'il y a vraiment eu un mouvement de scroll
      const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current);
      if (scrollDelta < 10) {
        return; // Mouvement de scroll trop petit, ignorer
      }
      
      lastScrollTopRef.current = scrollTop;
      
      // Marquer que l'utilisateur a scrollé
      setHasUserScrolled(true);

      // Annuler le timeout précédent
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce le scroll pour éviter les appels multiples
      scrollTimeoutRef.current = setTimeout(() => {
        // Protection contre les conteneurs trop petits
        if (clientHeight >= scrollHeight) {
          return; // Pas de scroll possible
        }
        
        // Protection supplémentaire : vérifier qu'il y a vraiment du contenu à scroller
        if (scrollHeight <= clientHeight + threshold) {
          return; // Pas assez de contenu pour justifier un scroll
        }
        
        let shouldLoadMore = false;

        if (direction === 'up') {
          // Scroll vers le haut pour charger plus anciens
          shouldLoadMore = scrollTop <= threshold;
        } else {
          // Scroll vers le bas pour charger plus récents
          shouldLoadMore = scrollTop + clientHeight >= scrollHeight - threshold;
        }

        if (shouldLoadMore) {
          console.log(`[InfiniteScroll] Déclenchement chargement - direction: ${direction}, scrollTop: ${scrollTop}, threshold: ${threshold}, scrollHeight: ${scrollHeight}, clientHeight: ${clientHeight}`);
          loadMore();
        }
      }, 100); // Debounce réduit à 100ms pour plus de réactivité
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enabled, isInitialized, isLoadingMore, hasMore, direction, threshold, loadMore]);

  // Chargement initial
  useEffect(() => {
    if (conversationId && currentUser && enabled && !isInitialized) {
      console.log('[InfiniteScroll] Chargement initial des messages');
      loadMessages(false);
      
      // Initialiser la position de scroll après le chargement
      setTimeout(() => {
        if (actualContainerRef.current) {
          lastScrollTopRef.current = actualContainerRef.current.scrollTop;
        }
      }, 100);
    }
  }, [conversationId, currentUser, enabled, isInitialized, loadMessages, actualContainerRef]);

  // Chargement automatique si le conteneur n'est pas assez rempli
  useEffect(() => {
    if (!isInitialized || isLoadingMore || !hasMore || !actualContainerRef.current) return;

    const container = actualContainerRef.current;
    const { scrollHeight, clientHeight } = container;
    
    // Si le contenu ne remplit pas le conteneur, charger plus de messages
    if (scrollHeight <= clientHeight + 50 && hasMore) {
      console.log('[InfiniteScroll] Conteneur pas assez rempli, chargement automatique');
      loadMore();
    }
  }, [isInitialized, isLoadingMore, hasMore, loadMore]);

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
