import { PrismaClient } from '../../../shared/prisma/client';
import {
  UserAuditAction,
  UserAuditLog,
  AuditChange,
  AuditMetadata
} from '../../../shared/types';

export interface CreateAuditLogParams {
  userId: string;
  adminId: string;
  action: UserAuditAction;
  entityId: string;
  changes?: Record<string, AuditChange> | null;
  metadata?: AuditMetadata | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class UserAuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Crée un log d'audit
   */
  async createAuditLog(params: CreateAuditLogParams): Promise<UserAuditLog> {
    // Note: This assumes an AdminAuditLog table exists in Prisma
    // If not, you'll need to add it to your schema.prisma

    // For now, we'll create a simpler version that logs to console
    // In production, this should write to a database table

    const auditLog: UserAuditLog = {
      id: this.generateId(),
      userId: params.userId,
      adminId: params.adminId,
      action: params.action,
      entity: 'User',
      entityId: params.entityId,
      changes: params.changes || null,
      metadata: params.metadata || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      createdAt: new Date()
    };

    // TODO: Replace with actual database insert when AdminAuditLog table exists
    // const result = await this.prisma.adminAuditLog.create({
    //   data: auditLog
    // });

    // For now, log to console (development only)
    console.log('[AUDIT LOG]', JSON.stringify(auditLog, null, 2));

    return auditLog;
  }

  /**
   * Récupère les logs d'audit pour un utilisateur
   */
  async getAuditLogsForUser(
    userId: string,
    limit: number = 50
  ): Promise<UserAuditLog[]> {
    // TODO: Replace with actual database query when AdminAuditLog table exists
    // const logs = await this.prisma.adminAuditLog.findMany({
    //   where: { entityId: userId, entity: 'User' },
    //   orderBy: { createdAt: 'desc' },
    //   take: limit
    // });

    // For now, return empty array
    return [];
  }

  /**
   * Récupère les logs d'audit créés par un admin
   */
  async getAuditLogsByAdmin(
    adminId: string,
    limit: number = 50
  ): Promise<UserAuditLog[]> {
    // TODO: Replace with actual database query when AdminAuditLog table exists
    // const logs = await this.prisma.adminAuditLog.findMany({
    //   where: { adminId },
    //   orderBy: { createdAt: 'desc' },
    //   take: limit
    // });

    // For now, return empty array
    return [];
  }

  /**
   * Log d'une action de visualisation d'utilisateur
   */
  async logViewUser(adminId: string, userId: string, ipAddress?: string, userAgent?: string): Promise<UserAuditLog> {
    return this.createAuditLog({
      userId,
      adminId,
      action: UserAuditAction.VIEW_USER,
      entityId: userId,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log d'une action de création d'utilisateur
   */
  async logCreateUser(
    adminId: string,
    newUserId: string,
    userData: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAuditLog> {
    const changes: Record<string, AuditChange> = {};
    Object.keys(userData).forEach(key => {
      changes[key] = {
        before: null,
        after: userData[key]
      };
    });

    return this.createAuditLog({
      userId: newUserId,
      adminId,
      action: UserAuditAction.CREATE_USER,
      entityId: newUserId,
      changes,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log d'une action de mise à jour d'utilisateur
   */
  async logUpdateUser(
    adminId: string,
    userId: string,
    changes: Record<string, AuditChange>,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAuditLog> {
    return this.createAuditLog({
      userId,
      adminId,
      action: UserAuditAction.UPDATE_PROFILE,
      entityId: userId,
      changes,
      metadata: reason ? { reason } : null,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log d'une action de changement de rôle
   */
  async logUpdateRole(
    adminId: string,
    userId: string,
    oldRole: string,
    newRole: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAuditLog> {
    return this.createAuditLog({
      userId,
      adminId,
      action: UserAuditAction.UPDATE_ROLE,
      entityId: userId,
      changes: {
        role: {
          before: oldRole,
          after: newRole
        }
      },
      metadata: reason ? { reason } : null,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log d'une action de changement de statut
   */
  async logUpdateStatus(
    adminId: string,
    userId: string,
    oldStatus: boolean,
    newStatus: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAuditLog> {
    return this.createAuditLog({
      userId,
      adminId,
      action: UserAuditAction.UPDATE_STATUS,
      entityId: userId,
      changes: {
        isActive: {
          before: oldStatus,
          after: newStatus
        }
      },
      metadata: reason ? { reason } : null,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log d'une action de réinitialisation de mot de passe
   */
  async logResetPassword(
    adminId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAuditLog> {
    return this.createAuditLog({
      userId,
      adminId,
      action: UserAuditAction.RESET_PASSWORD,
      entityId: userId,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log d'une action de suppression d'utilisateur
   */
  async logDeleteUser(
    adminId: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAuditLog> {
    return this.createAuditLog({
      userId,
      adminId,
      action: UserAuditAction.DELETE_USER,
      entityId: userId,
      metadata: reason ? { reason } : null,
      ipAddress,
      userAgent
    });
  }

  /**
   * Génère un ID unique pour un log d'audit
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
