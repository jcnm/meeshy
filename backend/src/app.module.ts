import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

// Services
import { PrismaService } from './prisma/prisma.service';
import { UserService } from './modules/user.service';
import { MessageService } from './modules/message.service';
import { ConversationService } from './modules/conversation.service';
import { GroupService } from './modules/group.service';

// Controllers
import { UserController } from './modules/user.controller';
import { ConversationController } from './modules/conversation.controller';
import { GroupController } from './modules/group.controller';
import { MessageController } from './modules/message.controller';

// Gateway
import { ChatGateway } from './gateway/chat.gateway';

// Auth
import { AuthModule } from './auth/auth.module';

// Security & Common
import { GlobalExceptionFilter } from './common/exception.filter';
import { globalValidationPipe } from './common/validation.pipe';

@Module({
  imports: [
    // Configuration des variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Rate limiting global
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000, // 60 secondes
      limit: parseInt(process.env.RATE_LIMIT_LIMIT || '100'), // 100 requêtes
    }]),
    
    // Auth et JWT
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret-key-meeshy-dev',
      signOptions: { 
        expiresIn: process.env.JWT_EXPIRES_IN || '1h' 
      },
    }),
  ],
  controllers: [
    UserController,
    ConversationController,
    GroupController,
    MessageController,
  ],
  providers: [
    // Services métier
    PrismaService,
    UserService,
    MessageService,
    ConversationService,
    GroupService,
    ChatGateway,
    
    // Sécurité globale
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: globalValidationPipe,
    },
  ],
})
export class AppModule {}
