import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

interface MessageServiceClient {
  CreateMessage: (request: any, callback: (error: any, response: any) => void) => void;
  GetMessage: (request: any, callback: (error: any, response: any) => void) => void;
  UpdateMessage: (request: any, callback: (error: any, response: any) => void) => void;
  DeleteMessage: (request: any, callback: (error: any, response: any) => void) => void;
  TranslateMessage: (request: any, callback: (error: any, response: any) => void) => void;
  GetConversationMessages: (request: any, callback: (error: any, response: any) => void) => void;
  MarkMessageAsRead: (request: any, callback: (error: any, response: any) => void) => void;
}

export class GrpcClient {
  private client: MessageServiceClient | null = null;
  private readonly host: string;
  private readonly port: string;

  constructor() {
    this.host = process.env.GRPC_HOST || 'localhost';
    this.port = process.env.GRPC_PORT || '50051';
    this.initialize();
  }

  private initialize() {
    const protoPath = path.join(__dirname, '../../../shared/proto/messaging.proto');
    
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    
    this.client = new proto.messaging.MessageTranslationService(
      `${this.host}:${this.port}`,
      grpc.credentials.createInsecure()
    );
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve(false);
        return;
      }

      // Test de connexion simple
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      try {
        this.client.GetMessage(
          { message_id: 'health-check' },
          (error: any) => {
            // On s'attend à une erreur car le message n'existe pas
            // Mais si on peut communiquer avec le service, c'est bon
            resolve(!error || error.code !== grpc.status.UNAVAILABLE);
          }
        );
      } catch (error) {
        resolve(false);
      }
    });
  }

  async createMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
    originalLanguage: string;
    messageType?: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.CreateMessage({
        conversation_id: data.conversationId,
        sender_id: data.senderId,
        content: data.content,
        original_language: data.originalLanguage,
        message_type: data.messageType || 'text'
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getMessage(messageId: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.GetMessage({
        message_id: messageId,
        user_id: userId
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async updateMessage(messageId: string, userId: string, content: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.UpdateMessage({
        message_id: messageId,
        user_id: userId,
        content: content
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async deleteMessage(messageId: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.DeleteMessage({
        message_id: messageId,
        user_id: userId
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async translateMessage(messageId: string, targetLanguage: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.TranslateMessage({
        message_id: messageId,
        target_language: targetLanguage,
        user_id: userId
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getConversationMessages(data: {
    conversationId: string;
    userId: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.GetConversationMessages({
        conversation_id: data.conversationId,
        user_id: data.userId,
        page: data.page || 1,
        limit: data.limit || 50
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      this.client.MarkMessageAsRead({
        message_id: messageId,
        user_id: userId
      }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.client) {
      // Fermeture propre du client gRPC
      this.client = null;
    }
  }
}
