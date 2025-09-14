'use client';

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { Conversation, UnifiedMessage, User, ThreadMember } from '@shared/types';

// ===== TYPES =====

interface ConversationState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  conversationParticipants: ThreadMember[];
  messages: UnifiedMessage[];
  translatedMessages: any[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  messagesError: string | null;
  typingUsers: Array<{ userId: string; username: string; conversationId: string; timestamp: number }>;
  translatingMessages: Map<string, Set<string>>;
  newMessage: string;
  selectedLanguage: string;
  isMobile: boolean;
  showConversationList: boolean;
  isCreateConversationModalOpen: boolean;
  isCreateLinkModalOpen: boolean;
  isDetailsSidebarOpen: boolean;
  justCreatedConversation: string | null;
}

type ConversationAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_SELECTED_CONVERSATION'; payload: Conversation | null }
  | { type: 'SET_CONVERSATION_PARTICIPANTS'; payload: ThreadMember[] }
  | { type: 'SET_MESSAGES'; payload: UnifiedMessage[] }
  | { type: 'ADD_MESSAGE'; payload: UnifiedMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: string; updates: Partial<UnifiedMessage> } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_TRANSLATED_MESSAGES'; payload: any[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'SET_LOADING_MORE'; payload: boolean }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_MESSAGES_ERROR'; payload: string | null }
  | { type: 'SET_TYPING_USERS'; payload: Array<{ userId: string; username: string; conversationId: string; timestamp: number }> }
  | { type: 'ADD_TYPING_USER'; payload: { userId: string; username: string; conversationId: string; timestamp: number } }
  | { type: 'REMOVE_TYPING_USER'; payload: { userId: string; conversationId: string } }
  | { type: 'SET_TRANSLATING_MESSAGES'; payload: Map<string, Set<string>> }
  | { type: 'ADD_TRANSLATING_STATE'; payload: { messageId: string; targetLanguage: string } }
  | { type: 'REMOVE_TRANSLATING_STATE'; payload: { messageId: string; targetLanguage: string } }
  | { type: 'SET_NEW_MESSAGE'; payload: string }
  | { type: 'SET_SELECTED_LANGUAGE'; payload: string }
  | { type: 'SET_IS_MOBILE'; payload: boolean }
  | { type: 'SET_SHOW_CONVERSATION_LIST'; payload: boolean }
  | { type: 'SET_CREATE_CONVERSATION_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_CREATE_LINK_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_DETAILS_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_JUST_CREATED_CONVERSATION'; payload: string | null }
  | { type: 'UPDATE_CONVERSATION_LAST_MESSAGE'; payload: { conversationId: string; message: UnifiedMessage } }
  | { type: 'UPDATE_CONVERSATION_UNREAD_COUNT'; payload: { conversationId: string; unreadCount: number } };

