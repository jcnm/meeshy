import { Module } from '@nestjs/common';
import { UserService } from './modules/user.service';
import { MessageService } from './modules/message.service';
import { UserController } from './modules/user.controller';
import { ChatGateway } from './gateway/chat.gateway';

@Module({
  imports: [],
  controllers: [UserController],
  providers: [UserService, MessageService, ChatGateway],
})
export class AppModule {}
