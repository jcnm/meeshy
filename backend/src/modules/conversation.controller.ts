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

@Controller('conversation')
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

  @Get('user/:userId')
  async findConversationsByUser(@Param('userId') userId: string) {
    return this.conversationService.findUserConversations(userId);
  }

  @Get('links/user/:userId')
  async findLinksByUser(@Param('userId') userId: string) {
    // Pour l'instant, retourner un tableau vide
    return [];
  }

  @Get('link/:linkId')
  async getConversationByLink(@Param('linkId') linkId: string) {
    // Pour l'instant, simuler un lien valide
    const mockLink = {
      id: linkId,
      conversationId: 'conv-1',
      linkId: linkId,
      isActive: true,
      currentUses: 0,
      maxUses: null,
      expiresAt: null,
      conversation: {
        id: 'conv-1',
        name: 'Conversation de test',
        isGroup: false,
        isPrivate: false,
        createdAt: new Date(),
        members: []
      }
    };
    return mockLink;
  }

  @Post('join/:linkId')
  async joinByLink(@Param('linkId') linkId: string, @Request() req: AuthenticatedRequest) {
    // Pour l'instant, simuler une jointure réussie
    return { success: true, message: 'Rejoint avec succès' };
  }
}
