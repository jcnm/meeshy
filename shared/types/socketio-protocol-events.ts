/**
 * Protocol Integration Socket.IO Events
 *
 * Extends the base Socket.IO events to support protocol integrations
 * (WhatsApp, iMessage, Signal, etc.)
 */

// ===== PROTOCOL EVENTS =====

export const PROTOCOL_SERVER_EVENTS = {
  // WhatsApp specific
  WHATSAPP_MESSAGE_RECEIVED: 'protocol:whatsapp:message-received',
  WHATSAPP_MESSAGE_SENT: 'protocol:whatsapp:message-sent',
  WHATSAPP_STATUS_UPDATE: 'protocol:whatsapp:status-update',
  WHATSAPP_CONNECTION_STATUS: 'protocol:whatsapp:connection-status',
  WHATSAPP_WEBHOOK_FAILED: 'protocol:whatsapp:webhook-failed',

  // Generic protocol events
  PROTOCOL_MESSAGE_RECEIVED: 'protocol:message-received',
  PROTOCOL_MESSAGE_SENT: 'protocol:message-sent',
  PROTOCOL_STATUS_UPDATE: 'protocol:status-update',
  PROTOCOL_SYNC: 'protocol:sync',
  PROTOCOL_ERROR: 'protocol:error',
  PROTOCOL_CONNECTED: 'protocol:connected',
  PROTOCOL_DISCONNECTED: 'protocol:disconnected'
} as const;

export const PROTOCOL_CLIENT_EVENTS = {
  // WhatsApp specific
  WHATSAPP_SEND_MESSAGE: 'protocol:whatsapp:send-message',
  WHATSAPP_REQUEST_STATUS: 'protocol:whatsapp:request-status',
  WHATSAPP_CONNECT: 'protocol:whatsapp:connect',
  WHATSAPP_DISCONNECT: 'protocol:whatsapp:disconnect',

  // Generic protocol events
  PROTOCOL_SEND_MESSAGE: 'protocol:send-message',
  PROTOCOL_REQUEST_STATUS: 'protocol:request-status',
  PROTOCOL_CONNECT: 'protocol:connect',
  PROTOCOL_DISCONNECT: 'protocol:disconnect'
} as const;

// ===== PROTOCOL EVENT DATA TYPES =====

/**
 * WhatsApp message received event data
 */
export interface WhatsAppMessageReceivedEventData {
  readonly messageId: string;
  readonly conversationId: string;
  readonly fromPhoneNumber: string;
  readonly senderName?: string;
  readonly text: string;
  readonly media?: Array<{
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    fileName?: string;
    mimeType?: string;
  }>;
  readonly timestamp: string;
  readonly externalMessageId: string;
  readonly isEncrypted: boolean;
  readonly encryptionType?: string;
}

/**
 * WhatsApp message sent event data
 */
export interface WhatsAppMessageSentEventData {
  readonly messageId: string;
  readonly externalMessageId: string;
  readonly conversationId: string;
  readonly toPhoneNumber: string;
  readonly status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  readonly timestamp: string;
}

/**
 * WhatsApp status update event data
 */
export interface WhatsAppStatusUpdateEventData {
  readonly externalMessageId: string;
  readonly messageId?: string;
  readonly status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  readonly timestamp: string;
  readonly recipientPhoneNumber?: string;
  readonly error?: {
    code: number;
    message: string;
  };
}

/**
 * WhatsApp connection status event data
 */
export interface WhatsAppConnectionStatusEventData {
  readonly connected: boolean;
  readonly phoneNumberId?: string;
  readonly displayPhoneNumber?: string;
  readonly timestamp: string;
  readonly error?: string;
  readonly reconnectingIn?: number; // milliseconds
}

/**
 * Generic protocol message received
 */
export interface ProtocolMessageReceivedEventData {
  readonly protocol: string;
  readonly messageId: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderName?: string;
  readonly text: string;
  readonly media?: Array<{
    type: string;
    url: string;
    fileName?: string;
  }>;
  readonly timestamp: string;
  readonly externalMessageId: string;
  readonly isEncrypted: boolean;
}

/**
 * Generic protocol message sent
 */
export interface ProtocolMessageSentEventData {
  readonly protocol: string;
  readonly messageId: string;
  readonly externalMessageId: string;
  readonly conversationId: string;
  readonly recipientId: string;
  readonly status: string;
  readonly timestamp: string;
}

/**
 * Generic protocol status update
 */
export interface ProtocolStatusUpdateEventData {
  readonly protocol: string;
  readonly externalMessageId: string;
  readonly messageId?: string;
  readonly status: string;
  readonly timestamp: string;
  readonly error?: string;
}

/**
 * Protocol sync event (e.g., syncing conversations, users)
 */
export interface ProtocolSyncEventData {
  readonly protocol: string;
  readonly syncType: 'conversations' | 'users' | 'messages' | 'full';
  readonly itemsProcessed: number;
  readonly itemsFailed: number;
  readonly timestamp: string;
}

/**
 * Protocol connection status event
 */
export interface ProtocolConnectionStatusEventData {
  readonly protocol: string;
  readonly connected: boolean;
  readonly timestamp: string;
  readonly error?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * Protocol error event
 */
export interface ProtocolErrorEventData {
  readonly protocol: string;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly timestamp: string;
  readonly context?: Record<string, any>;
}

/**
 * WhatsApp webhook failure event
 */
export interface WhatsAppWebhookFailedEventData {
  readonly webhookEventType: string;
  readonly reason: string;
  readonly timestamp: string;
  readonly retryCount: number;
  readonly nextRetryAt?: string;
}

// ===== TYPE EXPORTS =====

export type ProtocolServerEventNames = typeof PROTOCOL_SERVER_EVENTS[keyof typeof PROTOCOL_SERVER_EVENTS];
export type ProtocolClientEventNames = typeof PROTOCOL_CLIENT_EVENTS[keyof typeof PROTOCOL_CLIENT_EVENTS];

// ===== CLIENT REQUEST/RESPONSE TYPES =====

/**
 * WhatsApp send message request
 */
export interface WhatsAppSendMessageRequest {
  readonly conversationId: string;
  readonly toPhoneNumber: string;
  readonly text: string;
  readonly media?: Array<{
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    fileName?: string;
  }>;
  readonly useSignalEncryption?: boolean;
}

/**
 * Protocol send message request
 */
export interface ProtocolSendMessageRequest {
  readonly protocol: string;
  readonly conversationId: string;
  readonly recipientId: string;
  readonly text: string;
  readonly media?: Array<{
    type: string;
    url: string;
  }>;
  readonly metadata?: Record<string, any>;
}

/**
 * Protocol status request
 */
export interface ProtocolStatusRequest {
  readonly protocol: string;
  readonly externalMessageId?: string;
  readonly conversationId?: string;
}

/**
 * Protocol connection request
 */
export interface ProtocolConnectionRequest {
  readonly protocol: string;
  readonly action: 'connect' | 'disconnect' | 'verify' | 'reconnect';
}

// ===== RESPONSE TYPES =====

/**
 * Protocol action response
 */
export interface ProtocolActionResponse {
  readonly success: boolean;
  readonly protocol: string;
  readonly action: string;
  readonly message?: string;
  readonly error?: {
    code: string;
    message: string;
  };
  readonly metadata?: Record<string, any>;
}
