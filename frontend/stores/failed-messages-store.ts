/**
 * Store pour gérer les messages en échec d'envoi
 * Permet de sauvegarder et restaurer les messages qui n'ont pas pu être envoyés
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface FailedMessage {
  id: string; // Identifiant unique du message en échec
  conversationId: string;
  content: string;
  originalLanguage: string;
  attachmentIds: string[];
  replyToId?: string;
  timestamp: number;
  error: string;
  retryCount: number;
  // Métadonnées pour l'affichage
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
  replyTo?: {
    id: string;
    content: string;
    sender?: {
      displayName: string;
      username: string;
    };
    createdAt: Date | string;
  };
}

interface FailedMessagesState {
  failedMessages: FailedMessage[];
  
  // Actions
  addFailedMessage: (message: Omit<FailedMessage, 'id' | 'timestamp' | 'retryCount'>) => string;
  removeFailedMessage: (id: string) => void;
  getFailedMessage: (id: string) => FailedMessage | undefined;
  getFailedMessagesForConversation: (conversationId: string) => FailedMessage[];
  incrementRetryCount: (id: string) => void;
  clearFailedMessages: (conversationId?: string) => void;
  clearAllFailedMessages: () => void;
  updateFailedMessage: (id: string, updates: Partial<FailedMessage>) => void;
}

export const useFailedMessagesStore = create<FailedMessagesState>()(
  persist(
    (set, get) => ({
      failedMessages: [],

      addFailedMessage: (message) => {
        const id = `failed-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newMessage: FailedMessage = {
          ...message,
          id,
          timestamp: Date.now(),
          retryCount: 0,
        };

        set((state) => ({
          failedMessages: [...state.failedMessages, newMessage],
        }));

        console.log('💾 Message sauvegardé en échec:', {
          id,
          conversationId: message.conversationId,
          contentLength: message.content.length,
          hasAttachments: message.attachmentIds.length > 0,
          hasReplyTo: !!message.replyToId,
        });

        return id;
      },

      removeFailedMessage: (id) => {
        set((state) => ({
          failedMessages: state.failedMessages.filter((msg) => msg.id !== id),
        }));
        console.log('🗑️  Message en échec supprimé:', id);
      },

      getFailedMessage: (id) => {
        return get().failedMessages.find((msg) => msg.id === id);
      },

      getFailedMessagesForConversation: (conversationId) => {
        return get().failedMessages.filter((msg) => msg.conversationId === conversationId);
      },

      incrementRetryCount: (id) => {
        set((state) => ({
          failedMessages: state.failedMessages.map((msg) =>
            msg.id === id ? { ...msg, retryCount: msg.retryCount + 1 } : msg
          ),
        }));
      },

      clearFailedMessages: (conversationId) => {
        if (conversationId) {
          set((state) => ({
            failedMessages: state.failedMessages.filter(
              (msg) => msg.conversationId !== conversationId
            ),
          }));
          console.log('🗑️  Messages en échec supprimés pour la conversation:', conversationId);
        } else {
          set({ failedMessages: [] });
          console.log('🗑️  Tous les messages en échec supprimés');
        }
      },

      updateFailedMessage: (id, updates) => {
        set((state) => ({
          failedMessages: state.failedMessages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }));
      },

      clearAllFailedMessages: () => {
        // 1. Reset state
        set({ failedMessages: [] });

        // 2. CRITIQUE: Supprimer explicitement localStorage persist
        // Sans ça, les données persistent et se rechargent au reload
        if (typeof window !== 'undefined') {
          localStorage.removeItem('meeshy-failed-messages');
        }

        console.log('[FAILED_MESSAGES] All failed messages cleared - clean slate');
      },
    }),
    {
      name: 'meeshy-failed-messages',
      storage: createJSONStorage(() => localStorage),
      // Ne persister que les 10 derniers messages en échec pour éviter de remplir le localStorage
      partialize: (state) => ({
        failedMessages: state.failedMessages.slice(-10),
      }),
    }
  )
);
