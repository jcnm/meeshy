'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { conversationsService } from '@/services/conversations.service';
import { messageTranslationService } from '@/services/message-translation.service';
import type { Conversation, Message, User, MessageTranslation } from '@shared/types';
import { toast } from 'sonner';

interface ConversationContextType {
  // Conversations
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoadingConversations: boolean;
  
  // Messages
  messages: Map<string, Message[]>; // conversationId -> messages
  isLoadingMessages: Map<string, boolean>;
  hasMoreMessages: Map<string, boolean>;
  
  // Translations
  translatingMessages: Map<string, Set<string>>; // messageId -> Set of targetLanguages
  
  // Actions
  loadConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  selectConversation: (conversationId: string) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  
  loadMessages: (conversationId: string, options?: { offset?: number; limit?: number }) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  
  requestTranslation: (messageId: string, targetLanguage: string, sourceLanguage?: string) => Promise<void>;
  addTranslation: (messageId: string, translation: MessageTranslation) => void;
  sendMessage: (content: string) => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
};

interface ConversationProviderProps {
  children: React.ReactNode;
  user: User | null;
}

export function ConversationProvider({ children, user }: ConversationProviderProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [isLoadingMessages, setIsLoadingMessages] = useState<Map<string, boolean>>(new Map());
  const [hasMoreMessages, setHasMoreMessages] = useState<Map<string, boolean>>(new Map());
  
  const [translatingMessages, setTranslatingMessages] = useState<Map<string, Set<string>>>(new Map());
  
  const conversationsLoadedRef = useRef(false);
  const messageOffsetsRef = useRef<Map<string, number>>(new Map());

  // Update conversation
  const updateConversation = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setConversations(prev => 
      prev.map(c => c.id === conversationId ? { ...c, ...updates } : c)
    );
    
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [currentConversation]);

  // Update message
  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<Message>) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      const messages = newMap.get(conversationId);
      
      if (messages) {
        newMap.set(
          conversationId,
          messages.map(m => m.id === messageId ? { ...m, ...updates } : m)
        );
      }
      
      return newMap;
    });
  }, []);

  // Add message
  const addMessage = useCallback((conversationId: string, message: Message) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      const existingMessages = newMap.get(conversationId) || [];
      
      // Check for duplicates
      if (existingMessages.some(m => m.id === message.id)) {
        return prev;
      }
      
      // Add to beginning (newest first)
      newMap.set(conversationId, [message, ...existingMessages]);
      return newMap;
    });
    
    // Update conversation's last message
    updateConversation(conversationId, {
      lastMessage: message
    });
  }, [updateConversation]);

  // Delete message
  const deleteMessage = useCallback((conversationId: string, messageId: string) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      const messages = newMap.get(conversationId);
      
      if (messages) {
        newMap.set(
          conversationId,
          messages.filter(m => m.id !== messageId)
        );
      }
      
      return newMap;
    });
  }, []);

  // Handle translation received
  const handleTranslationReceived = useCallback((messageId: string, translations: any[]) => {
    // Find the conversation containing this message
    for (const [conversationId, msgs] of messages.entries()) {
      const messageIndex = msgs.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        const message = msgs[messageIndex];
        
        // Update message with new translations
        const updatedTranslations = [...(message.translations || [])];
        
        translations.forEach(newTranslation => {
          const existingIndex = updatedTranslations.findIndex(
            t => t.targetLanguage === newTranslation.targetLanguage
          );
          
          if (existingIndex >= 0) {
            updatedTranslations[existingIndex] = newTranslation;
          } else {
            updatedTranslations.push(newTranslation);
          }
        });
        
        updateMessage(conversationId, messageId, { translations: updatedTranslations });
        
        // Remove from translating state
        translations.forEach(t => {
          setTranslatingMessages(prev => {
            const newMap = new Map(prev);
            const langs = newMap.get(messageId);
            if (langs) {
              langs.delete(t.targetLanguage);
              if (langs.size === 0) {
                newMap.delete(messageId);
              }
            }
            return newMap;
          });
        });
        
        break;
      }
    }
  }, [messages, updateMessage]);

  // Socket.IO messaging hook
  const { 
    sendMessage: socketSendMessage,
    joinConversation,
    leaveConversation,
    connectionStatus 
  } = useSocketIOMessaging({
    conversationId: currentConversation?.id,
    currentUser: user || undefined,
    onNewMessage: (message) => {
      if (message.conversationId) {
        addMessage(message.conversationId, message as Message);
      }
    },
    onMessageEdited: (message) => {
      if (message.conversationId) {
        updateMessage(message.conversationId, message.id, { content: message.content });
      }
    },
    onMessageDeleted: (messageId) => {
      const conversationId = Array.from(messages.entries()).find(([_, msgs]) => 
        msgs.some(m => m.id === messageId)
      )?.[0];
      
      if (conversationId) {
        deleteMessage(conversationId, messageId);
      }
    },
    onTranslation: (data: any) => {
      if (data && data.messageId && data.translations) {
        handleTranslationReceived(data.messageId, data.translations);
      }
    },
    onConversationStats: (data) => {
      if (currentConversation?.id === data.conversationId && data.stats) {
        updateConversation(data.conversationId, {
          stats: currentConversation.stats ? {
            ...currentConversation.stats,
            totalMessages: data.stats.totalMessages || currentConversation.stats.totalMessages,
            totalParticipants: data.stats.totalMembers || currentConversation.stats.totalParticipants
          } : undefined
        });
      }
    }
  });

  // Load conversations (only once)
  const loadConversations = useCallback(async () => {
    if (conversationsLoadedRef.current || isLoadingConversations || !user) return;
    
    setIsLoadingConversations(true);
    try {
      const data = await conversationsService.getConversations();
      setConversations(data);
      conversationsLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user, isLoadingConversations]);

  // Load single conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      const conversation = await conversationsService.getConversation(conversationId);
      
      // Update or add to conversations list
      setConversations(prev => {
        const exists = prev.some(c => c.id === conversationId);
        if (exists) {
          return prev.map(c => c.id === conversationId ? conversation : c);
        }
        return [...prev, conversation];
      });
      
      setCurrentConversation(conversation);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    }
  }, [user]);

  // Select conversation
  const selectConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversation(conversation);
    }
  }, [conversations]);

  // Add conversation (for real-time updates)
  const addConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => {
      // Avoid duplicates
      if (prev.some(c => c.id === conversation.id)) {
        return prev;
      }
      // Add at the beginning for new conversations
      return [conversation, ...prev];
    });
  }, []);

  // Load messages for a conversation
  const loadMessages = useCallback(async (
    conversationId: string, 
    options: { offset?: number; limit?: number } = {}
  ) => {
    if (!user) return;
    
    const { offset = 0, limit = 20 } = options;
    
    // Check if already loading
    if (isLoadingMessages.get(conversationId)) return;
    
    setIsLoadingMessages(prev => new Map(prev).set(conversationId, true));
    
    try {
      const response = await conversationsService.getMessages(conversationId, offset / limit + 1, limit);
      
      setMessages(prev => {
        const newMap = new Map(prev);
        const existingMessages = newMap.get(conversationId) || [];
        
        if (offset === 0) {
          // Initial load - replace
          newMap.set(conversationId, response.messages);
        } else {
          // Pagination - append older messages
          const messageIds = new Set(existingMessages.map(m => m.id));
          const newMessages = response.messages.filter((m: Message) => !messageIds.has(m.id));
          newMap.set(conversationId, [...existingMessages, ...newMessages]);
        }
        
        return newMap;
      });
      
      setHasMoreMessages(prev => new Map(prev).set(conversationId, response.hasMore));
      messageOffsetsRef.current.set(conversationId, offset + response.messages.length);
      
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(conversationId, false);
        return newMap;
      });
    }
  }, [user]);

  // Request translation
  const requestTranslation = useCallback(async (
    messageId: string, 
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ) => {
    // Mark as translating
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      const langs = newMap.get(messageId) || new Set();
      langs.add(targetLanguage);
      newMap.set(messageId, langs);
      return newMap;
    });

    try {
      await messageTranslationService.requestTranslation({
        messageId,
        targetLanguage,
        sourceLanguage,
        model: 'basic'
      });
    } catch (error) {
      console.error('Translation request failed:', error);
      toast.error('Failed to request translation');
      
      // Remove from translating
      setTranslatingMessages(prev => {
        const newMap = new Map(prev);
        const langs = newMap.get(messageId);
        if (langs) {
          langs.delete(targetLanguage);
          if (langs.size === 0) {
            newMap.delete(messageId);
          }
        }
        return newMap;
      });
    }
  }, []);

  // Add translation
  const addTranslation = useCallback((messageId: string, translation: MessageTranslation) => {
    handleTranslationReceived(messageId, [translation]);
  }, [handleTranslationReceived]);

  // Send message wrapper
  const sendMessage = useCallback(async (content: string) => {
    if (!currentConversation?.id || !user) return;
    
    await socketSendMessage(content);
  }, [currentConversation?.id, user, socketSendMessage]);

  // Join/leave conversation when current conversation changes
  useEffect(() => {
    if (currentConversation?.id && user) {
      joinConversation(currentConversation.id);
      
      // Load messages if not already loaded
      if (!messages.has(currentConversation.id)) {
        loadMessages(currentConversation.id);
      }
      
      return () => {
        leaveConversation(currentConversation.id);
      };
    }
  }, [currentConversation?.id, user, joinConversation, leaveConversation, loadMessages, messages]);

  // Socket.IO event for new conversations
  useEffect(() => {
    const handleNewConversation = (conversation: Conversation) => {
      // Only add if user is a member
      if (conversation.participants?.some(p => p.userId === user?.id)) {
        addConversation(conversation);
      }
    };

    // Listen for new conversation events
    if (user) {
      // You would connect this to your socket service
      // meeshySocketIOService.on('conversation:created', handleNewConversation);
    }

    return () => {
      // Cleanup
      // meeshySocketIOService.off('conversation:created', handleNewConversation);
    };
  }, [user, addConversation]);

  const value: ConversationContextType = {
    conversations,
    currentConversation,
    isLoadingConversations,
    messages,
    isLoadingMessages,
    hasMoreMessages,
    translatingMessages,
    loadConversations,
    loadConversation,
    selectConversation,
    addConversation,
    updateConversation,
    loadMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    requestTranslation,
    addTranslation,
    sendMessage
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}