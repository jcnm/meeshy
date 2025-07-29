/**
 * Service de traduction pour Fastify
 * Gère les traductions de messages avec cache et détection de langue
 */

import { PrismaClient } from '../../../shared/node_modules/.prisma/client';
import { GrpcClient } from '../grpc/client';

export interface TranslationRequest {
  messageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  content: string;
  userId?: string;
}

export interface TranslationResponse {
  messageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedContent: string;
  translationModel: string;
  cacheKey: string;
  cached: boolean;
}

export interface UserLanguageConfig {
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
}

export class TranslationService {
  constructor(
    private prisma: PrismaClient,
    private grpcClient: GrpcClient
  ) {}

  /**
   * Génère une clé de cache unique pour une traduction
   */
  private generateCacheKey(messageId: string, sourceLanguage: string, targetLanguage: string): string {
    return `${messageId}_${sourceLanguage}_${targetLanguage}`;
  }

  /**
   * Récupère ou crée une traduction pour un message
   */
  async translateMessage(request: TranslationRequest): Promise<TranslationResponse> {
    const cacheKey = this.generateCacheKey(request.messageId, request.sourceLanguage, request.targetLanguage);

    // Vérifier si la traduction existe déjà en cache
    const existingTranslation = await this.prisma.messageTranslation.findUnique({
      where: { cacheKey }
    });

    if (existingTranslation) {
      return {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedContent: existingTranslation.translatedContent,
        translationModel: existingTranslation.translationModel,
        cacheKey: existingTranslation.cacheKey,
        cached: true
      };
    }

    // Appeler le service gRPC pour la traduction (temporairement désactivé)
    // const translationResult = await this.grpcClient.translateText({
    //   text: request.content,
    //   sourceLanguage: request.sourceLanguage,
    //   targetLanguage: request.targetLanguage
    // });

    // Version temporaire - à remplacer par le vrai service
    const translationResult = {
      translatedText: `[TRANSLATED-${request.targetLanguage}] ${request.content}`,
      detectedLanguage: request.sourceLanguage,
      confidence: 0.95,
      model: 'test-model'
    };

    // Sauvegarder la traduction en cache
    const newTranslation = await this.prisma.messageTranslation.create({
      data: {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedContent: translationResult.translatedText,
        translationModel: translationResult.model,
        cacheKey
      }
    });

    return {
      messageId: request.messageId,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      translatedContent: newTranslation.translatedContent,
      translationModel: newTranslation.translationModel,
      cacheKey: newTranslation.cacheKey,
      cached: false
    };
  }

