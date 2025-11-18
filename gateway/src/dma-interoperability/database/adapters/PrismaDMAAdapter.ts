/**
 * Prisma DMA Adapter
 *
 * Provides database operations for all DMA components
 * Uses Prisma ORM with MongoDB
 */

import { IDMADatabaseAdapter } from '../../adapters/LibraryAdapters';
import { PrismaClient } from '../../../../shared/prisma/client';

export class PrismaDMAAdapter implements IDMADatabaseAdapter {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // ============================================================================
  // ENROLLMENT OPERATIONS
  // ============================================================================

  async createEnrollment(data: {
    userId: string;
    whatsappInternalId: string;
    whatsappLogin: string;
    keyMaterial: Record<string, any>;
  }): Promise<any> {
    try {
      const enrollment = await (this.prisma as any).dMAEnrollment.create({
        data: {
          userId: data.userId,
          whatsappInternalId: data.whatsappInternalId,
          whatsappLogin: data.whatsappLogin,
          authKeyPublic: data.keyMaterial.authKeyPublic || '',
          signalIdentityKeyPublic: data.keyMaterial.signalIdentityKeyPublic || '',
          signalIdentityKeyPrivateEncrypted: data.keyMaterial.signalIdentityKeyPrivateEncrypted || '',
          preKeyId: data.keyMaterial.preKeyId || 0,
          preKeyValuePublic: data.keyMaterial.preKeyValuePublic || '',
          signedPreKeyId: data.keyMaterial.signedPreKeyId || 0,
          signedPreKeyValue: data.keyMaterial.signedPreKeyValue || '',
          signedPreKeySignature: data.keyMaterial.signedPreKeySignature || '',
          registrationId: data.keyMaterial.registrationId || 0,
          status: 'active'
        }
      });

      console.log(`✅ Enrollment created: ${enrollment.id}`);
      return enrollment;
    } catch (error) {
      console.error('Failed to create enrollment:', error);
      throw error;
    }
  }

  async getEnrollment(enrollmentId: string): Promise<any> {
    try {
      const enrollment = await (this.prisma as any).dMAEnrollment.findUnique({
        where: { id: enrollmentId }
      });

      return enrollment;
    } catch (error) {
      console.error('Failed to get enrollment:', error);
      throw error;
    }
  }

  async updateEnrollmentStatus(enrollmentId: string, status: string): Promise<void> {
    try {
      await (this.prisma as any).dMAEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Enrollment status updated: ${status}`);
    } catch (error) {
      console.error('Failed to update enrollment status:', error);
      throw error;
    }
  }

  // ============================================================================
  // OFFLINE MESSAGE OPERATIONS
  // ============================================================================

  async queueOfflineMessage(data: {
    enrollmentId: string;
    messageId: string;
    senderJID: string;
    encryptedContent: string;
  }): Promise<string> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day retention

      const offlineMessage = await (this.prisma as any).dMAOfflineMessage.create({
        data: {
          enrollmentId: data.enrollmentId,
          messageId: data.messageId,
          deliveryId: `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          senderJID: data.senderJID,
          encryptedContent: data.encryptedContent,
          contentType: 'signal_v3',
          storedAt: new Date(),
          expiresAt
        }
      });

      console.log(`✅ Offline message queued: ${offlineMessage.id}`);
      return offlineMessage.id;
    } catch (error) {
      console.error('Failed to queue offline message:', error);
      throw error;
    }
  }

  async getQueuedMessages(enrollmentId: string): Promise<any[]> {
    try {
      const messages = await (this.prisma as any).dMAOfflineMessage.findMany({
        where: {
          enrollmentId,
          delivered: false,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          storedAt: 'asc'
        }
      });

      console.log(`✅ Retrieved ${messages.length} queued messages`);
      return messages;
    } catch (error) {
      console.error('Failed to get queued messages:', error);
      throw error;
    }
  }

  async markMessageDelivered(messageId: string): Promise<void> {
    try {
      await (this.prisma as any).dMAOfflineMessage.update({
        where: { messageId },
        data: {
          delivered: true,
          deliveredAt: new Date()
        }
      });

      console.log(`✅ Message marked as delivered: ${messageId}`);
    } catch (error) {
      console.error('Failed to mark message as delivered:', error);
      throw error;
    }
  }

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  async createSession(data: {
    enrollmentId: string;
    remotePartyId: string;
    sessionType: string;
    sessionState: string;
  }): Promise<any> {
    try {
      const session = await (this.prisma as any).dMASession.create({
        data: {
          enrollmentId: data.enrollmentId,
          remotePartyId: data.remotePartyId,
          sessionType: data.sessionType,
          sessionState: data.sessionState,
          createdAt: new Date()
        }
      });

      console.log(`✅ Session created: ${session.id}`);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  async updateSessionState(sessionId: string, newState: string): Promise<void> {
    try {
      await (this.prisma as any).dMASession.update({
        where: { id: sessionId },
        data: {
          sessionState: newState,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Session state updated: ${newState}`);
    } catch (error) {
      console.error('Failed to update session state:', error);
      throw error;
    }
  }

  // ============================================================================
  // MESSAGE STATUS OPERATIONS
  // ============================================================================

  async trackMessageStatus(data: {
    enrollmentId: string;
    messageId: string;
    status: string;
    recipientJID: string;
  }): Promise<void> {
    try {
      await (this.prisma as any).dMAMessageStatus.create({
        data: {
          enrollmentId: data.enrollmentId,
          messageId: data.messageId,
          status: data.status,
          recipientJID: data.recipientJID,
          createdAt: new Date()
        }
      });

      console.log(`✅ Message status tracked: ${data.status}`);
    } catch (error) {
      console.error('Failed to track message status:', error);
      throw error;
    }
  }

  async updateMessageStatus(messageId: string, newStatus: string): Promise<void> {
    try {
      await (this.prisma as any).dMAMessageStatus.update({
        where: { messageId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === 'delivered' && { deliveredAt: new Date() }),
          ...(newStatus === 'read' && { readAt: new Date() }),
          ...(newStatus === 'failed' && { failedAt: new Date() })
        }
      });

      console.log(`✅ Message status updated: ${newStatus}`);
    } catch (error) {
      console.error('Failed to update message status:', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Cleanup expired offline messages (30-day retention)
   */
  async cleanupExpiredMessages(): Promise<number> {
    try {
      const result = await (this.prisma as any).dMAOfflineMessage.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      console.log(`✅ Cleaned up ${result.count} expired messages`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired messages:', error);
      throw error;
    }
  }

  /**
   * Get enrollment by WhatsApp internal ID
   */
  async getEnrollmentByWhatsAppId(whatsappInternalId: string): Promise<any> {
    try {
      const enrollment = await (this.prisma as any).dMAEnrollment.findUnique({
        where: { whatsappInternalId }
      });

      return enrollment;
    } catch (error) {
      console.error('Failed to get enrollment by WhatsApp ID:', error);
      throw error;
    }
  }

  /**
   * Get user enrollments
   */
  async getUserEnrollments(userId: string): Promise<any[]> {
    try {
      const enrollments = await (this.prisma as any).dMAEnrollment.findMany({
        where: { userId }
      });

      return enrollments;
    } catch (error) {
      console.error('Failed to get user enrollments:', error);
      throw error;
    }
  }

  /**
   * Disconnect Prisma client
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
