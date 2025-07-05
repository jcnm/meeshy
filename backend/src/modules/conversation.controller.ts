import { Controller, Get, Post, Body, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { CreateConversationDto, JoinConversationDto, CreateMessageDto } from '../dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
  ) {}

  @Post()
  async create(@Body() createConversationDto: CreateConversationDto, @Request() req: AuthenticatedRequest) {
    return this.conversationService.create(createConversationDto, req.user.id);
  }

  @Get()
  async findUserConversations(@Request() req: AuthenticatedRequest) {
    return this.conversationService.findUserConversations(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.conversationService.findOne(id, req.user.id);
  }

  @Post('join')
  async join(@Body() joinConversationDto: JoinConversationDto, @Request() req: AuthenticatedRequest) {
    return this.conversationService.join(joinConversationDto, req.user.id);
  }

  @Delete(':id/leave')
  async leave(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.conversationService.leave(id, req.user.id);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messageService.findByConversation(id, req.user.id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    createMessageDto.conversationId = conversationId;
    return this.messageService.create(createMessageDto, req.user.id);
  }
}
