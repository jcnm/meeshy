/**
 * Types unifiés pour les événements WebSocket Meeshy
 * Utilisés par Frontend, Gateway et Translator
 */

// ===== ACTIONS UTILISATEUR (Frontend → Gateway) =====
export type UserWebSocketAction = 
  // Messages
  | 'new_message'
  | 'deleted_message' 
  | 'updated_message'
  | 'translate_message'
  | 'received_message'
  | 'read_message'
  | 'opened_message'
  
  // Chat/Conversation
  | 'join_chat'
  | 'leave_chat'
  
  // Frappe
  | 'start_typing'
  | 'stop_typing';

// ===== ÉVÉNEMENTS BROADCAST (Gateway → Frontend) =====
export type BroadcastEventType =
  // Messages
  | 'message_received'
  | 'message_translated' 
  | 'message_deleted'
  | 'message_updated'
  | 'message_read'
  | 'message_listened'
  | 'message_viewed'
  | 'message_opened'
  
  // Chat
  | 'chat_in'
  | 'chat_out'
  
  // Frappe
  | 'typing_started'
  | 'typing_stopped';

// ===== STRUCTURES DE DONNÉES =====

export interface BaseWebSocketMessage {
  type: UserWebSocketAction | string; // string pour les broadcasts avec conversation_id
  timestamp: number;
  requestId?: string; // Pour tracer les requêtes
}

export interface UserActionMessage extends BaseWebSocketMessage {
  type: UserWebSocketAction;
  conversationId: string;
  data: any;
}

export interface BroadcastMessage extends BaseWebSocketMessage {
  type: string; // Format: `${BroadcastEventType}_${conversationId}`
  data: any;
  excludeUserId?: string; // Pour exclure l'expéditeur
}

// ===== DONNÉES SPÉCIFIQUES =====

export interface MessageData {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  originalLanguage: string;
  createdAt: string;
  updatedAt?: string;
  tempId?: string; // Pour l'optimistic UI
  sender?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface TranslationData {
  messageId: string;
  targetLanguage: string;
  translatedContent: string;
  translationModel: 'basic' | 'medium' | 'premium';
  confidence?: number;
  fromCache: boolean;
}

export interface TypingData {
  userId: string;
  username: string;
  conversationId: string;
}

export interface ChatMembershipData {
  userId: string;
  username: string;
  conversationId: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface MessageReadData {
  messageId: string;
  userId: string;
  username: string;
  conversationId: string;
  readAt: string;
}

// ===== HELPERS =====

export function createBroadcastType(event: BroadcastEventType, conversationId: string): string {
  return `${event}_${conversationId}`;
}

export function parseBroadcastType(type: string): { event: BroadcastEventType; conversationId: string } | null {
  const parts = type.split('_');
  if (parts.length < 3) return null;
  
  const conversationId = parts.pop()!;
  const event = parts.join('_') as BroadcastEventType;
  
  return { event, conversationId };
}

// ===== VALIDATION =====

export function isUserAction(type: string): type is UserWebSocketAction {
  const userActions: UserWebSocketAction[] = [
    'new_message', 'deleted_message', 'updated_message', 'translate_message',
    'received_message', 'read_message', 'opened_message',
    'join_chat', 'leave_chat', 'start_typing', 'stop_typing'
  ];
  return userActions.includes(type as UserWebSocketAction);
}

export function isBroadcastEvent(type: string): boolean {
  const broadcastEvents: BroadcastEventType[] = [
    'message_received', 'message_translated', 'message_deleted', 'message_updated',
    'message_read', 'message_listened', 'message_viewed', 'message_opened',
    'chat_in', 'chat_out', 'typing_started', 'typing_stopped'
  ];
  
  const parsed = parseBroadcastType(type);
  return parsed !== null && broadcastEvents.includes(parsed.event);
}
