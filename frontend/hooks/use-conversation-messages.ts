/**
 * Hook spécialisé pour ConversationLayout et BubbleStreamPage
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
  scrollDirection?: 'up' | 'down'; // Direction du scroll pour charger plus: 'up' = haut (défaut), 'down' = bas
  disableAutoFill?: boolean; // Désactive le chargement automatique pour remplir le conteneur
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
  options: ConversationMessagesOptions & { linkId?: string } = {}
): ConversationMessagesReturn {
  const {
    limit = 20,
    enabled = true,
    threshold = 100,
    containerRef,
    scrollDirection = 'up', // Par défaut: scroll vers le haut (comportement actuel)
    disableAutoFill = false, // Par défaut: auto-fill activé
    linkId // Optionnel: utilisé pour les utilisateurs anonymes
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

      // Chercher le token d'authentification (auth_token ou sessionToken pour les anonymes)
      const authToken = localStorage.getItem('auth_token');
      const sessionToken = localStorage.getItem('anonymous_session_token');
      
      if (!authToken && !sessionToken) {
        throw new Error('Token d\'authentification manquant');
      }

      // Calculer l'offset AVANT de faire l'appel API
      const currentOffset = isLoadMore ? offsetRef.current : 0;

      // Déterminer l'endpoint selon le contexte
      let endpoint: string;
      const requestOptions: { headers?: Record<string, string> } = {};
      
      if (sessionToken && linkId) {
        // Route "/chat/[linkId]" : PRIORITÉ à l'endpoint des liens partagés
        endpoint = `/api/links/${linkId}/messages`;
        requestOptions.headers = { 'x-session-token': sessionToken };
      } else if (conversationId && (authToken || sessionToken)) {
        // Route "/" ou "/conversations" : utiliser l'endpoint conversations
        // Cela inclut conversationId="meeshy" pour la page publique "/"
        endpoint = `/conversations/${conversationId}/messages`;
        if (sessionToken && !authToken) {
          // Utilisateur anonyme sur route "/" (conversationId="meeshy")
          requestOptions.headers = { 'x-session-token': sessionToken };
        }
      } else {
        throw new Error('Configuration invalide pour charger les messages');
      }

      const response = await apiService.get<{ success: boolean; data: { messages: Message[] } }>(
        endpoint,
        {
          limit: limit.toString(),
          offset: currentOffset.toString(),
          include_reactions: 'true',
          include_translations: 'true'
        },
        requestOptions.headers ? { headers: requestOptions.headers } : undefined
      );

      const data = response.data;
      
      if (!data.success) {
        throw new Error('Erreur lors du chargement des messages');
      }

      const newMessages = data.data.messages || [];
      const hasMoreMessages = (data.data as any).hasMore || false;

      // Log des traductions reçues pour debugging
      console.log(`📥 [useConversationMessages] Messages chargés:`, {
        count: newMessages.length,
        offset: currentOffset,
        hasMore: hasMoreMessages,
        translationsStats: newMessages.map(m => ({
          messageId: m.id.substring(0, 8),
          hasTranslations: !!(m.translations && m.translations.length > 0),
          translationsCount: m.translations?.length || 0,
          languages: m.translations?.map((t: any) => t.targetLanguage || t.language).join(', ') || 'none'
        }))
      });

      if (isLoadMore) {
        // Sauvegarder la position de scroll et la hauteur AVANT d'ajouter les messages
        const container = actualContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight || 0;
        const scrollTopBefore = container?.scrollTop || 0;
        
        // Ajouter les messages selon la direction de scroll
        setMessages(prev => {
          // Éviter les doublons
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter((m: Message) => !existingIds.has(m.id));
          
          if (uniqueNewMessages.length === 0) {
            return prev;
          }
          
          let combined;
          if (scrollDirection === 'up') {
            // Scroll vers le haut: ajouter les messages plus anciens au DÉBUT
            combined = [...uniqueNewMessages, ...prev];
          } else {
            // Scroll vers le bas: ajouter les messages plus anciens à la FIN
            combined = [...prev, ...uniqueNewMessages];
          }
          
          // Tri explicite pour garantir l'ordre DESC par createdAt
          combined.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA; // DESC: plus récent en premier
          });
          
          return combined;
        });
        
        // Restaurer la position de scroll après le rendu
        // Utiliser requestAnimationFrame pour attendre que le DOM soit mis à jour
        if (scrollDirection === 'up') {
          // Pour scroll vers le haut: compenser la hauteur ajoutée
          requestAnimationFrame(() => {
            if (container) {
              const scrollHeightAfter = container.scrollHeight;
              const heightDifference = scrollHeightAfter - scrollHeightBefore;
              
              // Ajuster le scrollTop pour compenser la hauteur ajoutée
              const newScrollTop = scrollTopBefore + heightDifference;
              container.scrollTop = newScrollTop;
            }
          });
        }
        
        setOffset(prev => prev + limit);
        offsetRef.current += limit; // Mettre à jour la ref immédiatement
      } else {
        // Premier chargement : garder l'ordre du backend (récents en premier)
        // MessagesDisplay avec reverseOrder=true va inverser pour afficher anciens en haut, récents en bas
        // Tri explicite pour garantir l'ordre DESC par createdAt
        const sortedMessages = [...newMessages].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA; // DESC: plus récent en premier
        });
        
        setMessages(sortedMessages);
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
  }, [conversationId, currentUser, enabled, limit]); // Retirer offset puisqu'on utilise offsetRef

  // Version debounced de loadMessages pour éviter les appels multiples
  const loadMessages = useMemo(
    () => debounce(loadMessagesInternal, 300),
    [loadMessagesInternal]
  );

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
  }, [loadMessages, isLoadingMore, hasMore, enabled]);

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
      
      // Ajouter le nouveau message et GARANTIR l'ordre DESC par createdAt
      const newMessages = [message, ...prev];
      
      // Tri explicite par createdAt DESC (plus récent en premier)
      // Cela garantit que même si les messages arrivent dans le désordre via WebSocket,
      // l'affichage final (avec reverseOrder) sera correct
      newMessages.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // DESC: plus récent en premier
      });
      
      return newMessages;
    });
    
    return wasAdded;
  }, []);

  // Fonction pour mettre à jour un message (support des callbacks)
  const updateMessage = useCallback((messageId: string, updates: Partial<Message> | ((prev: Message) => Message)) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return typeof updates === 'function' ? updates(msg) : { ...msg, ...updates };
      }
      return msg;
    }));
  }, []);

  // Fonction pour supprimer un message
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Gestion du scroll infini (scroll vers le haut pour charger plus anciens)
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Attendre que le DOM soit prêt avec un délai
    const timer = setTimeout(() => {
      if (!actualContainerRef.current) {
        console.warn('[useConversationMessages] Container ref not available after 100ms delay');
        return;
      }

      const container = actualContainerRef.current;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[useConversationMessages] 🎯 Scroll listener attached:', {
          scrollDirection,
          threshold,
          containerHeight: container.clientHeight,
          scrollHeight: container.scrollHeight
        });
      }
    
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // Vérifier qu'il y a vraiment eu un mouvement de scroll
      const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current);
      if (scrollDelta < 10) {
        return;
      }
      
      lastScrollTopRef.current = scrollTop;

      // Annuler le timeout précédent
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce le scroll
      scrollTimeoutRef.current = setTimeout(() => {
        // Protection contre les conteneurs trop petits
        if (clientHeight >= scrollHeight || scrollHeight <= clientHeight + threshold) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[useConversationMessages] ⚠️ Container too small, skipping load:', {
              clientHeight,
              scrollHeight,
              threshold
            });
          }
          return;
        }
        
        // Déterminer la direction de scroll
        let shouldLoadMore = false;
        
        if (scrollDirection === 'up') {
          shouldLoadMore = scrollTop <= threshold;
          if (process.env.NODE_ENV === 'development') {
            console.log('[useConversationMessages] 📏 Scroll UP detection:', {
              scrollTop,
              threshold,
              shouldLoadMore
            });
          }
        } else {
          const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
          shouldLoadMore = distanceFromBottom <= threshold;
          if (process.env.NODE_ENV === 'development') {
            console.log('[useConversationMessages] 📏 Scroll DOWN detection:', {
              scrollTop,
              scrollHeight,
              clientHeight,
              distanceFromBottom,
              threshold,
              shouldLoadMore
            });
          }
        }

        if (shouldLoadMore) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[useConversationMessages] 🚀 Loading more messages...');
          }
          loadMore();
        }
      }, 100);
    };

      container.addEventListener('scroll', handleScroll, { passive: true });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[useConversationMessages] ✅ Scroll listener registered successfully');
      }
      
      return () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useConversationMessages] 🧹 Cleaning up scroll listener');
        }
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, 100); // Délai de 100ms pour s'assurer que le DOM est prêt

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, isLoadingMore, hasMore, threshold, loadMore, scrollDirection]);

  // Chargement initial
  useEffect(() => {
    if (conversationId && currentUser && enabled && !isInitialized) {
      loadMessages(false);
    }
  }, [conversationId, currentUser, enabled, isInitialized]);

  // Vérification du contenu après initialisation (peut être désactivé)
  useEffect(() => {
    if (disableAutoFill || !isInitialized || !actualContainerRef.current || isLoadingMore) return;

    const checkContentHeight = () => {
      if (!actualContainerRef.current || isLoadingMore || !hasMore) return;
      
      const container = actualContainerRef.current;
      const { scrollHeight, clientHeight } = container;
      
      if (scrollHeight <= clientHeight + 100) {
        loadMore();
      }
    };

    const timeoutId = setTimeout(checkContentHeight, 300);
    return () => clearTimeout(timeoutId);
  }, [isInitialized, hasMore]); // Retirer loadMore des dépendances

  // Chargement automatique si le conteneur n'est pas assez rempli (peut être désactivé)
  useEffect(() => {
    if (disableAutoFill || !isInitialized || isLoadingMore || !hasMore || !actualContainerRef.current) return;

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
  }, [disableAutoFill, isInitialized, messages.length]); // Retirer loadMore et hasMore des dépendances

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