interface ConversationContextType {
  state: ConversationState;
  dispatch: React.Dispatch<ConversationAction>;
  
  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setSelectedConversation: (conversation: Conversation | null) => void;
  setConversationParticipants: (participants: ThreadMember[]) => void;
  setMessages: (messages: UnifiedMessage[]) => void;
  addMessage: (message: UnifiedMessage) => void;
  updateMessage: (messageId: string, updates: Partial<UnifiedMessage>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  setTranslatedMessages: (messages: any[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setMessagesError: (error: string | null) => void;
  addTypingUser: (userId: string, username: string, conversationId: string) => void;
  removeTypingUser: (userId: string, conversationId: string) => void;
  addTranslatingState: (messageId: string, targetLanguage: string) => void;
  removeTranslatingState: (messageId: string, targetLanguage: string) => void;
  setNewMessage: (message: string) => void;
  setSelectedLanguage: (language: string) => void;
  setIsMobile: (isMobile: boolean) => void;
  setShowConversationList: (show: boolean) => void;
  setCreateConversationModalOpen: (open: boolean) => void;
  setCreateLinkModalOpen: (open: boolean) => void;
  setDetailsSidebarOpen: (open: boolean) => void;
  setJustCreatedConversation: (conversationId: string | null) => void;
  updateConversationLastMessage: (conversationId: string, message: UnifiedMessage) => void;
  updateConversationUnreadCount: (conversationId: string, unreadCount: number) => void;
  
  // Computed values
  totalUnreadCount: number;
  isTranslating: (messageId: string, targetLanguage: string) => boolean;
}

// ===== INITIAL STATE =====

const initialState: ConversationState = {
  conversations: [],
  selectedConversation: null,
  conversationParticipants: [],
  messages: [],
  translatedMessages: [],
  isLoading: true,
  isLoadingMessages: false,
  isLoadingMore: false,
  hasMore: true,
  messagesError: null,
  typingUsers: [],
  translatingMessages: new Map(),
  newMessage: '',
  selectedLanguage: 'fr',
  isMobile: false,
  showConversationList: true,
  isCreateConversationModalOpen: false,
  isCreateLinkModalOpen: false,
  isDetailsSidebarOpen: false,
  justCreatedConversation: null,
};

// ===== REDUCER =====

function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    
    case 'SET_SELECTED_CONVERSATION':
      return { ...state, selectedConversation: action.payload };
    
    case 'SET_CONVERSATION_PARTICIPANTS':
      return { ...state, conversationParticipants: action.payload };
    
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      };
    
    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== action.payload)
      };
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], translatedMessages: [] };
    
    case 'SET_TRANSLATED_MESSAGES':
      return { ...state, translatedMessages: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };
    
    case 'SET_LOADING_MORE':
      return { ...state, isLoadingMore: action.payload };
    
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    
    case 'SET_MESSAGES_ERROR':
      return { ...state, messagesError: action.payload };
    
    case 'SET_TYPING_USERS':
      return { ...state, typingUsers: action.payload };
    
    case 'ADD_TYPING_USER':
      return {
        ...state,
        typingUsers: [
          ...state.typingUsers.filter(u => !(u.userId === action.payload.userId && u.conversationId === action.payload.conversationId)),
          action.payload
        ]
      };
    
    case 'REMOVE_TYPING_USER':
      return {
        ...state,
        typingUsers: state.typingUsers.filter(u => !(u.userId === action.payload.userId && u.conversationId === action.payload.conversationId))
      };
    
    case 'SET_TRANSLATING_MESSAGES':
      return { ...state, translatingMessages: action.payload };
    
    case 'ADD_TRANSLATING_STATE':
      const newTranslatingMap = new Map(state.translatingMessages);
      if (!newTranslatingMap.has(action.payload.messageId)) {
        newTranslatingMap.set(action.payload.messageId, new Set());
      }
      newTranslatingMap.get(action.payload.messageId)!.add(action.payload.targetLanguage);
      return { ...state, translatingMessages: newTranslatingMap };
    
    case 'REMOVE_TRANSLATING_STATE':
      const updatedTranslatingMap = new Map(state.translatingMessages);
      if (updatedTranslatingMap.has(action.payload.messageId)) {
        updatedTranslatingMap.get(action.payload.messageId)!.delete(action.payload.targetLanguage);
        if (updatedTranslatingMap.get(action.payload.messageId)!.size === 0) {
          updatedTranslatingMap.delete(action.payload.messageId);
        }
      }
      return { ...state, translatingMessages: updatedTranslatingMap };
    
    case 'SET_NEW_MESSAGE':
      return { ...state, newMessage: action.payload };
    
    case 'SET_SELECTED_LANGUAGE':
      return { ...state, selectedLanguage: action.payload };
    
    case 'SET_IS_MOBILE':
      return { ...state, isMobile: action.payload };
    
    case 'SET_SHOW_CONVERSATION_LIST':
      return { ...state, showConversationList: action.payload };
    
    case 'SET_CREATE_CONVERSATION_MODAL_OPEN':
      return { ...state, isCreateConversationModalOpen: action.payload };
    
    case 'SET_CREATE_LINK_MODAL_OPEN':
      return { ...state, isCreateLinkModalOpen: action.payload };
    
    case 'SET_DETAILS_SIDEBAR_OPEN':
      return { ...state, isDetailsSidebarOpen: action.payload };
    
    case 'SET_JUST_CREATED_CONVERSATION':
      return { ...state, justCreatedConversation: action.payload };
    
    case 'UPDATE_CONVERSATION_LAST_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.conversationId
            ? { ...conv, lastMessage: action.payload.message, updatedAt: new Date() }
            : conv
        )
      };
    
    case 'UPDATE_CONVERSATION_UNREAD_COUNT':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.conversationId
            ? { ...conv, unreadCount: action.payload.unreadCount }
            : conv
        )
      };
    
    default:
      return state;
  }
}

// ===== CONTEXT =====

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// ===== PROVIDER =====

