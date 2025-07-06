import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { mapPrismaUser } from '../common/user-mapper';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, LoginDto } from '../shared/dto';
import { AuthResponse, JwtPayload, UserRole } from '../shared/interfaces';
import { USER_SELECT_FIELDS } from '../shared/constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    const { 
      username, 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      password, 
      displayName, 
      systemLanguage,
      regionalLanguage,
      autoTranslateEnabled,
      translateToSystemLanguage,
      translateToRegionalLanguage,
      useCustomDestination
    } = createUserDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email }, 
          { username },
          ...(phoneNumber ? [{ phoneNumber }] : [])
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Email, nom d\'utilisateur ou téléphone déjà utilisé');
    }

    // Hash du mot de passe avec rounds configurables
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur avec gestion stricte des types
    const user = await this.prisma.user.create({
      data: {
        username,
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || null,
        password: hashedPassword,
        displayName: displayName || `${firstName} ${lastName}`,
        systemLanguage: systemLanguage || 'fr',
        regionalLanguage: regionalLanguage || 'fr',
        autoTranslateEnabled: autoTranslateEnabled ?? true,
        translateToSystemLanguage: translateToSystemLanguage ?? true,
        translateToRegionalLanguage: translateToRegionalLanguage ?? false,
        useCustomDestination: useCustomDestination ?? false,
      },
    });

    // Créer les statistiques utilisateur
    await this.prisma.userStats.create({
      data: {
        userId: user.id,
      },
    });

    // Générer le token JWT
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: mapPrismaUser(user, this.permissionsService),
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { username, password } = loginDto;
    
    // Trouver l'utilisateur par username ou email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username },
          { phoneNumber: username },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    // Mettre à jour le statut en ligne
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeen: new Date(),
        lastActiveAt: new Date(),
      },
    });

    // Générer le token JWT
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: mapPrismaUser(updatedUser, this.permissionsService),
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT_FIELDS,
    });
    
    if (!user) {
      return null;
    }
    
    return mapPrismaUser(user, this.permissionsService);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline: false,
        lastSeen: new Date(),
      },
    });
  }

  /**
   * Transforme un utilisateur Prisma en format sûr pour la réponse
   * Gère les valeurs nulles/undefined proprement
   */
  private transformUserForResponse(user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
    displayName: string | null;
    avatar: string | null;
    systemLanguage: string;
    regionalLanguage: string;
    customDestinationLanguage: string | null;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
    isOnline: boolean;
    lastSeen: Date | null;
    createdAt: Date;
    lastActiveAt: Date;
    role: string;
    isActive: boolean;
    deactivatedAt: Date | null;
  }) {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber || undefined,
      displayName: user.displayName || `${user.firstName} ${user.lastName}`,
      avatar: user.avatar || undefined,
      systemLanguage: user.systemLanguage,
      regionalLanguage: user.regionalLanguage,
      customDestinationLanguage: user.customDestinationLanguage || undefined,
      autoTranslateEnabled: user.autoTranslateEnabled,
      translateToSystemLanguage: user.translateToSystemLanguage,
      translateToRegionalLanguage: user.translateToRegionalLanguage,
      useCustomDestination: user.useCustomDestination,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen || undefined,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      role: user.role as UserRole, // Cast car UserRole est un type strict
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt || undefined,
    };
  }
}
