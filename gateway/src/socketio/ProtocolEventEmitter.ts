/**
 * Protocol Event Emitter
 *
 * Handles emitting protocol-related events through Socket.IO
 * Bridges protocol adapters with Socket.IO clients
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  PROTOCOL_SERVER_EVENTS,
  WhatsAppMessageReceivedEventData,
  WhatsAppMessageSentEventData,
  WhatsAppStatusUpdateEventData,
  WhatsAppConnectionStatusEventData,
  ProtocolMessageReceivedEventData,
  ProtocolStatusUpdateEventData
} from '../../shared/types/socketio-protocol-events';

export class ProtocolEventEmitter {
  constructor(private io: SocketIOServer) {}

  /**
   * Emit WhatsApp message received event
   */
  emitWhatsAppMessageReceived(
    conversationId: string,
    data: WhatsAppMessageReceivedEventData,
    toRoom?: string
  ): void {
    const room = toRoom || `conversation:${conversationId}`;

    this.io.to(room).emit(
      PROTOCOL_SERVER_EVENTS.WHATSAPP_MESSAGE_RECEIVED,
      data
    );

    // Also emit generic protocol event
    this.emitProtocolMessageReceived(
      'whatsapp-dma',
      conversationId,
      {
        protocol: 'whatsapp-dma',
        messageId: data.messageId,
        conversationId,
        senderId: data.fromPhoneNumber,
        senderName: data.senderName,
        text: data.text,
        media: data.media?.map(m => ({
          type: m.type,
          url: m.url,
          fileName: m.fileName
        })),
        timestamp: data.timestamp,
        externalMessageId: data.externalMessageId,
        isEncrypted: data.isEncrypted
      },
      room
    );
  }

  /**
   * Emit WhatsApp message sent event
   */
  emitWhatsAppMessageSent(
    conversationId: string,
    data: WhatsAppMessageSentEventData,
    toRoom?: string
  ): void {
    const room = toRoom || `conversation:${conversationId}`;

    this.io.to(room).emit(
      PROTOCOL_SERVER_EVENTS.WHATSAPP_MESSAGE_SENT,
      data
    );

    // Also emit generic protocol event
    this.emitProtocolMessageSent(
      'whatsapp-dma',
      conversationId,
      {
        protocol: 'whatsapp-dma',
        messageId: data.messageId,
        externalMessageId: data.externalMessageId,
        conversationId,
        recipientId: data.toPhoneNumber,
        status: data.status,
        timestamp: data.timestamp
      },
      room
    );
  }

  /**
   * Emit WhatsApp status update event
   */
  emitWhatsAppStatusUpdate(
    conversationId: string,
    data: WhatsAppStatusUpdateEventData,
    toRoom?: string
  ): void {
    const room = toRoom || `conversation:${conversationId}`;

    this.io.to(room).emit(
      PROTOCOL_SERVER_EVENTS.WHATSAPP_STATUS_UPDATE,
      data
    );

    // Also emit generic protocol event
    this.emitProtocolStatusUpdate(
      'whatsapp-dma',
      conversationId,
      {
        protocol: 'whatsapp-dma',
        externalMessageId: data.externalMessageId,
        messageId: data.messageId,
        status: data.status,
        timestamp: data.timestamp,
        error: data.error?.message
      },
      room
    );
  }

  /**
   * Emit WhatsApp connection status event
   */
  emitWhatsAppConnectionStatus(
    data: WhatsAppConnectionStatusEventData,
    toRoom: string = 'global'
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.WHATSAPP_CONNECTION_STATUS,
      data
    );

    // Also emit generic protocol event
    this.emitProtocolConnectionStatus(
      'whatsapp-dma',
      {
        protocol: 'whatsapp-dma',
        connected: data.connected,
        timestamp: data.timestamp,
        error: data.error,
        metadata: {
          phoneNumberId: data.phoneNumberId,
          displayPhoneNumber: data.displayPhoneNumber
        }
      },
      toRoom
    );
  }

  /**
   * Emit WhatsApp webhook failure event
   */
  emitWhatsAppWebhookFailed(data: any, toRoom: string = 'admins'): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.WHATSAPP_WEBHOOK_FAILED,
      data
    );
  }

  /**
   * Emit generic protocol message received
   */
  private emitProtocolMessageReceived(
    protocol: string,
    conversationId: string,
    data: ProtocolMessageReceivedEventData,
    toRoom: string
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.PROTOCOL_MESSAGE_RECEIVED,
      data
    );
  }

  /**
   * Emit generic protocol message sent
   */
  private emitProtocolMessageSent(
    protocol: string,
    conversationId: string,
    data: any,
    toRoom: string
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.PROTOCOL_MESSAGE_SENT,
      data
    );
  }

  /**
   * Emit generic protocol status update
   */
  private emitProtocolStatusUpdate(
    protocol: string,
    conversationId: string,
    data: ProtocolStatusUpdateEventData,
    toRoom: string
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.PROTOCOL_STATUS_UPDATE,
      data
    );
  }

  /**
   * Emit generic protocol connection status
   */
  private emitProtocolConnectionStatus(
    protocol: string,
    data: any,
    toRoom: string
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.PROTOCOL_CONNECTED,
      data
    );
  }

  /**
   * Emit protocol error
   */
  emitProtocolError(
    protocol: string,
    errorCode: string,
    errorMessage: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
    toRoom: string = 'admins'
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.PROTOCOL_ERROR,
      {
        protocol,
        errorCode,
        errorMessage,
        severity,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Emit protocol sync event
   */
  emitProtocolSync(
    protocol: string,
    syncType: 'conversations' | 'users' | 'messages' | 'full',
    itemsProcessed: number,
    itemsFailed: number,
    toRoom: string = 'admins'
  ): void {
    this.io.to(toRoom).emit(
      PROTOCOL_SERVER_EVENTS.PROTOCOL_SYNC,
      {
        protocol,
        syncType,
        itemsProcessed,
        itemsFailed,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Register protocol event handlers on socket
   */
  registerProtocolHandlers(socket: Socket): void {
    // WhatsApp handlers
    socket.on('protocol:whatsapp:send-message', (data, callback) => {
      this.handleWhatsAppSendMessage(socket, data, callback);
    });

    socket.on('protocol:whatsapp:request-status', (data, callback) => {
      this.handleWhatsAppStatusRequest(socket, data, callback);
    });

    socket.on('protocol:whatsapp:connect', (data, callback) => {
      this.handleWhatsAppConnect(socket, data, callback);
    });

    socket.on('protocol:whatsapp:disconnect', (data, callback) => {
      this.handleWhatsAppDisconnect(socket, data, callback);
    });

    // Generic protocol handlers
    socket.on('protocol:send-message', (data, callback) => {
      this.handleProtocolSendMessage(socket, data, callback);
    });

    socket.on('protocol:request-status', (data, callback) => {
      this.handleProtocolStatusRequest(socket, data, callback);
    });

    socket.on('protocol:connect', (data, callback) => {
      this.handleProtocolConnect(socket, data, callback);
    });

    socket.on('protocol:disconnect', (data, callback) => {
      this.handleProtocolDisconnect(socket, data, callback);
    });
  }

  /**
   * Handle WhatsApp send message request
   */
  private async handleWhatsAppSendMessage(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      // This would be implemented by the actual messaging service
      callback?.({
        success: true,
        message: 'Message sent to WhatsApp handler'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle WhatsApp status request
   */
  private async handleWhatsAppStatusRequest(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Status request received'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle WhatsApp connect request
   */
  private async handleWhatsAppConnect(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Connect request received'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle WhatsApp disconnect request
   */
  private async handleWhatsAppDisconnect(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Disconnect request received'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle generic protocol send message
   */
  private async handleProtocolSendMessage(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Protocol message sent'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle generic protocol status request
   */
  private async handleProtocolStatusRequest(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Protocol status request received'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle generic protocol connect
   */
  private async handleProtocolConnect(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Protocol connect request received'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle generic protocol disconnect
   */
  private async handleProtocolDisconnect(
    socket: Socket,
    data: any,
    callback?: (result: any) => void
  ): Promise<void> {
    try {
      callback?.({
        success: true,
        message: 'Protocol disconnect request received'
      });
    } catch (error) {
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
