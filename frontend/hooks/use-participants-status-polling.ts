/**
 * Hook pour rafraîchir périodiquement les statuts des participants
 * Approche passive : exploite les requêtes API normales pour obtenir les lastActiveAt mis à jour
 * Sans heartbeat actif côté frontend
 */

'use client';

import { useEffect, useRef } from 'react';
import { conversationsService } from '@/services/conversations.service';
import type { User } from '@/types';

export interface UseParticipantsStatusPollingOptions {
  conversationId: string | null;
  enabled?: boolean;
  intervalMs?: number; // Défaut: 180000 (3 minutes)
  onParticipantsUpdate?: (participants: User[]) => void;
}

/**
 * Hook pour rafraîchir périodiquement les statuts des participants
 *
 * Stratégie passive :
 * - Pas de heartbeat actif envoyé au backend
 * - Le backend met à jour lastActiveAt à chaque requête API (middleware)
 * - On poll périodiquement les participants pour obtenir les lastActiveAt frais
 * - Le composant calcule ensuite isOnline basé sur lastActiveAt (< 5 min)
 *
 * @param options Configuration du polling
 */
export function useParticipantsStatusPolling(options: UseParticipantsStatusPollingOptions) {
  const {
    conversationId,
    enabled = true,
    intervalMs = 180000, // 3 minutes par défaut
    onParticipantsUpdate
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    // Ne rien faire si désactivé ou pas de conversation
    if (!enabled || !conversationId) {
      return;
    }

    // Fonction pour rafraîchir les participants
    const refreshParticipants = async () => {
      // Éviter les requêtes concurrentes
      if (isPollingRef.current) {
        return;
      }

      try {
        isPollingRef.current = true;

        // Récupérer les participants avec leurs statuts actualisés
        const participants = await conversationsService.getParticipants(conversationId);

        // Notifier le composant parent
        if (onParticipantsUpdate) {
          onParticipantsUpdate(participants);
        }

        console.log('[UseParticipantsStatusPolling] Participants refreshed:', {
          conversationId,
          count: participants.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[UseParticipantsStatusPolling] Error refreshing participants:', error);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Rafraîchir immédiatement au montage
    refreshParticipants();

    // Configurer le polling périodique
    intervalRef.current = setInterval(refreshParticipants, intervalMs);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [conversationId, enabled, intervalMs, onParticipantsUpdate]);

  // Fonction pour forcer un refresh manuel
  const refreshNow = async () => {
    if (!conversationId || isPollingRef.current) {
      return;
    }

    try {
      isPollingRef.current = true;
      const participants = await conversationsService.getParticipants(conversationId);

      if (onParticipantsUpdate) {
        onParticipantsUpdate(participants);
      }

      console.log('[UseParticipantsStatusPolling] Manual refresh completed');
    } catch (error) {
      console.error('[UseParticipantsStatusPolling] Manual refresh error:', error);
    } finally {
      isPollingRef.current = false;
    }
  };

  return {
    refreshNow
  };
}
