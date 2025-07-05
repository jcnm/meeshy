import { Controller, Get, Post, Body, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { CreateConversationDto, JoinConversationDto, CreateMessageDto, CreateConversationLinkDto } from '../shared/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

@Controller('conversation')
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
    private prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createConversationDto: CreateConversationDto, @Request() req: AuthenticatedRequest) {
    return this.conversationService.create(createConversationDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findUserConversations(@Request() req: AuthenticatedRequest) {
    return this.conversationService.findUserConversations(req.user.id);
  }

  @Get('link/:linkId')
  async getConversationByLink(@Param('linkId') linkId: string) {
    return this.conversationService.getConversationByLinkId(linkId);
  }

  @Post('join/:linkId')
  @UseGuards(JwtAuthGuard)
  async joinByLink(@Param('linkId') linkId: string, @Request() req: AuthenticatedRequest) {
    // Récupérer les informations du lien
    const linkInfo = await this.conversationService.getConversationByLinkId(linkId);
    
    // Préparer le DTO pour rejoindre la conversation
    const joinDto: JoinConversationDto = {
      conversationId: linkInfo.conversationId,
      linkId: linkId,
    };

    // Rejoindre la conversation
    const result = await this.conversationService.join(joinDto, req.user.id);
    
    // Incrémenter le compteur d'utilisation du lien
    await this.prisma.conversationShareLink.update({
      where: { linkId },
      data: { currentUses: { increment: 1 } },
    });

    return result;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.conversationService.findOne(id, req.user.id);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async join(@Body() joinConversationDto: JoinConversationDto, @Request() req: AuthenticatedRequest) {
    return this.conversationService.join(joinConversationDto, req.user.id);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.conversationService.leave(id, req.user.id);
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messageService.findByConversation(id, req.user.id);
  }

  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    createMessageDto.conversationId = conversationId;
    return this.messageService.create(createMessageDto, req.user.id);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async findConversationsByUser(@Param('userId') userId: string) {
    return this.conversationService.findUserConversations(userId);
  }

  @Get('links/user/:userId')
  @UseGuards(JwtAuthGuard)
  async findLinksByUser(@Param('userId') userId: string) {
    return this.conversationService.findUserConversationLinks(userId);
  }

  @Post('create-link')
  @UseGuards(JwtAuthGuard)
  async createConversationLink(@Body() createLinkDto: CreateConversationLinkDto, @Request() req: AuthenticatedRequest) {
    return this.conversationService.createConversationLink(createLinkDto, req.user.id);
  }

  @Get('group/:groupId')
  @UseGuards(JwtAuthGuard)
  async findGroupConversations(@Param('groupId') groupId: string, @Request() req: AuthenticatedRequest) {
    return this.conversationService.findGroupConversations(groupId, req.user.id);
  }
}
