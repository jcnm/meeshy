import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto } from '../shared/dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    displayName?: string;
    avatar?: string;
    systemLanguage: string;
    regionalLanguage: string;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
    isOnline: boolean;
    lastSeen: Date;
    lastActiveAt: Date;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: AuthenticatedRequest) {
    await this.authService.logout(req.user.id);
    return { message: 'Déconnexion réussie' };
  }
}
