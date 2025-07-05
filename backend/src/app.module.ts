import { Module } from '@nestjs/common';
import { UserService } from './modules/user.service';
import { MessageService } from './modules/message.service';
import { ConversationService } from './modules/conversation.service';
import { UserController } from './modules/user.controller';
import { ConversationController } from './modules/conversation.controller';
import { ChatGateway } from './gateway/chat.gateway';

@Module({
  imports: [],
  controllers: [UserController, ConversationController],
  providers: [UserService, MessageService, ConversationService, ChatGateway],
})
export class AppModule {}
