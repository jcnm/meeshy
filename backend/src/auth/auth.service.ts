import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, LoginDto, AuthResponse } from '../dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
      throw new UnauthorizedException('Email, nom d\'utilisateur ou téléphone déjà utilisé');
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        username,
        firstName,
        lastName,
        email,
        phoneNumber,
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
    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        avatar: user.avatar,
        systemLanguage: user.systemLanguage,
        regionalLanguage: user.regionalLanguage,
        autoTranslateEnabled: user.autoTranslateEnabled,
        translateToSystemLanguage: user.translateToSystemLanguage,
        translateToRegionalLanguage: user.translateToRegionalLanguage,
        useCustomDestination: user.useCustomDestination,
        isOnline: user.isOnline,
        lastActiveAt: user.lastActiveAt,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Trouver l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email },
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
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeen: new Date(),
      },
    });

    // Générer le token JWT
    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        avatar: user.avatar,
        systemLanguage: user.systemLanguage,
        regionalLanguage: user.regionalLanguage,
        autoTranslateEnabled: user.autoTranslateEnabled,
        translateToSystemLanguage: user.translateToSystemLanguage,
        translateToRegionalLanguage: user.translateToRegionalLanguage,
        useCustomDestination: user.useCustomDestination,
        isOnline: user.isOnline,
        lastActiveAt: user.lastActiveAt,
      },
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        displayName: true,
        avatar: true,
        systemLanguage: true,
        regionalLanguage: true,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: true,
        useCustomDestination: true,
        isOnline: true,
        lastSeen: true,
        lastActiveAt: true,
      },
    });
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
}
