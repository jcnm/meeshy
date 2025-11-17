/**
 * Service de gestion des préférences de chiffrement MLS
 * Gère les préférences utilisateur et le statut de chiffrement des conversations
 */

import { PrismaClient } from '@meeshy/shared/client';
import type {
  EncryptionMode,
  UpdateEncryptionPreferencesRequest,
  UpdateEncryptionPreferencesResponse,
  ConversationEncryptionStatusResponse,
} from '../../shared/types/mls';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  statusCode?: number;
}

export class EncryptionPreferencesService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Met à jour les préférences de chiffrement d'un utilisateur
   * Validation stricte avec contrôles d'erreur détaillés
   */
  async updateUserEncryptionPreferences(
    request: UpdateEncryptionPreferencesRequest
  ): Promise<ServiceResult<UpdateEncryptionPreferencesResponse>> {
    try {
      // 1. Validation des paramètres
      const validationErrors = this.validateUpdatePreferencesRequest(request);
      if (validationErrors.length > 0) {
        return {
          success: false,
          errors: validationErrors,
          statusCode: 400,
        };
      }

      // 2. Vérifier que l'utilisateur existe
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé',
          statusCode: 404,
        };
      }

      // 3. Préparer les données de mise à jour
      const updateData: {
        allowServerSideTranslationAt?: Date | null;
        defaultEncryptionMode?: EncryptionMode;
      } = {};

      // Gestion de allowServerSideTranslation (Boolean -> DateTime?)
      if (request.allowServerSideTranslation !== undefined) {
        updateData.allowServerSideTranslationAt = request.allowServerSideTranslation
          ? new Date() // Activer avec timestamp
          : null; // Désactiver
      }

      // Gestion de defaultEncryptionMode
      if (request.defaultEncryptionMode !== undefined) {
        updateData.defaultEncryptionMode = request.defaultEncryptionMode;
      }

      // 4. Mettre à jour l'utilisateur
      const updatedUser = await this.prisma.user.update({
        where: { id: request.userId },
        data: updateData,
        select: {
          id: true,
          allowServerSideTranslationAt: true,
          defaultEncryptionMode: true,
          updatedAt: true,
        },
      });

      // 5. Construire la réponse
      const response: UpdateEncryptionPreferencesResponse = {
        userId: updatedUser.id,
        allowServerSideTranslationAt: updatedUser.allowServerSideTranslationAt,
        defaultEncryptionMode: updatedUser.defaultEncryptionMode as EncryptionMode,
        updatedAt: updatedUser.updatedAt,
      };

      console.log(`[EncryptionPreferencesService] ✅ Préférences mises à jour pour utilisateur ${request.userId}:`, {
        allowServerSideTranslation: !!updatedUser.allowServerSideTranslationAt,
        defaultEncryptionMode: updatedUser.defaultEncryptionMode,
      });

      return {
        success: true,
        data: response,
        statusCode: 200,
      };
    } catch (error) {
      console.error('[EncryptionPreferencesService] ❌ Erreur mise à jour préférences:', error);
      return {
        success: false,
        error: 'Erreur interne lors de la mise à jour des préférences de chiffrement',
        statusCode: 500,
      };
    }
  }

  /**
   * Récupère le statut de chiffrement d'une conversation
   * Inclut le mode, les clés, et les métadonnées de sécurité
   */
  async getConversationEncryptionStatus(
    conversationId: string,
    requestingUserId: string
  ): Promise<ServiceResult<ConversationEncryptionStatusResponse>> {
    try {
      // 1. Validation des paramètres
      if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
        return {
          success: false,
          error: 'ID de conversation invalide',
          statusCode: 400,
        };
      }

      if (!requestingUserId || !requestingUserId.match(/^[0-9a-fA-F]{24}$/)) {
        return {
          success: false,
          error: 'ID utilisateur invalide',
          statusCode: 400,
        };
      }

      // 2. Récupérer la conversation avec les informations de chiffrement
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          encryptionMode: true,
          serverEncryptionKey: true,
          serverKeyCreatedAt: true,
          serverKeyExpiresAt: true,
          members: {
            where: { isActive: true },
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  allowServerSideTranslationAt: true,
                  defaultEncryptionMode: true,
                },
              },
            },
          },
          mlsGroupState: {
            select: {
              groupId: true,
              epoch: true,
              cipherSuite: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!conversation) {
        return {
          success: false,
          error: 'Conversation non trouvée',
          statusCode: 404,
        };
      }

      // 3. Vérifier que l'utilisateur est membre de la conversation
      const isMember = conversation.members.some((m) => m.userId === requestingUserId);
      if (!isMember) {
        return {
          success: false,
          error: 'Vous n\'êtes pas membre de cette conversation',
          statusCode: 403,
        };
      }

      // 4. Calculer les métadonnées de sécurité
      const membersAllowingServerTranslation = conversation.members.filter(
        (m) => m.user.allowServerSideTranslationAt !== null
      ).length;

      const totalMembers = conversation.members.length;

      const allMembersAllowServerTranslation =
        totalMembers > 0 && membersAllowingServerTranslation === totalMembers;

      // 5. Vérifier si la clé serveur expire bientôt (moins de 7 jours)
      const serverKeyNeedsRotation =
        conversation.serverKeyExpiresAt &&
        conversation.serverKeyExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

      // 6. Construire la réponse
      const response: ConversationEncryptionStatusResponse = {
        conversationId: conversation.id,
        encryptionMode: (conversation.encryptionMode as EncryptionMode) || 'none',
        isEncrypted: conversation.encryptionMode !== 'none',
        hasServerKey: !!conversation.serverEncryptionKey,
        serverKeyCreatedAt: conversation.serverKeyCreatedAt || undefined,
        serverKeyExpiresAt: conversation.serverKeyExpiresAt || undefined,
        serverKeyNeedsRotation: serverKeyNeedsRotation || false,
        mlsGroupId: conversation.mlsGroupState?.groupId,
        mlsEpoch: conversation.mlsGroupState?.epoch,
        mlsCipherSuite: conversation.mlsGroupState?.cipherSuite,
        mlsLastUpdated: conversation.mlsGroupState?.updatedAt,
        membersAllowingServerTranslation,
        totalMembers,
        allMembersAllowServerTranslation,
      };

      console.log(`[EncryptionPreferencesService] ✅ Statut chiffrement récupéré pour conversation ${conversationId}`);

      return {
        success: true,
        data: response,
        statusCode: 200,
      };
    } catch (error) {
      console.error('[EncryptionPreferencesService] ❌ Erreur récupération statut:', error);
      return {
        success: false,
        error: 'Erreur interne lors de la récupération du statut de chiffrement',
        statusCode: 500,
      };
    }
  }

  /**
   * Valide une requête de mise à jour des préférences
   */
  private validateUpdatePreferencesRequest(
    request: UpdateEncryptionPreferencesRequest
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validation userId
    if (!request.userId) {
      errors.push({
        field: 'userId',
        message: 'ID utilisateur requis',
        code: 'USER_ID_REQUIRED',
      });
    } else if (!request.userId.match(/^[0-9a-fA-F]{24}$/)) {
      errors.push({
        field: 'userId',
        message: 'Format d\'ID utilisateur invalide (ObjectId MongoDB attendu)',
        code: 'USER_ID_INVALID_FORMAT',
      });
    }

    // Validation defaultEncryptionMode
    if (request.defaultEncryptionMode !== undefined) {
      const validModes: EncryptionMode[] = ['none', 'hybrid', 'e2e_only'];
      if (!validModes.includes(request.defaultEncryptionMode)) {
        errors.push({
          field: 'defaultEncryptionMode',
          message: `Mode de chiffrement invalide. Valeurs autorisées: ${validModes.join(', ')}`,
          code: 'ENCRYPTION_MODE_INVALID',
        });
      }
    }

    // Validation allowServerSideTranslation
    if (
      request.allowServerSideTranslation !== undefined &&
      typeof request.allowServerSideTranslation !== 'boolean'
    ) {
      errors.push({
        field: 'allowServerSideTranslation',
        message: 'La valeur doit être un booléen (true/false)',
        code: 'ALLOW_SERVER_TRANSLATION_INVALID_TYPE',
      });
    }

    // Au moins un champ doit être fourni
    if (
      request.allowServerSideTranslation === undefined &&
      request.defaultEncryptionMode === undefined
    ) {
      errors.push({
        field: 'request',
        message: 'Au moins un champ (allowServerSideTranslation ou defaultEncryptionMode) doit être fourni',
        code: 'NO_FIELDS_PROVIDED',
      });
    }

    return errors;
  }
}
