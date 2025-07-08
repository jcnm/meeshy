import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Services
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/cache.service';
import { CacheCleanupService } from './common/cache-cleanup.service';
import { UserService } from './modules/user.service';
import { MessageService } from './modules/message.service';
import { ConversationService } from './modules/conversation.service';
import { GroupService } from './modules/group.service';

// Optimized Services
import { ConversationServiceOptimized } from './common/conversation-optimized.service';

// Advanced Services
import { NotificationService } from './common/notification.service';
import { PermissionsService } from './common/permissions.service';
import { HealthController } from './common/health.controller';
import { NotificationController } from './common/notification.controller';
import { AdminController } from './common/admin.controller';

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
    
    // Scheduler pour les tâches automatiques
    ScheduleModule.forRoot(),
    
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
    HealthController,
    NotificationController,
    AdminController,
  ],
  providers: [
    // Services métier
    PrismaService,
    CacheService,
    CacheCleanupService,
    UserService,
    MessageService,
    ConversationService,
    GroupService,
    ChatGateway,
    
    // Optimized Services
    ConversationServiceOptimized,
    
    // Advanced Services
    NotificationService,
    PermissionsService,
    
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
