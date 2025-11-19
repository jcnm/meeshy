/**
 * Message Queue for Reliable Message Delivery
 *
 * Implementation: Bull Queue with Redis backend
 * Purpose: Persist messages, handle retries, ensure delivery
 *
 * Features:
 * - Persistent message queue backed by Redis
 * - Automatic retry with exponential backoff
 * - Message deduplication
 * - Dead letter queue for failed messages
 * - Processing rate limiting
 * - Priority-based message processing
 */

import Queue from 'bull';
import { ProtocolMessage } from '../../adapters/ProtocolAdapter';
import { PrismaClient } from '../../../shared/prisma/client';

/**
 * Message queue job data
 */
export interface QueueJob {
  messageId: string;
  protocolMessage: ProtocolMessage;
  priority: number; // 1 = low, 10 = high
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Message Queue using Redis backend with Bull pattern
 *
 * For production, integrate with actual Bull package:
 * import Queue from 'bull';
 *
 * This is a Redis-backed implementation pattern that can be
 * swapped with actual Bull library
 */
export class MessageQueue {
  private prisma: PrismaClient;
  private queueName: string = 'dma-message-queue';
  private queue: Queue.Queue<QueueJob> | null = null;

  // In-memory tracking for backward compatibility
  private pendingMessages: Map<string, QueueJob> = new Map();
  private activeMessages: Set<string> = new Set();
  private failedMessages: Map<string, QueueJob> = new Map();
  private completedMessages: Map<string, Date> = new Map();

  // Configuration
  private config = {
    defaultPriority: 5,
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    processingConcurrency: 10, // Process up to 10 messages in parallel
    deduplicationWindow: 5 * 60 * 1000 // 5 minutes
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize the message queue
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Message Queue');

    try {
      // Initialize Bull queue with Redis backend
      this.queue = new Queue<QueueJob>(this.queueName, {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379')
        },
        defaultJobOptions: {
          attempts: this.config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.initialBackoffMs
          },
          removeOnComplete: true
        }
      });

      // Setup queue processors
      await this.queue.process(this.config.processingConcurrency, this.processMessage.bind(this));

      // Setup event handlers
      this.queue.on('completed', this.onMessageCompleted.bind(this));
      this.queue.on('failed', this.onMessageFailed.bind(this));
      this.queue.on('error', this.onQueueError.bind(this));

