'use client';

import useSWR, { mutate, SWRConfiguration } from 'swr';
import { conversationsService } from '@/services/conversations.service';
import type { Conversation, UnifiedMessage } from '@shared/types';

// ===== FETCHERS =====

const conversationsFetcher = async (): Promise<Conversation[]> => {
  const conversations = await conversationsService.getConversations();
  return conversations;
};

const conversationFetcher = async (url: string): Promise<Conversation> => {
  const id = url.split('/').pop();
  if (!id) throw new Error('Conversation ID is required');
  return await conversationsService.getConversation(id);
};

const messagesFetcher = async (url: string): Promise<{
  messages: UnifiedMessage[];
  total: number;
  hasMore: boolean;
}> => {
  const [, , conversationId, , page, limit] = url.split('/');
  if (!conversationId) throw new Error('Conversation ID is required');
  
  const result = await conversationsService.getMessages(
    conversationId, 
    parseInt(page) || 1, 
    parseInt(limit) || 20
  );
  
  return {
    messages: result.messages as UnifiedMessage[],
    total: result.total,
    hasMore: result.hasMore
  };
};

const participantsFetcher = async (url: string) => {
  const conversationId = url.split('/').pop();
  if (!conversationId) throw new Error('Conversation ID is required');
  return await conversationsService.getAllParticipants(conversationId);
};

// ===== HOOKS =====

/**
 * Hook pour récupérer toutes les conversations avec SWR
 */
export function useConversations(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate: mutateConversations } = useSWR(
    'conversations',
    conversationsFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // 5 secondes
      errorRetryCount: 3,
      ...options
    }
  );

  const addConversation = async (conversation: Conversation) => {
    // Optimistic update
    mutateConversations((current) => {
      if (!current) return [conversation];
      return [conversation, ...current];
    }, false);

    // Revalidate to ensure consistency
    mutateConversations();
  };

  const updateConversation = async (conversationId: string, updates: Partial<Conversation>) => {
    mutateConversations((current) => {
      if (!current) return current;
      return current.map(conv => 
        conv.id === conversationId ? { ...conv, ...updates } : conv
      );
    }, false);

    // Revalidate
    mutateConversations();
  };

  const removeConversation = async (conversationId: string) => {
    mutateConversations((current) => {
      if (!current) return current;
      return current.filter(conv => conv.id !== conversationId);
    }, false);

    // Revalidate
    mutateConversations();
  };

  return {
    conversations: data || [],
    isLoading,
    error,
    mutate: mutateConversations,
    addConversation,
    updateConversation,
    removeConversation
  };
}

/**
 * Hook pour récupérer une conversation spécifique
 */
export function useConversation(conversationId: string | null, options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    conversationId ? `conversation/${conversationId}` : null,
    conversationFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // 10 secondes
      errorRetryCount: 3,
      ...options
    }
  );

  return {
    conversation: data,
    isLoading,
    error,
    mutate
  };
}

/**
 * Hook pour récupérer les messages d'une conversation avec pagination
 */
export function useConversationMessages(
  conversationId: string | null,
  page: number = 1,
  limit: number = 20,
  options?: SWRConfiguration
) {
  const { data, error, isLoading, mutate } = useSWR(
    conversationId ? `messages/${conversationId}/page/${page}/limit/${limit}` : null,
    messagesFetcher,
    {
      revalidateOnFocus: false, // Pas de revalidation automatique pour les messages
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 secondes
      errorRetryCount: 2,
      ...options
    }
  );

  const addMessage = async (message: UnifiedMessage) => {
    // Optimistic update
    mutate((current) => {
      if (!current) return { messages: [message], total: 1, hasMore: false };
      return {
        ...current,
        messages: [message, ...current.messages],
        total: current.total + 1
      };
    }, false);

    // Revalidate
    mutate();
  };

  const updateMessage = async (messageId: string, updates: Partial<UnifiedMessage>) => {
    mutate((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: current.messages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        )
      };
    }, false);

    // Revalidate
    mutate();
  };

  const removeMessage = async (messageId: string) => {
    mutate((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: current.messages.filter(msg => msg.id !== messageId),
        total: Math.max(0, current.total - 1)
      };
    }, false);

    // Revalidate
    mutate();
  };

  return {
    messages: data?.messages || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    error,
    mutate,
    addMessage,
    updateMessage,
    removeMessage
  };
}

/**
 * Hook pour récupérer les participants d'une conversation
 */
export function useConversationParticipants(
  conversationId: string | null,
  options?: SWRConfiguration
) {
  const { data, error, isLoading, mutate } = useSWR(
    conversationId ? `participants/${conversationId}` : null,
    participantsFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 15000, // 15 secondes
      errorRetryCount: 3,
      ...options
    }
  );

  return {
    participants: data,
    isLoading,
    error,
    mutate
  };
}

// ===== UTILITAIRES GLOBAUX =====

/**
 * Invalide le cache des conversations
 */
export function invalidateConversations() {
  mutate('conversations');
}

/**
 * Invalide le cache d'une conversation spécifique
 */
export function invalidateConversation(conversationId: string) {
  mutate(`conversation/${conversationId}`);
}

/**
 * Invalide le cache des messages d'une conversation
 */
export function invalidateConversationMessages(conversationId: string) {
  // Invalide toutes les pages de messages pour cette conversation
  mutate((key) => {
    if (typeof key === 'string' && key.startsWith(`messages/${conversationId}/`)) {
      return true;
    }
    return false;
  });
}

/**
 * Invalide le cache des participants d'une conversation
 */
export function invalidateConversationParticipants(conversationId: string) {
  mutate(`participants/${conversationId}`);
}

/**
 * Met à jour optimistiquement le dernier message d'une conversation
 */
export function updateConversationLastMessage(conversationId: string, message: UnifiedMessage) {
  // Mettre à jour la liste des conversations
  mutate('conversations', (conversations: Conversation[] | undefined) => {
    if (!conversations) return conversations;
    return conversations.map(conv =>
      conv.id === conversationId
        ? { ...conv, lastMessage: message, updatedAt: new Date() }
        : conv
    );
  }, false);

  // Mettre à jour la conversation individuelle si elle est en cache
  mutate(`conversation/${conversationId}`, (conversation: Conversation | undefined) => {
    if (!conversation) return conversation;
    return { ...conversation, lastMessage: message, updatedAt: new Date() };
  }, false);
}

/**
 * Met à jour optimistiquement le compteur de messages non lus
 */
export function updateConversationUnreadCount(conversationId: string, unreadCount: number) {
  // Mettre à jour la liste des conversations
  mutate('conversations', (conversations: Conversation[] | undefined) => {
    if (!conversations) return conversations;
    return conversations.map(conv =>
      conv.id === conversationId
        ? { ...conv, unreadCount }
        : conv
    );
  }, false);

  // Mettre à jour la conversation individuelle si elle est en cache
  mutate(`conversation/${conversationId}`, (conversation: Conversation | undefined) => {
    if (!conversation) return conversation;
    return { ...conversation, unreadCount };
  }, false);
}

/**
 * Configuration SWR globale
 */
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  loadingTimeout: 10000,
  onError: (error) => {
    console.error('SWR Error:', error);
  },
  onSuccess: (data, key) => {
    console.log('SWR Success:', key, data);
  }
};
