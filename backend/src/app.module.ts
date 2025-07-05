import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

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

@Module({
  imports: [
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret-key-meeshy-dev',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    UserController,
    ConversationController,
    GroupController,
    MessageController,
  ],
  providers: [
    PrismaService,
    UserService,
    MessageService,
    ConversationService,
    GroupService,
    ChatGateway,
  ],
})
export class AppModule {}