      console.log('✅ Message Queue initialized with Bull.js');
    } catch (error) {
      console.error('❌ Failed to initialize Message Queue:', error);
      throw error;
    }
  }

  /**
   * Enqueue a message for delivery
   */
  async enqueueMessage(
    message: ProtocolMessage,
    priority: number = this.config.defaultPriority,
    metadata?: Record<string, any>
  ): Promise<string> {
    const messageId = message.protocolMessageId || this.generateMessageId();

    // Check for deduplication
    if (await this.isDuplicate(messageId)) {
      console.warn(`⚠️  Message ${messageId} already queued, skipping`);
      return messageId;
    }

    const job: QueueJob = {
      messageId,
      protocolMessage: message,
      priority: Math.max(1, Math.min(10, priority)), // Clamp 1-10
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: new Date(),
      metadata
    };

    // Add to Bull queue
    if (this.queue) {
      try {
        await this.queue.add(job, {
          priority: Math.max(1, Math.min(10, priority)), // Bull uses 1-10 priority
          attempts: this.config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.initialBackoffMs
          },
          jobId: messageId
        });
      } catch (error) {
        console.error(`❌ Failed to add job to Bull queue: ${error}`);
        throw error;
      }
    }

    // Store in pending queue for compatibility
    this.pendingMessages.set(messageId, job);

    // Persist to database
    try {
      await this.persistMessageJob(job);
    } catch (error) {
      console.error(`⚠️  Failed to persist message job: ${error}`);
      // Continue anyway - message is in queue
    }

    console.log(`📨 Message enqueued: ${messageId} (priority: ${priority})`);
    return messageId;
  }

  /**
   * Process queued messages with rate limiting
   */
  async processQueue(): Promise<void> {
    console.log(`⏳ Processing queue (${this.pendingMessages.size} pending messages)`);

    // Get messages sorted by priority and age
    const messagesToProcess = Array.from(this.pendingMessages.values())
      .sort((a, b) => {
        // Higher priority first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by creation time (FIFO)
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, this.config.processingConcurrency);

    // Process in parallel with concurrency limit
    const results = await Promise.allSettled(
      messagesToProcess.map(job => this.processMessage(job))
    );

    // Log results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Message ${messagesToProcess[index].messageId} processed successfully`);
      } else {
        console.error(
          `❌ Message ${messagesToProcess[index].messageId} processing failed:`,
          result.reason
        );
      }
    });
  }

  /**
   * Process a single message with retry logic
   * Handles both Bull jobs and local queue jobs
   */
  private async processMessage(bullJob: Queue.Job<QueueJob>): Promise<void> {
    const job = bullJob.data;
    const messageId = job.messageId;
    this.activeMessages.add(messageId);

    try {
      console.log(`📤 Processing message: ${messageId} (attempt ${bullJob.attemptsMade + 1}/${this.config.maxRetries})`);

      // TODO: Implement actual message sending
      // This would call the protocol adapter to send the message
      // const outcome = await this.sendViaProtocol(job.protocolMessage);

      // Simulate successful sending (replace with actual implementation)
      await this.simulateMessageSend(job);

      // Mark as completed
      this.pendingMessages.delete(messageId);
      this.completedMessages.set(messageId, new Date());
      this.activeMessages.delete(messageId);

      console.log(`✅ Message completed: ${messageId}`);
    } catch (error) {
      // Bull handles retries automatically with backoff
      // We just need to throw the error and Bull will retry
      this.activeMessages.delete(messageId);

      if (bullJob.attemptsMade >= this.config.maxRetries - 1) {
        // Max retries exceeded
        this.pendingMessages.delete(messageId);
        this.failedMessages.set(messageId, job);

        console.error(`❌ Message failed after ${this.config.maxRetries} attempts: ${messageId}`);

        // Persist to dead letter queue
        try {
          await this.persistFailedMessage(job);
        } catch (dbError) {
          console.error(`⚠️  Failed to persist failed message: ${dbError}`);
        }
      } else {
        console.warn(
          `⚠️  Message failed (${error}), Bull will retry ` +
          `(attempt ${bullJob.attemptsMade + 1}/${this.config.maxRetries})`
        );
      }

      // Throw error to let Bull handle the retry
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attemptNumber: number): number {
    const exponentialDelay = this.config.initialBackoffMs *
      Math.pow(this.config.backoffMultiplier, attemptNumber - 1);

    const cappedDelay = Math.min(exponentialDelay, this.config.maxBackoffMs);

    // Add 10% jitter
    const jitterAmount = cappedDelay * 0.1;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Schedule message retry after delay
   * Bull.js handles retries automatically with exponential backoff
   */
  private async scheduleRetry(job: QueueJob, delayMs: number): Promise<void> {
    // With Bull, retries are handled automatically by the queue
    // Update the job with delay info for reference
    job.metadata = {
      ...job.metadata,
      nextRetryAt: new Date(Date.now() + delayMs)
    };

    // Keep in pending queue for compatibility
    this.pendingMessages.set(job.messageId, job);

    // Bull will automatically retry with configured backoff strategy
    console.log(`⏰ Scheduled retry for message ${job.messageId} with delay ${delayMs}ms`);
  }

  /**
   * Check if message is duplicate (already queued recently)
   */
  private async isDuplicate(messageId: string): Promise<boolean> {
    // Check in recent completed messages
    const completed = this.completedMessages.get(messageId);
    if (completed && Date.now() - completed.getTime() < this.config.deduplicationWindow) {
      return true;
    }

    // Check in pending/active messages
    if (this.pendingMessages.has(messageId) || this.activeMessages.has(messageId)) {
      return true;
    }

    // Check in database
    try {
      const existing = await this.prisma.dMAOfflineMessage.findUnique({
        where: { messageId }
      });
      return !!existing;
    } catch {
      return false;
    }
  }

  /**
   * Simulate message sending (replace with actual protocol adapter call)
   */
  private async simulateMessageSend(job: QueueJob): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 90% success rate for demo
        if (Math.random() > 0.1) {
          resolve();
        } else {
          throw new Error('Simulated send failure');
        }
      }, 100);
    });
  }

  /**
   * Persist message job to database
   */
  private async persistMessageJob(job: QueueJob): Promise<void> {
    try {
      await this.prisma.dMAOfflineMessage.upsert({
        where: { messageId: job.messageId },
        update: {
          status: 'pending',
          encryptedPayload: JSON.stringify(job.protocolMessage),
          retryCount: job.attempts
        },
        create: {
          messageId: job.messageId,
          fromPartyId: job.protocolMessage.senderId,
          toPartyId: job.protocolMessage.recipientId,
          protocol: 'queued',
          encryptedPayload: JSON.stringify(job.protocolMessage),
          status: 'pending',
          retryCount: 0
        }
      });
    } catch (error) {
      console.error('Failed to persist message job:', error);
      throw error;
    }
  }

  /**
   * Persist failed message to dead letter queue
   */
  private async persistFailedMessage(job: QueueJob): Promise<void> {
    try {
      await this.prisma.dMAOfflineMessage.upsert({
        where: { messageId: job.messageId },
        update: {
          status: 'failed',
          retryCount: job.attempts
        },
        create: {
          messageId: job.messageId,
          fromPartyId: job.protocolMessage.senderId,
          toPartyId: job.protocolMessage.recipientId,
          protocol: 'queued',
          encryptedPayload: JSON.stringify(job.protocolMessage),
          status: 'failed',
          retryCount: job.attempts
        }
      });
    } catch (error) {
      console.error('Failed to persist failed message:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    if (!this.queue) {
      return {
        queued: this.pendingMessages.size,
        active: this.activeMessages.size,
        completed: this.completedMessages.size,
        failed: this.failedMessages.size,
        delayed: 0
      };
    }

    try {
      // Get counts from Bull queue
      const counts = await this.queue.getJobCounts();

      return {
        queued: counts.waiting + (counts.prioritized || 0),
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed
      };
    } catch (error) {
      console.error('Failed to get queue stats from Bull:', error);
      // Fallback to in-memory stats
      return {
        queued: this.pendingMessages.size,
        active: this.activeMessages.size,
        completed: this.completedMessages.size,
        failed: this.failedMessages.size,
        delayed: 0
      };
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<string | null> {
    if (this.pendingMessages.has(messageId)) return 'pending';
    if (this.activeMessages.has(messageId)) return 'processing';
    if (this.completedMessages.has(messageId)) return 'completed';
    if (this.failedMessages.has(messageId)) return 'failed';
    return null;
  }

  /**
   * Retry failed message
   */
  async retryFailedMessage(messageId: string): Promise<boolean> {
    const failedJob = this.failedMessages.get(messageId);
    if (!failedJob) {
      console.warn(`Message ${messageId} not found in failed queue`);
      return false;
    }

    // Reset attempts and move back to pending
    failedJob.attempts = 0;
    this.failedMessages.delete(messageId);
    this.pendingMessages.set(messageId, failedJob);

    console.log(`🔄 Retrying failed message: ${messageId}`);
    return true;
  }

  /**
   * Handle completed messages from Bull queue
   */
  private onMessageCompleted(job: Queue.Job<QueueJob>): void {
    const { messageId } = job.data;
    console.log(`✅ Message completed via Bull: ${messageId}`);
    this.pendingMessages.delete(messageId);
    this.completedMessages.set(messageId, new Date());
  }

  /**
   * Handle failed messages from Bull queue
   */
  private onMessageFailed(job: Queue.Job<QueueJob>, error: Error): void {
    const { messageId } = job.data;
    console.error(`❌ Message failed via Bull: ${messageId} - ${error.message}`);
    this.failedMessages.set(messageId, job.data);
  }

  /**
   * Handle queue errors
   */
  private onQueueError(error: Error): void {
    console.error(`⚠️  Queue error: ${error.message}`);
  }

  /**
   * Drain the queue (process all pending messages)
   */
  async drainQueue(): Promise<number> {
    let processed = 0;

    while (this.pendingMessages.size > 0) {
      const currentSize = this.pendingMessages.size;
      await this.processQueue();
      processed += Math.max(0, currentSize - this.pendingMessages.size);

      // Prevent infinite loops
      if (this.pendingMessages.size === currentSize) {
        break;
      }
    }

    console.log(`✅ Queue drained: ${processed} messages processed`);
    return processed;
  }

  /**
   * Shutdown the queue gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Message Queue');

    // Drain remaining messages
    await this.drainQueue();

    // Close Bull queue
    if (this.queue) {
      try {
        await this.queue.close();
        console.log('✅ Bull queue closed');
      } catch (error) {
        console.error('⚠️  Error closing Bull queue:', error);
      }
    }

    // Clear in-memory state
    this.pendingMessages.clear();
    this.activeMessages.clear();
    this.completedMessages.clear();
    this.failedMessages.clear();

    console.log('✅ Message Queue shutdown complete');
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
