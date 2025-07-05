import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { UserService } from './user.service';
import { CreateUserDto } from '../types';

@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly userService: UserService,
  ) {}

  @Post('create-link')
  createConversationLink(@Body() data: { userId: string; expiresInHours?: number }) {
    try {
      const user = this.userService.getUserById(data.userId);
      if (!user) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      const link = this.conversationService.createConversationLink(
        data.userId,
        data.expiresInHours || 24 * 7 // 7 jours par défaut
      );

      const linkUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/join/${link.id}`;

      return {
        success: true,
        data: {
          link,
          url: linkUrl,
        },
      };
    } catch (error) {
      console.error('Erreur création lien:', error);
      return { success: false, error: 'Erreur lors de la création du lien' };
    }
  }

  @Get('link/:linkId')
  getConversationLink(@Param('linkId') linkId: string) {
    try {
      const link = this.conversationService.getConversationLink(linkId);
      if (!link) {
        return { success: false, error: 'Lien non trouvé ou expiré' };
      }

      return { success: true, data: link };
    } catch (error) {
      console.error('Erreur récupération lien:', error);
      return { success: false, error: 'Erreur lors de la récupération du lien' };
    }
  }

  @Post('join')
  joinConversation(@Body() data: { linkId: string; userData?: CreateUserDto; userId?: string }) {
    try {
      const { linkId, userData, userId } = data;

      // Si un userId est fourni, utiliser l'utilisateur existant
      if (userId) {
        const user = this.userService.getUserById(userId);
        if (!user) {
          return { success: false, error: 'Utilisateur non trouvé' };
        }

        const conversation = this.conversationService.joinConversationViaLink(linkId, userId);
        if (!conversation) {
          return { success: false, error: 'Impossible de rejoindre la conversation' };
        }

        return {
          success: true,
          data: {
            user,
            conversation,
            isNewUser: false,
          },
        };
      }

      // Si des données utilisateur sont fournies, créer ou trouver l'utilisateur
      if (userData) {
        // Vérifier si un utilisateur existe déjà
        const existingUser = this.userService.findExistingUser(userData.email, userData.phoneNumber);
        
        if (existingUser) {
          // Utilisateur existant trouvé
          const conversation = this.conversationService.joinConversationViaLink(linkId, existingUser.id);
          if (!conversation) {
            return { success: false, error: 'Impossible de rejoindre la conversation' };
          }

          return {
            success: true,
            data: {
              user: existingUser,
              conversation,
              isNewUser: false,
              existingUserFound: true,
            },
          };
        }

        // Créer un nouvel utilisateur
        const newUser = this.userService.createUser(userData);
        const conversation = this.conversationService.joinConversationViaLink(linkId, newUser.id);
        
        if (!conversation) {
          return { success: false, error: 'Impossible de rejoindre la conversation' };
        }

        return {
          success: true,
          data: {
            user: newUser,
            conversation,
            isNewUser: true,
          },
        };
      }

      return { success: false, error: 'Données manquantes' };
    } catch (error) {
      console.error('Erreur rejoindre conversation:', error);
      return { success: false, error: 'Erreur lors de la connexion' };
    }
  }

  @Get('user/:userId')
  getUserConversations(@Param('userId') userId: string) {
    try {
      const user = this.userService.getUserById(userId);
      if (!user) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      const conversations = this.conversationService.getUserConversations(userId);
      const conversationsWithDetails = conversations.map(conv => ({
        ...conv,
        participants: conv.participants.map(id => this.userService.getUserById(id)).filter(Boolean),
        messageCount: this.conversationService.getConversationMessages(conv.id, userId).length,
      }));

      return {
        success: true,
        data: conversationsWithDetails,
      };
    } catch (error) {
      console.error('Erreur récupération conversations:', error);
      return { success: false, error: 'Erreur lors de la récupération des conversations' };
    }
  }

  @Get('user/:userId/links')
  getUserConversationLinks(@Param('userId') userId: string) {
    try {
      const user = this.userService.getUserById(userId);
      if (!user) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      const links = this.conversationService.getUserConversationLinks(userId);
      const linksWithUrls = links.map(link => ({
        ...link,
        url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/join/${link.id}`,
      }));

      return {
        success: true,
        data: linksWithUrls,
      };
    } catch (error) {
      console.error('Erreur récupération liens:', error);
      return { success: false, error: 'Erreur lors de la récupération des liens' };
    }
  }

  @Get(':conversationId/messages')
  getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Query('userId') userId: string,
  ) {
    try {
      if (!userId) {
        return { success: false, error: 'ID utilisateur requis' };
      }

      const messages = this.conversationService.getConversationMessages(conversationId, userId);
      const messagesWithSender = messages.map(msg => ({
        ...msg,
        sender: this.userService.getUserById(msg.senderId),
      }));

      return {
        success: true,
        data: messagesWithSender,
      };
    } catch (error) {
      console.error('Erreur récupération messages:', error);
      return { success: false, error: 'Erreur lors de la récupération des messages' };
    }
  }

  @Post('link/:linkId/deactivate')
  deactivateLink(@Param('linkId') linkId: string, @Body() data: { userId: string }) {
    try {
      const success = this.conversationService.deactivateConversationLink(linkId, data.userId);
      if (!success) {
        return { success: false, error: 'Impossible de désactiver le lien' };
      }

      return { success: true };
    } catch (error) {
      console.error('Erreur désactivation lien:', error);
      return { success: false, error: 'Erreur lors de la désactivation' };
    }
  }
}
