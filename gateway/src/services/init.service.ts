import { PrismaClient } from '../../shared/prisma/client';
import { PrismaAuthService } from './prisma-auth.service';
import { UserRoleEnum } from '../../shared/types';

export class InitService {
  private prisma: PrismaClient;
  private authService: PrismaAuthService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.authService = new PrismaAuthService(prisma, process.env.JWT_SECRET || 'default-jwt-secret');
  }

  /**
   * Initialise la base de données avec les données par défaut
   */
  async initializeDatabase(): Promise<void> {
    console.log('[INIT] 🚀 Démarrage de l\'initialisation de la base de données...');

    try {
      // 1. Créer la conversation globale "meeshy"
      await this.createGlobalConversation();

      // 2. Créer les utilisateurs par défaut
      await this.createDefaultUsers();

      console.log('[INIT] ✅ Initialisation de la base de données terminée avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de l\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Crée la conversation globale "meeshy"
   */
  private async createGlobalConversation(): Promise<void> {
    console.log('[INIT] 🔍 Vérification de la conversation globale "meeshy"...');

    try {
      const existingConversation = await this.prisma.conversation.findUnique({
        where: { id: 'meeshy' }
      });

      if (existingConversation) {
        console.log('[INIT] ✅ Conversation globale "meeshy" existe déjà');
        return;
      }

      console.log('[INIT] 🆕 Création de la conversation globale "meeshy"...');

      await this.prisma.conversation.create({
        data: {
          id: 'meeshy',
          title: 'Meeshy Global',
          description: 'Conversation globale de la communauté Meeshy',
          type: 'GLOBAL',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('[INIT] ✅ Conversation globale "meeshy" créée avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la création de la conversation globale:', error);
      throw error;
    }
  }

  /**
   * Crée les utilisateurs par défaut
   */
  private async createDefaultUsers(): Promise<void> {
    console.log('[INIT] 🔍 Vérification des utilisateurs par défaut...');

    try {
      // 1. Créer l'utilisateur Bigboss (Meeshy Sama)
      await this.createBigbossUser();

      // 2. Créer l'utilisateur Admin Manager
      await this.createAdminUser();

      console.log('[INIT] ✅ Utilisateurs par défaut vérifiés/créés avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la création des utilisateurs par défaut:', error);
      throw error;
    }
  }

  /**
   * Crée l'utilisateur Bigboss (Meeshy Sama)
   */
  private async createBigbossUser(): Promise<void> {
    const username = 'meeshy';
    const password = process.env.MEESHY_BIGBOSS_PASSWORD || 'bigboss123';

    console.log(`[INIT] 🔍 Vérification de l'utilisateur Bigboss "${username}"...`);

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { username }
      });

      if (existingUser) {
        console.log(`[INIT] ✅ Utilisateur Bigboss "${username}" existe déjà`);
        return;
      }

      console.log(`[INIT] 🆕 Création de l'utilisateur Bigboss "${username}"...`);

      // Créer l'utilisateur via l'API de création de compte
      const userData = {
        username,
        password,
        firstName: 'Meeshy',
        lastName: 'Sama',
        email: 'meeshy@meeshy.com',
        systemLanguage: 'en',
        regionalLanguage: 'fr',
        customDestinationLanguage: 'pt'
      };

      const user = await this.authService.register(userData);

      if (!user) {
        throw new Error('Échec de la création de l\'utilisateur Bigboss');
      }

      // Mettre à jour le rôle vers BIGBOSS
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRoleEnum.BIGBOSS }
      });

      // Ajouter l'utilisateur comme CREATOR de la conversation meeshy
      await this.prisma.conversationMember.create({
        data: {
          conversationId: 'meeshy',
          userId: user.id,
          role: 'CREATOR',
          joinedAt: new Date(),
          isActive: true
        }
      });

      console.log(`[INIT] ✅ Utilisateur Bigboss "${username}" créé avec succès`);
    } catch (error) {
      console.error(`[INIT] ❌ Erreur lors de la création de l'utilisateur Bigboss "${username}":`, error);
      throw error;
    }
  }

  /**
   * Crée l'utilisateur Admin Manager
   */
  private async createAdminUser(): Promise<void> {
    const username = 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    console.log(`[INIT] 🔍 Vérification de l'utilisateur Admin "${username}"...`);

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { username }
      });

      if (existingUser) {
        console.log(`[INIT] ✅ Utilisateur Admin "${username}" existe déjà`);
        
        // Mettre à jour le rôle vers ADMIN et les langues
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { 
            role: UserRoleEnum.ADMIN,
            systemLanguage: 'es',
            regionalLanguage: 'de',
            customDestinationLanguage: 'zh'
          }
        });
        
        console.log(`[INIT] ✅ Rôle et langues de l'utilisateur Admin "${username}" mis à jour`);
      } else {
        console.log(`[INIT] 🆕 Création de l'utilisateur Admin "${username}"...`);

        // Créer l'utilisateur via l'API de création de compte
        const userData = {
          username,
          password,
          firstName: 'Admin',
          lastName: 'Manager',
          email: 'admin@meeshy.com',
          systemLanguage: 'es',
          regionalLanguage: 'de',
          customDestinationLanguage: 'zh'
        };

        const user = await this.authService.register(userData);

        if (!user) {
          throw new Error('Échec de la création de l\'utilisateur Admin');
        }

        // Mettre à jour le rôle vers ADMIN
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: UserRoleEnum.ADMIN }
        });
      }

      // Vérifier si l'utilisateur admin est déjà membre de la conversation
      const existingMember = await this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: 'meeshy',
            userId: existingUser ? existingUser.id : (await this.prisma.user.findUnique({ where: { username } }))!.id
          }
        }
      });

      if (!existingMember) {
        // Ajouter l'utilisateur comme ADMIN de la conversation meeshy
        await this.prisma.conversationMember.create({
          data: {
            conversationId: 'meeshy',
            userId: existingUser ? existingUser.id : (await this.prisma.user.findUnique({ where: { username } }))!.id,
            role: 'ADMIN',
            joinedAt: new Date(),
            isActive: true
          }
        });
        
        console.log(`[INIT] ✅ Utilisateur Admin "${username}" ajouté à la conversation meeshy`);
      } else {
        console.log(`[INIT] ✅ Utilisateur Admin "${username}" est déjà membre de la conversation meeshy`);
      }

      console.log(`[INIT] ✅ Utilisateur Admin "${username}" configuré avec succès`);
    } catch (error) {
      console.error(`[INIT] ❌ Erreur lors de la configuration de l'utilisateur Admin "${username}":`, error);
      throw error;
    }
  }

  /**
   * Vérifie si l'initialisation est nécessaire
   */
  async shouldInitialize(): Promise<boolean> {
    try {
      // Vérifier si la conversation globale existe
      const globalConversation = await this.prisma.conversation.findUnique({
        where: { id: 'meeshy' }
      });

      // Vérifier si les utilisateurs par défaut existent
      const bigbossUser = await this.prisma.user.findUnique({
        where: { username: 'meeshy' }
      });

      const adminUser = await this.prisma.user.findUnique({
        where: { username: 'admin' }
      });

      // Vérifier si les utilisateurs sont membres de la conversation
      let bigbossMember = null;
      let adminMember = null;

      if (globalConversation && bigbossUser) {
        bigbossMember = await this.prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: 'meeshy',
              userId: bigbossUser.id
            }
          }
        });
      }

      if (globalConversation && adminUser) {
        adminMember = await this.prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: 'meeshy',
              userId: adminUser.id
            }
          }
        });
      }

      // Si la conversation globale, les utilisateurs ou leurs appartenances n'existent pas, initialisation nécessaire
      return !globalConversation || !bigbossUser || !adminUser || !bigbossMember || !adminMember;
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la vérification de l\'initialisation:', error);
      // En cas d'erreur, on considère qu'une initialisation est nécessaire
      return true;
    }
  }
}
