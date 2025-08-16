import { PrismaClient } from '../../shared/prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SocketIOUser, UserRoleEnum } from '@shared/types';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  systemLanguage?: string;
  regionalLanguage?: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export class PrismaAuthService {
  private prisma: PrismaClient;
  private jwtSecret: string;

  constructor(prisma: PrismaClient, jwtSecret: string) {
    this.prisma = prisma;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Authentifier un utilisateur avec username/password
   */
  async authenticate(credentials: LoginCredentials): Promise<SocketIOUser | null> {
    try {
      // Rechercher l'utilisateur par username ou email
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: credentials.username },
            { email: credentials.username }
          ],
          isActive: true
        }
      });

      if (!user) {
        return null;
      }

      // Vérifier le mot de passe
      const passwordValid = await bcrypt.compare(credentials.password, user.password);
      if (!passwordValid) {
        return null;
      }

      // Mettre à jour la dernière connexion
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isOnline: true,
          lastSeen: new Date(),
          lastActiveAt: new Date()
        }
      });

      // Convertir en SocketIOUser
      return this.userToSocketIOUser(user);

    } catch (error) {
      console.error('Error in authenticate:', error);
      return null;
    }
  }

  /**
   * Créer un nouveau utilisateur
   */
  async register(data: RegisterData): Promise<SocketIOUser | null> {
    try {
      // Vérifier si l'username ou l'email existe déjà
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: data.username },
            { email: data.email }
          ]
        }
      });

      if (existingUser) {
        throw new Error('Username ou email déjà utilisé');
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Créer l'utilisateur
      const user = await this.prisma.user.create({
        data: {
          username: data.username,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          systemLanguage: data.systemLanguage || 'fr',
          regionalLanguage: data.regionalLanguage || 'fr',
          displayName: `${data.firstName} ${data.lastName}`,
          isOnline: true,
          lastSeen: new Date(),
          lastActiveAt: new Date()
        }
      });

      return this.userToSocketIOUser(user);

    } catch (error) {
      console.error('Error in register:', error);
      return null;
    }
  }

  /**
   * Récupérer un utilisateur par ID
   */
  async getUserById(userId: string): Promise<SocketIOUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
          isActive: true
        }
      });

      if (!user) {
        return null;
      }

      return this.userToSocketIOUser(user);

    } catch (error) {
      console.error('Error in getUserById:', error);
      return null;
    }
  }

  /**
   * Générer un token JWT
   */
  generateToken(user: SocketIOUser): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h'
    });
  }

  /**
   * Vérifier un token JWT
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      console.error('Error verifying token:', error);
      return null;
    }
  }

  /**
   * Mettre à jour le statut en ligne d'un utilisateur
   */
  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeen: new Date(),
          lastActiveAt: isOnline ? new Date() : undefined
        }
      });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }

  /**
   * Récupérer les permissions d'un utilisateur
   */
  getUserPermissions(user: SocketIOUser) {
    const role = user.role.toUpperCase() as keyof typeof UserRoleEnum;
    
    // Permissions basées sur le rôle
    const basePermissions = {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    };

    switch (role) {
      case UserRoleEnum.BIGBOSS:
        return {
          ...basePermissions,
          canAccessAdmin: true,
          canManageUsers: true,
          canManageGroups: true,
          canManageConversations: true,
          canViewAnalytics: true,
          canModerateContent: true,
          canViewAuditLogs: true,
          canManageNotifications: true,
          canManageTranslations: true,
        };

      case UserRoleEnum.ADMIN:
        return {
          ...basePermissions,
          canAccessAdmin: true,
          canManageUsers: true,
          canManageGroups: true,
          canManageConversations: true,
          canViewAnalytics: true,
          canModerateContent: true,
          canManageNotifications: true,
        };

      case UserRoleEnum.MODERATOR:
        return {
          ...basePermissions,
          canAccessAdmin: true,
          canModerateContent: true,
          canManageConversations: true,
        };

      case UserRoleEnum.AUDIT:
        return {
          ...basePermissions,
          canAccessAdmin: true,
          canViewAuditLogs: true,
          canViewAnalytics: true,
        };

      case UserRoleEnum.ANALYST:
        return {
          ...basePermissions,
          canAccessAdmin: true,
          canViewAnalytics: true,
        };

      default:
        return basePermissions;
    }
  }

  /**
   * Convertir un User Prisma en SocketIOUser
   */
  private userToSocketIOUser(user: any): SocketIOUser {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName || `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      role: user.role,
      permissions: this.getUserPermissions({
        ...user,
        role: user.role
      } as SocketIOUser),
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      lastActiveAt: user.lastActiveAt,
      systemLanguage: user.systemLanguage,
      regionalLanguage: user.regionalLanguage,
      customDestinationLanguage: user.customDestinationLanguage,
      autoTranslateEnabled: user.autoTranslateEnabled,
      translateToSystemLanguage: user.translateToSystemLanguage,
      translateToRegionalLanguage: user.translateToRegionalLanguage,
      useCustomDestination: user.useCustomDestination,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
