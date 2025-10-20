/**
 * Hook personnalisé pour gérer les réactions emoji sur les messages
 * 
 * Fonctionnalités:
 * - Gestion de l'état local des réactions
 * - Actions: add, remove, toggle
 * - Écoute des événements WebSocket temps-réel
 * - Optimistic updates pour UX fluide
 * - Synchronisation automatique
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import type {
  ReactionAggregation,
  ReactionSync,
  ReactionUpdateEvent
} from '@shared/types/reaction';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@shared/types/socketio-events';

export interface UseMessageReactionsOptions {
  messageId: string;
  currentUserId?: string;
  isAnonymous?: boolean;
  enabled?: boolean; // Pour désactiver temporairement
}

export interface UseMessageReactionsReturn {
  // État
  reactions: ReactionAggregation[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  userReactions: string[]; // Emojis utilisés par l'utilisateur actuel
  
  // Actions
  addReaction: (emoji: string) => Promise<boolean>;
  removeReaction: (emoji: string) => Promise<boolean>;
  toggleReaction: (emoji: string) => Promise<boolean>;
  
  // Utilitaires
  hasReacted: (emoji: string) => boolean;
  getReactionCount: (emoji: string) => number;
  refreshReactions: () => Promise<void>;
}

export function useMessageReactions({
  messageId,
  currentUserId,
  isAnonymous = false,
  enabled = true
}: UseMessageReactionsOptions): UseMessageReactionsReturn {
  
  // État local
  const [reactions, setReactions] = useState<ReactionAggregation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userReactions, setUserReactions] = useState<string[]>([]);

  /**
   * Synchronise les réactions depuis le serveur
   */
  const refreshReactions = useCallback(async () => {
    if (!enabled || !messageId) {
      console.log('[useMessageReactions] refreshReactions ignoré:', { enabled, messageId });
      return;
    }

    try {
      console.log('🔄 [useMessageReactions] Demande de synchronisation pour message:', messageId);
      setIsLoading(true);
      setError(null);

      // Demander la synchronisation via WebSocket
      const socket = meeshySocketIOService.getSocket();
      if (!socket) {
        console.error('❌ [useMessageReactions] Socket non connecté');
        throw new Error('Socket not connected');
      }

      console.log('📡 [useMessageReactions] Émission de REACTION_REQUEST_SYNC pour:', messageId);

      socket.emit(
        CLIENT_EVENTS.REACTION_REQUEST_SYNC,
        messageId,
        (response: any) => {
          console.log('📥 [useMessageReactions] Réponse REACTION_REQUEST_SYNC:', {
            success: response.success,
            hasData: !!response.data,
            error: response.error,
            data: response.data
          });

          if (response.success && response.data) {
            const syncData = response.data as ReactionSync;
            console.log('✅ [useMessageReactions] Synchronisation réussie:', {
              reactionsCount: syncData.reactions.length,
              userReactionsCount: syncData.userReactions.length,
              reactions: syncData.reactions,
              userReactions: syncData.userReactions
            });
            setReactions(syncData.reactions as ReactionAggregation[]);
            setUserReactions(syncData.userReactions as string[]);
          } else {
            console.error('❌ [useMessageReactions] Échec de synchronisation:', response.error);
            setError(response.error || 'Failed to sync reactions');
          }
        }
      );
    } catch (err) {
      console.error('❌ [useMessageReactions] Erreur refreshReactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh reactions');
    } finally {
      setIsLoading(false);
    }
  }, [messageId, enabled]);

  /**
   * Ajoute une réaction avec optimistic update
   */
  const addReaction = useCallback(async (emoji: string): Promise<boolean> => {
    if (!enabled || !messageId) return false;

    // CORRECTION CRITIQUE: Ne PAS ajouter si déjà présente dans userReactions
    // Évite le double comptage avec l'événement WebSocket
    const alreadyReacted = userReactions.includes(emoji);
    if (alreadyReacted) {
      console.log('[useMessageReactions] Réaction déjà présente, ignoré');
      return true; // Retourner succès car la réaction existe déjà
    }

    try {
      // Optimistic update
      setReactions(prev => {
        const existing = prev.find(r => r.emoji === emoji);
        
        if (existing) {
          // Incrémenter le compteur existant
          return prev.map(r => 
            r.emoji === emoji 
              ? { 
                  ...r, 
                  count: r.count + 1, 
                  hasCurrentUser: true 
                }
              : r
          );
        } else {
          // Ajouter nouvelle réaction
          return [
            ...prev,
            {
              emoji,
              count: 1,
              userIds: currentUserId && !isAnonymous ? [currentUserId] : [],
              anonymousUserIds: isAnonymous && currentUserId ? [currentUserId] : [],
              hasCurrentUser: true
            }
          ];
        }
      });

      setUserReactions(prev => 
        prev.includes(emoji) ? prev : [...prev, emoji]
      );

      // Envoyer au serveur
      const socket = meeshySocketIOService.getSocket();
      if (!socket) {
        throw new Error('Socket not connected');
      }

      return new Promise((resolve) => {
        socket.emit(
          CLIENT_EVENTS.REACTION_ADD,
          { messageId, emoji },
          (response: any) => {
            if (response.success) {
              resolve(true);
            } else {
              // Revert optimistic update
              setError(response.error || 'Failed to add reaction');
              refreshReactions();
              resolve(false);
            }
          }
        );
      });
    } catch (err) {
      console.error('Error adding reaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to add reaction');
      refreshReactions(); // Revert
      return false;
    }
  }, [messageId, currentUserId, isAnonymous, enabled, refreshReactions, userReactions]);

  /**
   * Retire une réaction avec optimistic update
   */
  const removeReaction = useCallback(async (emoji: string): Promise<boolean> => {
    if (!enabled || !messageId) return false;

    try {
      // Optimistic update
      setReactions(prev => {
        const existing = prev.find(r => r.emoji === emoji);
        
        if (!existing) return prev;

        if (existing.count <= 1) {
          // Supprimer complètement
          return prev.filter(r => r.emoji !== emoji);
        } else {
          // Décrémenter le compteur
          return prev.map(r => 
            r.emoji === emoji 
              ? { 
                  ...r, 
                  count: r.count - 1, 
                  hasCurrentUser: false 
                }
              : r
          );
        }
      });

      setUserReactions(prev => prev.filter(e => e !== emoji));

      // Envoyer au serveur
      const socket = meeshySocketIOService.getSocket();
      if (!socket) {
        throw new Error('Socket not connected');
      }

      return new Promise((resolve) => {
        socket.emit(
          CLIENT_EVENTS.REACTION_REMOVE,
          { messageId, emoji },
          (response: any) => {
            if (response.success) {
              resolve(true);
            } else {
              // Revert optimistic update
              setError(response.error || 'Failed to remove reaction');
              refreshReactions();
              resolve(false);
            }
          }
        );
      });
    } catch (err) {
      console.error('Error removing reaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove reaction');
      refreshReactions(); // Revert
      return false;
    }
  }, [messageId, enabled, refreshReactions]);

  /**
   * Toggle une réaction (ajoute si absente, retire si présente)
   */
  const toggleReaction = useCallback(async (emoji: string): Promise<boolean> => {
    const hasReacted = userReactions.includes(emoji);
    
    if (hasReacted) {
      return await removeReaction(emoji);
    } else {
      return await addReaction(emoji);
    }
  }, [userReactions, addReaction, removeReaction]);

  /**
   * Vérifie si l'utilisateur a réagi avec un emoji
   */
  const hasReacted = useCallback((emoji: string): boolean => {
    return userReactions.includes(emoji);
  }, [userReactions]);

  /**
   * Obtient le compteur pour un emoji
   */
  const getReactionCount = useCallback((emoji: string): number => {
    const reaction = reactions.find(r => r.emoji === emoji);
    return reaction?.count || 0;
  }, [reactions]);

  /**
   * Compteur total de réactions
   */
  const totalCount = useMemo(() => {
    return reactions.reduce((sum, r) => sum + r.count, 0);
  }, [reactions]);

  /**
   * Synchronisation initiale
   */
  useEffect(() => {
    if (enabled && messageId) {
      refreshReactions();
    }
  }, [messageId, enabled, refreshReactions]);

  /**
   * Écoute des événements WebSocket temps-réel
   */
  useEffect(() => {
    if (!enabled || !messageId) return;

    const handleReactionAdded = (event: ReactionUpdateEvent) => {
      console.log('🎉 [useMessageReactions] Réaction reçue (temps-réel):', {
        eventMessageId: event.messageId,
        expectedMessageId: messageId,
        matches: event.messageId === messageId,
        emoji: event.emoji,
        action: event.action,
        userId: event.userId,
        aggregation: event.aggregation
      });
      
      if (event.messageId !== messageId) {
        console.log('⚠️ [useMessageReactions] Message ID ne correspond pas, ignoré');
        return;
      }

      console.log('✅ [useMessageReactions] Traitement de la réaction:', {
        messageId: event.messageId,
        emoji: event.emoji,
        action: event.action,
        userId: event.userId,
        aggregation: event.aggregation
      });

      setReactions(prev => {
        const existing = prev.find(r => r.emoji === event.emoji);
        
        console.log('📊 [useMessageReactions] État actuel reactions:', {
          prevReactions: prev,
          existing: existing,
          newAggregation: event.aggregation
        });
        
        if (existing) {
          // Mettre à jour l'agrégation existante
          return prev.map(r => 
            r.emoji === event.emoji 
              ? event.aggregation
              : r
          );
        } else {
          // Ajouter nouvelle agrégation
          return [...prev, event.aggregation];
        }
      });

      // Mettre à jour userReactions si c'est nous
      if (
        (event.userId && event.userId === currentUserId && !isAnonymous) ||
        (event.anonymousUserId && event.anonymousUserId === currentUserId && isAnonymous)
      ) {
        setUserReactions(prev => 
          prev.includes(event.emoji) ? prev : [...prev, event.emoji]
        );
      }
    };

    const handleReactionRemoved = (event: ReactionUpdateEvent) => {
      if (event.messageId !== messageId) return;

      console.log('🗑️ Réaction retirée (temps-réel):', event);

      setReactions(prev => {
        if (event.aggregation.count === 0) {
          // Supprimer complètement
          return prev.filter(r => r.emoji !== event.emoji);
        } else {
          // Mettre à jour le compteur
          return prev.map(r => 
            r.emoji === event.emoji 
              ? event.aggregation
              : r
          );
        }
      });

      // Mettre à jour userReactions si c'est nous
      if (
        (event.userId && event.userId === currentUserId && !isAnonymous) ||
        (event.anonymousUserId && event.anonymousUserId === currentUserId && isAnonymous)
      ) {
        setUserReactions(prev => prev.filter(e => e !== event.emoji));
      }
    };

    // S'abonner aux événements
    console.log('🔔 [useMessageReactions] S\'abonne aux événements pour message:', {
      messageId,
      currentUserId,
      isAnonymous,
      enabled
    });
    
    const unsubAdded = meeshySocketIOService.onReactionAdded(handleReactionAdded);
    const unsubRemoved = meeshySocketIOService.onReactionRemoved(handleReactionRemoved);
    
    console.log('✅ [useMessageReactions] Abonnement confirmé pour message:', messageId);

    return () => {
      console.log('🔕 [useMessageReactions] Se désabonne des événements pour message:', messageId);
      unsubAdded();
      unsubRemoved();
    };
  }, [messageId, currentUserId, isAnonymous, enabled]);

  return {
    // État
    reactions,
    isLoading,
    error,
    totalCount,
    userReactions,
    
    // Actions
    addReaction,
    removeReaction,
    toggleReaction,
    
    // Utilitaires
    hasReacted,
    getReactionCount,
    refreshReactions
  };
}
