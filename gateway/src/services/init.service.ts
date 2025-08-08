import { PrismaClient } from '../../libs/prisma/client';

const prisma = new PrismaClient();

interface User {
  id: string;
  username: string;
}

interface ConversationMember {
  userId: string;
}

/**
 * Service d'initialisation de la Gateway
 * - Crée la conversation globale "Meeshy" avec l'ID "any"
 * - Auto-ajoute tous les utilisateurs existants à cette conversation
 * - Gère l'auto-ajout des nouveaux utilisateurs
 */
export class InitService {
  
  /**
   * Initialise la conversation globale "Meeshy"
   */
  static async initializeGlobalConversation(): Promise<void> {
    try {
      console.log('🚀 Initialisation de la conversation globale "Meeshy"...');

      // Vérifier si la conversation globale existe déjà
      const existingGlobalConversation = await prisma.conversation.findUnique({
        where: { id: 'any' }
      });

      let globalConversation;

      if (!existingGlobalConversation) {
        // Créer la conversation globale
        globalConversation = await prisma.conversation.create({
          data: {
            id: 'any',
            type: 'global',
            title: 'Meeshy',
            description: 'Conversation globale accessible à tous les utilisateurs de Meeshy',
            isActive: true,
            isArchived: false
          }
        });

        console.log('✅ Conversation globale "Meeshy" créée avec succès');
      } else {
        globalConversation = existingGlobalConversation;
        console.log('ℹ️  Conversation globale "Meeshy" déjà existante');
      }

      // Auto-ajouter tous les utilisateurs existants à la conversation globale
      await this.addAllUsersToGlobalConversation();

    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la conversation globale:', error);
      throw error;
    }
  }

  /**
   * Ajoute tous les utilisateurs existants à la conversation globale
   */
  static async addAllUsersToGlobalConversation(): Promise<void> {
    try {
      // Récupérer tous les utilisateurs actifs
      const users = await prisma.user.findMany({
        where: { 
          isActive: true 
        },
        select: { id: true, username: true }
      });

      if (users.length === 0) {
        console.log('ℹ️  Aucun utilisateur à ajouter à la conversation globale');
        return;
      }

      // Récupérer les utilisateurs déjà membres de la conversation globale
      const existingMembers = await prisma.conversationMember.findMany({
        where: {
          conversationId: 'any'
        },
        select: { userId: true }
      });

      const existingMemberIds = new Set(existingMembers.map((m: ConversationMember) => m.userId));

      // Filtrer les utilisateurs qui ne sont pas encore membres
      const usersToAdd = users.filter((user: User) => !existingMemberIds.has(user.id));

      if (usersToAdd.length === 0) {
        console.log('ℹ️  Tous les utilisateurs sont déjà membres de la conversation globale');
        return;
      }

      // Ajouter les utilisateurs manquants
      await prisma.conversationMember.createMany({
        data: usersToAdd.map((user: User) => ({
          conversationId: 'any',
          userId: user.id,
          role: 'member',
          isActive: true
        }))
      });

      console.log(`✅ ${usersToAdd.length} utilisateurs ajoutés à la conversation globale "Meeshy"`);

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout des utilisateurs à la conversation globale:', error);
      throw error;
    }
  }

  /**
   * Ajoute automatiquement un nouvel utilisateur à la conversation globale
   */
  static async addUserToGlobalConversation(userId: string): Promise<void> {
    try {
      // Vérifier si l'utilisateur est déjà membre
      const existingMember = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: 'any',
            userId: userId
          }
        }
      });

      if (existingMember) {
        // Si l'utilisateur était membre mais inactif, le réactiver
        if (!existingMember.isActive) {
          await prisma.conversationMember.update({
            where: {
              conversationId_userId: {
                conversationId: 'any',
                userId: userId
              }
            },
            data: {
              isActive: true,
              leftAt: null
            }
          });
          console.log(`✅ Utilisateur ${userId} réactivé dans la conversation globale`);
        }
        return;
      }

      // Ajouter l'utilisateur à la conversation globale
      await prisma.conversationMember.create({
        data: {
          conversationId: 'any',
          userId: userId,
          role: 'member',
          isActive: true
        }
      });

      console.log(`✅ Utilisateur ${userId} ajouté automatiquement à la conversation globale "Meeshy"`);

    } catch (error) {
      console.error(`❌ Erreur lors de l'ajout de l'utilisateur ${userId} à la conversation globale:`, error);
      // Ne pas relancer l'erreur pour ne pas bloquer l'inscription/connexion
    }
  }

  /**
   * Crée un message de bienvenue dans la conversation globale si elle est vide
   */
  static async createWelcomeMessage(): Promise<void> {
    try {
      // Vérifier s'il y a déjà des messages dans la conversation globale
      const messageCount = await prisma.message.count({
        where: {
          conversationId: 'any',
          isDeleted: false
        }
      });

      if (messageCount === 0) {
        // Créer un utilisateur système pour le message de bienvenue
        let systemUser = await prisma.user.findFirst({
          where: { username: 'system' }
        });

        if (!systemUser) {
          systemUser = await prisma.user.create({
            data: {
              username: 'system',
              firstName: 'Système',
              lastName: 'Meeshy',
              email: 'system@meeshy.io',
              password: 'system_account_no_login',
              displayName: 'Système Meeshy',
              role: 'ADMIN',
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: false
            }
          });
        }

        // Créer le message de bienvenue
        await prisma.message.create({
          data: {
            conversationId: 'any',
            senderId: systemUser.id,
            content: '🎉 Bienvenue dans la conversation globale Meeshy ! Ici, tous les utilisateurs peuvent communiquer ensemble. Les messages sont automatiquement traduits selon vos préférences linguistiques.',
            originalLanguage: 'fr',
            messageType: 'system'
          }
        });

        console.log('✅ Message de bienvenue créé dans la conversation globale');
      }

    } catch (error) {
      console.error('❌ Erreur lors de la création du message de bienvenue:', error);
      // Ne pas relancer l'erreur
    }
  }

  /**
   * Initialise tous les composants nécessaires
   */
  static async initialize(): Promise<void> {
    try {
      console.log('🚀 Démarrage de l\'initialisation de la Gateway...');
      
      await this.initializeGlobalConversation();
      await this.createWelcomeMessage();
      
      console.log('✅ Initialisation de la Gateway terminée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la Gateway:', error);
      throw error;
    }
  }
}