interface ConversationProviderProps {
  children: React.ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);

  // Action creators
  const setConversations = useCallback((conversations: Conversation[]) => {
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
  }, []);

  const setSelectedConversation = useCallback((conversation: Conversation | null) => {
    dispatch({ type: 'SET_SELECTED_CONVERSATION', payload: conversation });
  }, []);

  const setConversationParticipants = useCallback((participants: ThreadMember[]) => {
    dispatch({ type: 'SET_CONVERSATION_PARTICIPANTS', payload: participants });
  }, []);

  const setMessages = useCallback((messages: UnifiedMessage[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: messages });
  }, []);

  const addMessage = useCallback((message: UnifiedMessage) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<UnifiedMessage>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, updates } });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    dispatch({ type: 'REMOVE_MESSAGE', payload: messageId });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const setTranslatedMessages = useCallback((messages: any[]) => {
    dispatch({ type: 'SET_TRANSLATED_MESSAGES', payload: messages });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setLoadingMessages = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING_MESSAGES', payload: loading });
  }, []);

  const setLoadingMore = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING_MORE', payload: loading });
  }, []);

  const setHasMore = useCallback((hasMore: boolean) => {
    dispatch({ type: 'SET_HAS_MORE', payload: hasMore });
  }, []);

  const setMessagesError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_MESSAGES_ERROR', payload: error });
  }, []);

  const addTypingUser = useCallback((userId: string, username: string, conversationId: string) => {
    dispatch({
      type: 'ADD_TYPING_USER',
      payload: { userId, username, conversationId, timestamp: Date.now() }
    });
  }, []);

  const removeTypingUser = useCallback((userId: string, conversationId: string) => {
    dispatch({ type: 'REMOVE_TYPING_USER', payload: { userId, conversationId } });
  }, []);

  const addTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    dispatch({ type: 'ADD_TRANSLATING_STATE', payload: { messageId, targetLanguage } });
  }, []);

  const removeTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    dispatch({ type: 'REMOVE_TRANSLATING_STATE', payload: { messageId, targetLanguage } });
  }, []);

  const setNewMessage = useCallback((message: string) => {
    dispatch({ type: 'SET_NEW_MESSAGE', payload: message });
  }, []);

  const setSelectedLanguage = useCallback((language: string) => {
    dispatch({ type: 'SET_SELECTED_LANGUAGE', payload: language });
  }, []);

  const setIsMobile = useCallback((isMobile: boolean) => {
    dispatch({ type: 'SET_IS_MOBILE', payload: isMobile });
  }, []);

  const setShowConversationList = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_CONVERSATION_LIST', payload: show });
  }, []);

  const setCreateConversationModalOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_CREATE_CONVERSATION_MODAL_OPEN', payload: open });
  }, []);

  const setCreateLinkModalOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_CREATE_LINK_MODAL_OPEN', payload: open });
  }, []);

  const setDetailsSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_DETAILS_SIDEBAR_OPEN', payload: open });
  }, []);

  const setJustCreatedConversation = useCallback((conversationId: string | null) => {
    dispatch({ type: 'SET_JUST_CREATED_CONVERSATION', payload: conversationId });
  }, []);

  const updateConversationLastMessage = useCallback((conversationId: string, message: UnifiedMessage) => {
    dispatch({ type: 'UPDATE_CONVERSATION_LAST_MESSAGE', payload: { conversationId, message } });
  }, []);

  const updateConversationUnreadCount = useCallback((conversationId: string, unreadCount: number) => {
    dispatch({ type: 'UPDATE_CONVERSATION_UNREAD_COUNT', payload: { conversationId, unreadCount } });
  }, []);

  // Computed values
  const totalUnreadCount = useMemo(() => {
    return state.conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  }, [state.conversations]);

  const isTranslating = useCallback((messageId: string, targetLanguage: string) => {
    return state.translatingMessages.get(messageId)?.has(targetLanguage) || false;
  }, [state.translatingMessages]);

  const contextValue: ConversationContextType = useMemo(() => ({
    state,
    dispatch,
    setConversations,
    setSelectedConversation,
    setConversationParticipants,
    setMessages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    setTranslatedMessages,
    setLoading,
    setLoadingMessages,
    setLoadingMore,
    setHasMore,
    setMessagesError,
    addTypingUser,
    removeTypingUser,
    addTranslatingState,
    removeTranslatingState,
    setNewMessage,
    setSelectedLanguage,
    setIsMobile,
    setShowConversationList,
    setCreateConversationModalOpen,
    setCreateLinkModalOpen,
    setDetailsSidebarOpen,
    setJustCreatedConversation,
    updateConversationLastMessage,
    updateConversationUnreadCount,
    totalUnreadCount,
    isTranslating,
  }), [
    state,
    setConversations,
    setSelectedConversation,
    setConversationParticipants,
    setMessages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    setTranslatedMessages,
    setLoading,
    setLoadingMessages,
    setLoadingMore,
    setHasMore,
    setMessagesError,
    addTypingUser,
    removeTypingUser,
    addTranslatingState,
    removeTranslatingState,
    setNewMessage,
    setSelectedLanguage,
    setIsMobile,
    setShowConversationList,
    setCreateConversationModalOpen,
    setCreateLinkModalOpen,
    setDetailsSidebarOpen,
    setJustCreatedConversation,
    updateConversationLastMessage,
    updateConversationUnreadCount,
    totalUnreadCount,
    isTranslating,
  ]);

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
}

// ===== HOOK =====

export function useConversationContext(): ConversationContextType {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversationContext must be used within a ConversationProvider');
  }
  return context;
}
