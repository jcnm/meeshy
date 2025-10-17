import { PrismaClient } from '../../shared/prisma/client';
import { AuthService } from './auth.service';
import { UserRoleEnum } from '../../shared/types';

export class InitService {
  private prisma: PrismaClient;
  private authService: AuthService;
  private globalConversationId: string;
  private directConversationId: string;
  private groupConversationId: string;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.authService = new AuthService(prisma, process.env.JWT_SECRET || 'default-jwt-secret');
  }

  /**
   * Initialise la base de données avec les données par défaut
   */
  async initializeDatabase(): Promise<void> {
    const forceReset = process.env.FORCE_DB_RESET === 'true';
    
    if (forceReset) {
      console.log('[INIT] 🔄 FORCE_DB_RESET=true détecté - Réinitialisation forcée de la base de données...');
      await this.resetDatabase();
    } else {
      console.log('[INIT] 🚀 Démarrage de l\'initialisation de la base de données...');
    }

    try {
      // 1. Créer la conversation globale "meeshy"
      await this.createGlobalConversation();

      // 2. Créer les utilisateurs par défaut
      await this.createDefaultUsers();

      // 3. Créer l'utilisateur André Tabeth
      await this.createAndreTabethUser();

      // 4. Créer les conversations supplémentaires
      await this.createAdditionalConversations();

      // 5. S'assurer que tous les utilisateurs sont membres de la conversation meeshy
      await this.ensureAllUsersInMeeshyConversation();

      console.log('[INIT] ✅ Initialisation de la base de données terminée avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de l\'initialisation:', error);
      console.error('[INIT] 💡 Détails de l\'erreur:', error.message);
      
      // En mode développement, on ne fait pas échouer le serveur
      if (process.env.NODE_ENV === 'development') {
        console.log('[INIT] ⚠️ Mode développement: Continuation sans initialisation de la base');
        return;
      }
      
      throw error;
    }
  }

  /**
   * Crée la conversation globale "meeshy"
   */
  private async createGlobalConversation(): Promise<void> {
    console.log('[INIT] 🔍 Vérification de la conversation globale "meeshy"...');

    try {
      let existingConversation = await this.prisma.conversation.findFirst({
        where: { identifier: 'meeshy' }
      });

      if (existingConversation) {
        console.log('[INIT] ✅ Conversation globale "meeshy" existe déjà');
        return;
      }

      console.log('[INIT] 🆕 Création de la conversation globale "meeshy"...');

      const newConversation = await this.prisma.conversation.create({
        data: {
          identifier: 'meeshy',
          title: 'Meeshy Global',
          description: 'Conversation globale de la communauté Meeshy',
          type: 'global',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.globalConversationId = newConversation.id;

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
   * Crée l'utilisateur Bigboss (Meeshy Sama) - Partiellement configurable
   */
  private async createBigbossUser(): Promise<void> {
    // Utilisateur fixe avec certains champs configurables
    const username = 'meeshy'; // FIXE
    const password = process.env.MEESHY_PASSWORD || 'bigboss123'; // CONFIGURABLE
    const firstName = 'Meeshy'; // FIXE
    const lastName = 'Sama'; // FIXE
    const email = process.env.MEESHY_EMAIL || 'meeshy@meeshy.me'; // CONFIGURABLE
    const role = 'BIGBOSS'; // FIXE
    const systemLanguage = process.env.MEESHY_SYSTEM_LANGUAGE || 'en'; // CONFIGURABLE
    const regionalLanguage = process.env.MEESHY_REGIONAL_LANGUAGE || 'fr'; // CONFIGURABLE
    const customDestinationLanguage = process.env.MEESHY_CUSTOM_DESTINATION_LANGUAGE || 'pt'; // CONFIGURABLE

    console.log(`[INIT] 🔍 Vérification de l'utilisateur Bigboss "${username}" (${firstName} ${lastName})...`);

    try {
      const existingUser = await this.prisma.user.findFirst({
        where: { username }
      });

      if (existingUser) {
        console.log(`[INIT] ✅ Utilisateur Bigboss "${username}" existe déjà`);
        return;
      }

      console.log(`[INIT] 🆕 Création de l'utilisateur Bigboss "${username}" (${firstName} ${lastName})...`);

      // Créer l'utilisateur via l'API de création de compte
      const userData = {
        username,
        password,
        firstName,
        lastName,
        email,
        systemLanguage,
        regionalLanguage,
        customDestinationLanguage
      };

      const user = await this.authService.register(userData);

      if (!user) {
        throw new Error('Échec de la création de l\'utilisateur Bigboss');
      }

      // Mettre à jour le rôle vers BIGBOSS (fixe)
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRoleEnum.BIGBOSS }
      });

      // Ajouter l'utilisateur comme CREATOR de la conversation meeshy
      await this.prisma.conversationMember.create({
        data: {
          conversationId: this.globalConversationId,
          userId: user.id,
          role: 'CREATOR',
          joinedAt: new Date(),
          isActive: true
        }
      });

      console.log(`[INIT] ✅ Utilisateur Bigboss "${username}" (${firstName} ${lastName}) créé avec succès - Rôle: ${role}`);
    } catch (error) {
      console.error(`[INIT] ❌ Erreur lors de la création de l'utilisateur Bigboss "${username}":`, error);
      throw error;
    }
  }

  /**
   * Crée l'utilisateur Admin Manager - Partiellement configurable
   */
  private async createAdminUser(): Promise<void> {
    // Utilisateur fixe avec certains champs configurables
    const username = 'admin'; // FIXE
    const password = process.env.ADMIN_PASSWORD || 'admin123'; // CONFIGURABLE
    const firstName = 'Admin'; // FIXE
    const lastName = 'Manager'; // FIXE
    const email = process.env.ADMIN_EMAIL || 'admin@meeshy.me'; // CONFIGURABLE
    const role = 'ADMIN'; // FIXE
    const systemLanguage = process.env.ADMIN_SYSTEM_LANGUAGE || 'es'; // CONFIGURABLE
    const regionalLanguage = process.env.ADMIN_REGIONAL_LANGUAGE || 'de'; // CONFIGURABLE
    const customDestinationLanguage = process.env.ADMIN_CUSTOM_DESTINATION_LANGUAGE || 'zh'; // CONFIGURABLE

    console.log(`[INIT] 🔍 Vérification de l'utilisateur Admin "${username}"...`);

    try {
      const existingUser = await this.prisma.user.findFirst({
        where: { username }
      });

      if (existingUser) {
        console.log(`[INIT] ✅ Utilisateur Admin "${username}" existe déjà`);
        
        // Mettre à jour le rôle vers ADMIN et les langues configurables
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { 
            role: UserRoleEnum.ADMIN,
            systemLanguage,
            regionalLanguage,
            customDestinationLanguage
          }
        });
        
        console.log(`[INIT] ✅ Rôle et langues de l'utilisateur Admin "${username}" mis à jour`);
      } else {
        console.log(`[INIT] 🆕 Création de l'utilisateur Admin "${username}"...`);

        // Créer l'utilisateur via l'API de création de compte
        const userData = {
          username,
          password,
          firstName,
          lastName,
          email,
          systemLanguage,
          regionalLanguage,
          customDestinationLanguage
        };

        const user = await this.authService.register(userData);

        if (!user) {
          throw new Error('Échec de la création de l\'utilisateur Admin');
        }

        // Mettre à jour le rôle vers ADMIN (fixe)
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: UserRoleEnum.ADMIN }
        });
      }

      // Ajouter l'utilisateur à la conversation globale meeshy
      const userId = existingUser ? existingUser.id : (await this.prisma.user.findFirst({ where: { username } }))!.id;
      await this.addUserToMeeshyConversation(userId, username);

      console.log(`[INIT] ✅ Utilisateur Admin "${username}" configuré avec succès`);
    } catch (error) {
      console.error(`[INIT] ❌ Erreur lors de la configuration de l'utilisateur Admin "${username}":`, error);
      throw error;
    }
  }

  /**
   * Réinitialise complètement la base de données
   */
  private async resetDatabase(): Promise<void> {
    console.log('[INIT] 🧹 Suppression de toutes les données existantes...');
    
    try {
      // Utiliser $runCommandRaw pour drop les collections directement
      // Ceci évite les problèmes de contraintes de clés étrangères avec les auto-relations
      const collections = [
        'MessageTranslation',
        'MessageStatus',
        'Message',
        'ConversationMember',
        'Conversation',
        'User'
      ];
      
      for (const collection of collections) {
        try {
          await this.prisma.$runCommandRaw({
            drop: collection
          });
          console.log(`[INIT] ✓ Collection ${collection} supprimée`);
        } catch (error: any) {
          // Ignorer l'erreur si la collection n'existe pas (code 26)
          if (error.code !== 26 && error.code !== 'P2010') {
            console.log(`[INIT] ⚠️ Erreur lors de la suppression de ${collection}:`, error.message);
          }
        }
      }
      
      console.log('[INIT] ✅ Base de données réinitialisée avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la réinitialisation de la base de données:', error);
      throw error;
    }
  }

  /**
   * Crée l'utilisateur André Tabeth - Entièrement configurable
   */
  private async createAndreTabethUser(): Promise<void> {
    // Utilisateur entièrement configurable
    const username = process.env.ATABETH_USERNAME || 'atabeth';
    const password = process.env.ATABETH_PASSWORD || 'admin123';
    const firstName = process.env.ATABETH_FIRST_NAME || 'André';
    const lastName = process.env.ATABETH_LAST_NAME || 'Tabeth';
    const email = process.env.ATABETH_EMAIL || 'atabeth@meeshy.me';
    const role = process.env.ATABETH_ROLE || 'USER';
    const systemLanguage = process.env.ATABETH_SYSTEM_LANGUAGE || 'fr';
    const regionalLanguage = process.env.ATABETH_REGIONAL_LANGUAGE || 'en';
    const customDestinationLanguage = process.env.ATABETH_CUSTOM_DESTINATION_LANGUAGE || 'es';

    console.log(`[INIT] 🔍 Vérification de l'utilisateur André Tabeth "${username}" (${firstName} ${lastName})...`);

    try {
      const existingUser = await this.prisma.user.findFirst({
        where: { username }
      });

      if (existingUser) {
        console.log(`[INIT] ✅ Utilisateur André Tabeth "${username}" existe déjà`);
        return;
      }

      console.log(`[INIT] 🆕 Création de l'utilisateur André Tabeth "${username}" (${firstName} ${lastName})...`);

      // Créer l'utilisateur via l'API de création de compte
      const userData = {
        username,
        password,
        firstName,
        lastName,
        email,
        systemLanguage,
        regionalLanguage,
        customDestinationLanguage
      };

      const user = await this.authService.register(userData);

      if (!user) {
        throw new Error('Échec de la création de l\'utilisateur André Tabeth');
      }

      // Mettre à jour le rôle vers la valeur configurée
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: role as any }
      });

      // Ajouter l'utilisateur à la conversation globale meeshy
      await this.addUserToMeeshyConversation(user.id, username);

      console.log(`[INIT] ✅ Utilisateur André Tabeth "${username}" (${firstName} ${lastName}) créé avec succès - Rôle: ${role}`);
    } catch (error) {
      console.error(`[INIT] ❌ Erreur lors de la création de l'utilisateur André Tabeth "${username}":`, error);
      throw error;
    }
  }

  /**
   * Ajoute un utilisateur à la conversation globale meeshy
   */
  private async addUserToMeeshyConversation(userId: string, username: string): Promise<void> {
    try {
      // Récupérer l'ID de la conversation globale
      const globalConversation = await this.prisma.conversation.findFirst({
        where: { identifier: 'meeshy' }
      });

      if (!globalConversation) {
        console.log(`[INIT] ⚠️ Conversation globale "meeshy" non trouvée, impossible d'ajouter l'utilisateur "${username}"`);
        return;
      }

      // Vérifier si l'utilisateur est déjà membre de la conversation
      const existingMember = await this.prisma.conversationMember.findFirst({
        where: {
          conversationId: globalConversation.id,
          userId: userId
        }
      });

      if (!existingMember) {
        // Déterminer le rôle selon l'utilisateur
        const role = username === 'meeshy' ? 'CREATOR' : 
                    username === 'admin' ? 'ADMIN' : 'MEMBER';
        
        // Ajouter l'utilisateur comme membre de la conversation meeshy
        await this.prisma.conversationMember.create({
          data: {
            conversationId: globalConversation.id,
            userId: userId,
            role: role,
            joinedAt: new Date(),
            isActive: true
          }
        });
        
        console.log(`[INIT] ✅ Utilisateur "${username}" ajouté à la conversation meeshy avec le rôle ${role}`);
      } else {
        console.log(`[INIT] ✅ Utilisateur "${username}" est déjà membre de la conversation meeshy`);
      }
    } catch (error) {
      console.error(`[INIT] ❌ Erreur lors de l'ajout de l'utilisateur "${username}" à la conversation meeshy:`, error);
      throw error;
    }
  }

  /**
   * S'assure que tous les utilisateurs existants sont membres de la conversation meeshy
   */
  private async ensureAllUsersInMeeshyConversation(): Promise<void> {
    console.log('[INIT] 🔍 Vérification que tous les utilisateurs sont membres de la conversation meeshy...');

    try {
      // Récupérer tous les utilisateurs actifs
      const users = await this.prisma.user.findMany({
        where: { isActive: true }
      });

      for (const user of users) {
        await this.addUserToMeeshyConversation(user.id, user.username);
      }

      console.log(`[INIT] ✅ Vérification terminée pour ${users.length} utilisateurs`);
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la vérification des membres de la conversation meeshy:', error);
      throw error;
    }
  }

  /**
   * Crée les conversations supplémentaires (directe et de groupe)
   */
  private async createAdditionalConversations(): Promise<void> {
    console.log('[INIT] 🔍 Création des conversations supplémentaires...');

    try {
      // Récupérer les utilisateurs
      const adminUser = await this.prisma.user.findFirst({ where: { username: 'admin' } });
      const atabethUser = await this.prisma.user.findFirst({ where: { username: 'atabeth' } });
      const meeshyUser = await this.prisma.user.findFirst({ where: { username: 'meeshy' } });

      if (!adminUser || !atabethUser || !meeshyUser) {
        console.log('[INIT] ⚠️ Impossible de créer les conversations supplémentaires - utilisateurs manquants');
        return;
      }

      // 1. Créer la conversation directe entre atabeth et admin
      await this.createDirectConversation(atabethUser.id, adminUser.id);

      // 2. Créer la conversation de groupe entre atabeth, admin et meeshy
      await this.createGroupConversation([atabethUser.id, adminUser.id, meeshyUser.id]);

      console.log('[INIT] ✅ Conversations supplémentaires créées avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la création des conversations supplémentaires:', error);
      throw error;
    }
  }

  /**
   * Crée une conversation directe entre deux utilisateurs
   */
  private async createDirectConversation(userId1: string, userId2: string): Promise<void> {
    console.log('[INIT] 🔍 Création de la conversation directe...');

    try {
      // Générer un identifiant unique pour la conversation directe
      const identifier = `mshy_${userId1}_${userId2}`;
      
      // Vérifier si la conversation existe déjà
      const existingConversation = await this.prisma.conversation.findFirst({
        where: { identifier }
      });

      if (existingConversation) {
        console.log('[INIT] ✅ Conversation directe existe déjà');
        this.directConversationId = existingConversation.id;
        return;
      }

      // Créer la conversation directe
      const conversation = await this.prisma.conversation.create({
        data: {
          identifier,
          title: 'Conversation directe',
          description: 'Conversation privée entre utilisateurs',
          type: 'direct',
          isActive: true,
          createdAt: new Date()
        }
      });

      this.directConversationId = conversation.id;

      // Ajouter les deux utilisateurs comme membres
      await this.prisma.conversationMember.createMany({
        data: [
          {
            conversationId: conversation.id,
            userId: userId1,
            role: 'ADMIN',
            joinedAt: new Date(),
            isActive: true
          },
          {
            conversationId: conversation.id,
            userId: userId2,
            role: 'ADMIN',
            joinedAt: new Date(),
            isActive: true
          }
        ]
      });

      console.log('[INIT] ✅ Conversation directe créée avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la création de la conversation directe:', error);
      throw error;
    }
  }

  /**
   * Crée une conversation de groupe entre plusieurs utilisateurs
   */
  private async createGroupConversation(userIds: string[]): Promise<void> {
    console.log('[INIT] 🔍 Création de la conversation de groupe...');

    try {
      // Générer un identifiant unique pour la conversation de groupe
      const identifier = `mshy_meeshy-infrastructure-team-one`;
      
      // Vérifier si la conversation existe déjà
      const existingConversation = await this.prisma.conversation.findFirst({
        where: { identifier }
      });

      if (existingConversation) {
        console.log('[INIT] ✅ Conversation de groupe existe déjà');
        this.groupConversationId = existingConversation.id;
        return;
      }

      // Créer la conversation de groupe
      const conversation = await this.prisma.conversation.create({
        data: {
          identifier,
          title: 'Meeshy Infrastructure Team One',
          description: 'The initial group of the Meeshy Infrastructure Team',
          type: 'group',
          isActive: true,
          createdAt: new Date()
        }
      });

      this.groupConversationId = conversation.id;

      // Ajouter tous les utilisateurs comme membres
      const membersData = userIds.map((userId, index) => ({
        conversationId: conversation.id,
        userId,
        role: index === 0 ? 'CREATOR' : 'ADMIN', // Premier utilisateur = admin
        joinedAt: new Date(),
        isActive: true
      }));

      await this.prisma.conversationMember.createMany({
        data: membersData
      });

      console.log('[INIT] ✅ Conversation de groupe créée avec succès');
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la création de la conversation de groupe:', error);
      throw error;
    }
  }

  /**
   * Vérifie si l'initialisation est nécessaire
   */
  async shouldInitialize(): Promise<boolean> {
    const forceReset = process.env.FORCE_DB_RESET === 'true';
    
    if (forceReset) {
      console.log('[INIT] 🔄 FORCE_DB_RESET=true - Initialisation forcée requise');
      return true;
    }

    try {
      // Vérifier si la conversation globale existe
      const globalConversation = await this.prisma.conversation.findFirst({
        where: { identifier: 'meeshy' }
      });

      // Vérifier si les utilisateurs par défaut existent
      const bigbossUser = await this.prisma.user.findFirst({
        where: { username: 'meeshy' }
      });

      const adminUser = await this.prisma.user.findFirst({
        where: { username: 'admin' }
      });

      const atabethUser = await this.prisma.user.findFirst({
        where: { username: 'atabeth' }
      });

      // Vérifier si les utilisateurs sont membres de la conversation
      let bigbossMember = null;
      let adminMember = null;

      if (globalConversation && bigbossUser) {
        bigbossMember = await this.prisma.conversationMember.findFirst({
          where: {
            conversationId: globalConversation.id,
            userId: bigbossUser.id
          }
        });
      }

      if (globalConversation && adminUser) {
        adminMember = await this.prisma.conversationMember.findFirst({
          where: {
            conversationId: globalConversation.id,
            userId: adminUser.id
          }
        });
      }

      // Si la conversation globale, les utilisateurs ou leurs appartenances n'existent pas, initialisation nécessaire
      const needsInit = !globalConversation || !bigbossUser || !adminUser || !atabethUser || !bigbossMember || !adminMember;
      
      if (needsInit) {
        console.log('[INIT] 🔍 Initialisation requise - éléments manquants détectés');
      } else {
        console.log('[INIT] ✅ Base de données déjà initialisée - aucune action requise');
      }
      
      return needsInit;
    } catch (error) {
      console.error('[INIT] ❌ Erreur lors de la vérification de l\'initialisation:', error);
      // En cas d'erreur, on considère qu'une initialisation est nécessaire
      return true;
    }
  }
}
