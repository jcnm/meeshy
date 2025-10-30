/**
 * CallCleanupService - Automatic cleanup of zombie calls
 *
 * Handles:
 * - Closing calls that have been active for more than 5 hours
 * - Running cleanup job periodically (every 30 minutes)
 * - Logging cleanup statistics
 */

import { PrismaClient, CallStatus } from '../../shared/prisma/client';
import { logger } from '../utils/logger';

export class CallCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CALL_DURATION_HOURS = 5;
  private readonly MAX_CALL_DURATION_MS = this.MAX_CALL_DURATION_HOURS * 60 * 60 * 1000;

  constructor(private prisma: PrismaClient) {}

  /**
   * Start the automatic cleanup job
   */
  start(): void {
    if (this.cleanupInterval) {
      logger.warn('[CallCleanupService] Cleanup job already running');
      return;
    }

    logger.info('[CallCleanupService] Starting automatic call cleanup job', {
      intervalMinutes: this.CLEANUP_INTERVAL_MS / 60000,
      maxCallDurationHours: this.MAX_CALL_DURATION_HOURS
    });

    // Run cleanup immediately on start
    this.runCleanup().catch((error) => {
      logger.error('[CallCleanupService] Initial cleanup failed', { error });
    });

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch((error) => {
        logger.error('[CallCleanupService] Scheduled cleanup failed', { error });
      });
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the automatic cleanup job
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('[CallCleanupService] Stopped automatic call cleanup job');
    }
  }

  /**
   * Run cleanup of zombie calls
   * Closes calls that have been active for more than MAX_CALL_DURATION_HOURS
   */
  async runCleanup(): Promise<{ cleaned: number; errors: number }> {
    logger.info('[CallCleanupService] Running zombie call cleanup');

    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - this.MAX_CALL_DURATION_MS);

      // Find all active or ringing calls older than cutoff time
      const zombieCalls = await this.prisma.callSession.findMany({
        where: {
          status: {
            in: [CallStatus.initiated, CallStatus.active, CallStatus.ringing]
          },
          startedAt: {
            lt: cutoffTime
          }
        },
        include: {
          participants: {
            where: {
              leftAt: null // Only active participants
            }
          }
        }
      });

      if (zombieCalls.length === 0) {
        logger.info('[CallCleanupService] No zombie calls found');
        return { cleaned: 0, errors: 0 };
      }

      logger.warn('[CallCleanupService] Found zombie calls', {
        count: zombieCalls.length,
        callIds: zombieCalls.map(c => c.id),
        oldestCallStarted: zombieCalls.reduce((oldest, call) =>
          call.startedAt < oldest ? call.startedAt : oldest,
          zombieCalls[0].startedAt
        )
      });

      let cleaned = 0;
      let errors = 0;

      // Close each zombie call
      for (const call of zombieCalls) {
        try {
          const duration = Math.floor((now.getTime() - call.startedAt.getTime()) / 1000);

          await this.prisma.$transaction(async (tx) => {
            // Mark all active participants as left
            await tx.callParticipant.updateMany({
              where: {
                callSessionId: call.id,
                leftAt: null
              },
              data: {
                leftAt: now
              }
            });

            // End the call
            await tx.callSession.update({
              where: { id: call.id },
              data: {
                status: CallStatus.ended,
                endedAt: now,
                duration
              }
            });
          });

          logger.info('[CallCleanupService] Closed zombie call', {
            callId: call.id,
            conversationId: call.conversationId,
            startedAt: call.startedAt,
            durationHours: (duration / 3600).toFixed(2),
            activeParticipants: call.participants.length
          });

          cleaned++;
        } catch (error) {
          logger.error('[CallCleanupService] Failed to close zombie call', {
            callId: call.id,
            error
          });
          errors++;
        }
      }

      logger.info('[CallCleanupService] Cleanup completed', {
        cleaned,
        errors,
        total: zombieCalls.length
      });

      return { cleaned, errors };
    } catch (error) {
      logger.error('[CallCleanupService] Cleanup failed', { error });
      throw error;
    }
  }

  /**
   * Manual cleanup - can be called via API or CLI
   */
  async manualCleanup(): Promise<{ cleaned: number; errors: number }> {
    logger.info('[CallCleanupService] Running manual cleanup');
    return this.runCleanup();
  }
}
