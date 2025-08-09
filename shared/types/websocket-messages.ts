/**
 * Interface principale pour tous les messages WebSocket dans Meeshy
 */

import {
  UserWebSocketAction,
  BroadcastEventType,
  MessageData,
  TranslationData,
  TypingData,
  ChatMembershipData,
  MessageReadData
} from './websocket-events';

// ===== MESSAGE WEBSOCKET UNIFIÉ =====

export interface WebSocketMessage {
  type: UserWebSocketAction | string; // string pour les broadcasts
  conversationId?: string; // Optionnel pour les actions globales
  timestamp: number;
  requestId?: string;
  data?: WebSocketMessageData;
  
  // Propriétés spécifiques pour compatibilité
  messageId?: string;
  userId?: string;
  content?: string;
  senderId?: string;
}

// ===== UNION DES DONNÉES POSSIBLES =====

export type WebSocketMessageData = 
  | MessageData
  | TranslationData
  | TypingData
  | ChatMembershipData
  | MessageReadData
  | { [key: string]: any }; // Fallback pour flexibilité

// ===== MESSAGES TYPÉS SPÉCIFIQUES =====

export interface NewMessageAction extends WebSocketMessage {
  type: 'new_message';
  conversationId: string;
  content: string;
  senderId: string;
  tempId?: string;
}

export interface JoinChatAction extends WebSocketMessage {
  type: 'join_chat';
  conversationId: string;
}

export interface StartTypingAction extends WebSocketMessage {
  type: 'start_typing';
  conversationId: string;
}

export interface MessageReceivedBroadcast extends WebSocketMessage {
  type: `message_received_${string}`; // Template literal pour le conversationId
  data: MessageData;
}

export interface MessageTranslatedBroadcast extends WebSocketMessage {
  type: `message_translated_${string}`;
  data: {
    messageId: string;
    translations: TranslationData[];
  };
}

export interface TypingStartedBroadcast extends WebSocketMessage {
  type: `typing_started_${string}`;
  data: TypingData;
}

// ===== FACTORY FUNCTIONS =====

export function createUserMessage(
  type: UserWebSocketAction,
  conversationId: string,
  data?: any,
  requestId?: string
): WebSocketMessage {
  return {
    type,
    conversationId,
    timestamp: Date.now(),
    requestId,
    data
  };
}

export function createBroadcastMessage(
  event: BroadcastEventType,
  conversationId: string,
  data: any,
  excludeUserId?: string
): WebSocketMessage {
  return {
    type: `${event}_${conversationId}`,
    conversationId,
    timestamp: Date.now(),
    data,
    userId: excludeUserId // Pour exclusion
  };
}

// ===== TYPE GUARDS =====

export function isNewMessageAction(msg: WebSocketMessage): msg is NewMessageAction {
  return msg.type === 'new_message' && !!msg.conversationId && !!msg.content;
}

export function isJoinChatAction(msg: WebSocketMessage): msg is JoinChatAction {
  return msg.type === 'join_chat' && !!msg.conversationId;
}

export function isMessageReceivedBroadcast(msg: WebSocketMessage): msg is MessageReceivedBroadcast {
  return typeof msg.type === 'string' && msg.type.startsWith('message_received_');
}

export function isTypingEvent(msg: WebSocketMessage): boolean {
  return typeof msg.type === 'string' && 
    (msg.type.includes('typing_started_') || msg.type.includes('typing_stopped_'));
}