  /**
   * Récupère les langues cibles pour un utilisateur selon sa configuration
   */
  async getUserTargetLanguages(userId: string, sourceLanguage: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        systemLanguage: true,
        regionalLanguage: true,
        customDestinationLanguage: true,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: true,
        useCustomDestination: true
      }
    });

    if (!user || !user.autoTranslateEnabled) {
      return [];
    }

    const targetLanguages: string[] = [];

    // Ajouter la langue système si activée et différente de la source
    if (user.translateToSystemLanguage && user.systemLanguage !== sourceLanguage) {
      targetLanguages.push(user.systemLanguage);
    }

    // Ajouter la langue régionale si activée et différente de la source et du système
    if (user.translateToRegionalLanguage && 
        user.regionalLanguage !== sourceLanguage && 
        !targetLanguages.includes(user.regionalLanguage)) {
      targetLanguages.push(user.regionalLanguage);
    }

    // Ajouter la langue personnalisée si activée
    if (user.useCustomDestination && 
        user.customDestinationLanguage &&
        user.customDestinationLanguage !== sourceLanguage &&
        !targetLanguages.includes(user.customDestinationLanguage)) {
      targetLanguages.push(user.customDestinationLanguage);
    }

    return targetLanguages;
  }

  /**
   * Traduit un message pour tous les participants d'une conversation
   */
  async translateMessageForConversation(messageId: string, conversationId: string): Promise<TranslationResponse[]> {
    // Récupérer le message
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    systemLanguage: true,
                    regionalLanguage: true,
                    customDestinationLanguage: true,
                    autoTranslateEnabled: true,
                    translateToSystemLanguage: true,
                    translateToRegionalLanguage: true,
                    useCustomDestination: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const sourceLanguage = message.originalLanguage;
    const allTranslations: TranslationResponse[] = [];

    // Pour chaque membre de la conversation
    for (const member of message.conversation.members) {
      const targetLanguages = await this.getUserTargetLanguages(member.userId, sourceLanguage);

      // Traduire vers chaque langue cible
      for (const targetLanguage of targetLanguages) {
        try {
          const translation = await this.translateMessage({
            messageId: messageId,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: message.content,
            userId: member.userId
          });
          allTranslations.push(translation);
        } catch (error) {
          console.error(`Error translating message ${messageId} to ${targetLanguage} for user ${member.userId}:`, error);
        }
      }
    }

    return allTranslations;
  }

  /**
   * Récupère un message avec ses traductions pour un utilisateur spécifique
   */
  async getMessageWithTranslationsForUser(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        translations: true
      }
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Récupérer les langues cibles pour cet utilisateur
    const targetLanguages = await this.getUserTargetLanguages(userId, message.originalLanguage);

    // Filtrer les traductions pertinentes pour cet utilisateur
    const userTranslations = message.translations.filter((translation: any) => 
      targetLanguages.includes(translation.targetLanguage)
    );

    return {
      ...message,
      translations: userTranslations,
      availableLanguages: targetLanguages
    };
  }

  /**
   * Récupère toutes les traductions d'un message
   */
  async getMessageTranslations(messageId: string): Promise<TranslationResponse[]> {
    const translations = await this.prisma.messageTranslation.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' }
    });

    return translations.map((translation: any) => ({
      messageId: translation.messageId,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      translatedContent: translation.translatedContent,
      translationModel: translation.translationModel,
      cacheKey: translation.cacheKey,
      cached: true
    }));
  }

  /**
   * Supprime les traductions d'un message
   */
  async deleteMessageTranslations(messageId: string): Promise<void> {
    await this.prisma.messageTranslation.deleteMany({
      where: { messageId }
    });
  }

  /**
   * Met à jour une traduction spécifique
   */
  async updateTranslation(cacheKey: string, translatedContent: string): Promise<TranslationResponse | null> {
    const translation = await this.prisma.messageTranslation.update({
      where: { cacheKey },
      data: { translatedContent }
    });

    if (!translation) {
      return null;
    }

    return {
      messageId: translation.messageId,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      translatedContent: translation.translatedContent,
      translationModel: translation.translationModel,
      cacheKey: translation.cacheKey,
      cached: true
    };
  }

  /**
   * Détecte la langue d'un texte
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      // const result = await this.grpcClient.detectLanguage({ text });
      // Version temporaire
      const result = {
        detectedLanguage: 'fr',
        confidence: 0.9
      };
      return result.detectedLanguage;
    } catch (error) {
      console.error('Error detecting language:', error);
      return 'fr'; // Langue par défaut
    }
  }

  /**
   * Nettoie le cache des traductions anciennes
   */
  async cleanupOldTranslations(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.messageTranslation.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }

  /**
   * Obtient des statistiques sur les traductions
   */
  async getTranslationStats() {
    const [totalTranslations, uniqueLanguagePairs, modelStats] = await Promise.all([
      this.prisma.messageTranslation.count(),
      this.prisma.messageTranslation.groupBy({
        by: ['sourceLanguage', 'targetLanguage'],
        _count: true
      }),
      this.prisma.messageTranslation.groupBy({
        by: ['translationModel'],
        _count: true
      })
    ]);

    return {
      totalTranslations,
      uniqueLanguagePairs: uniqueLanguagePairs.length,
      languagePairs: uniqueLanguagePairs,
      modelUsage: modelStats
    };
  }
}
