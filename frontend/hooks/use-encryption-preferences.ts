/**
 * Hook pour gérer les préférences de chiffrement MLS
 * Communique avec l'API backend pour récupérer et mettre à jour les préférences
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { EncryptionMode } from '@/shared/types/mls';

export type { EncryptionMode }; // Re-export pour compatibilité

/**
 * Helper pour fetch avec timeout
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout en millisecondes (default: 10s)
 */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export interface EncryptionPreferences {
  userId: string;
  allowServerSideTranslationAt: Date | null;
  defaultEncryptionMode: EncryptionMode;
}

export interface ConversationEncryptionStatus {
  conversationId: string;
  encryptionMode: EncryptionMode;
  isEncrypted: boolean;
  hasServerKey: boolean;
  serverKeyNeedsRotation: boolean;
  mlsGroupId?: string;
  mlsEpoch?: number;
  membersAllowingServerTranslation: number;
  totalMembers: number;
  allMembersAllowServerTranslation: boolean;
}

export function useEncryptionPreferences() {
  const [preferences, setPreferences] = useState<EncryptionPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Récupérer les préférences depuis l'API
  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithTimeout('/api/users/me/encryption-preferences', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Non authentifié - c'est normal, ne pas afficher d'erreur
          setPreferences(null);
          return;
        }
        throw new Error('Impossible de récupérer les préférences de chiffrement');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setPreferences({
          ...data.data,
          allowServerSideTranslationAt: data.data.allowServerSideTranslationAt
            ? new Date(data.data.allowServerSideTranslationAt)
            : null,
        });
      }
    } catch (err) {
      console.error('[useEncryptionPreferences] Error fetching preferences:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Mettre à jour les préférences
  const updatePreferences = useCallback(async (updates: {
    allowServerSideTranslation?: boolean;
    defaultEncryptionMode?: EncryptionMode;
  }) => {
    try {
      const response = await fetchWithTimeout('/api/users/me/encryption-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Impossible de mettre à jour les préférences');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setPreferences({
          ...data.data,
          allowServerSideTranslationAt: data.data.allowServerSideTranslationAt
            ? new Date(data.data.allowServerSideTranslationAt)
            : null,
        });

        toast.success('Préférences de chiffrement mises à jour');
        return data.data;
      }
    } catch (err) {
      console.error('[useEncryptionPreferences] Error updating preferences:', err);
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
      throw err;
    }
  }, []);

  // Récupérer le statut de chiffrement d'une conversation
  const getConversationStatus = useCallback(async (
    conversationId: string
  ): Promise<ConversationEncryptionStatus | null> => {
    try {
      const response = await fetchWithTimeout(`/api/conversations/${conversationId}/encryption-status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          return null;
        }
        throw new Error('Impossible de récupérer le statut de chiffrement');
      }

      const data = await response.json();

      if (data.success && data.data) {
        return data.data;
      }

      return null;
    } catch (err) {
      console.error('[useEncryptionPreferences] Error fetching conversation status:', err);
      return null;
    }
  }, []);

  // Charger les préférences au montage (une seule fois)
  useEffect(() => {
    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    getConversationStatus,
    refresh: fetchPreferences,
  };
}
