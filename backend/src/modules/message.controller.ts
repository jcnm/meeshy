import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto, UpdateMessageDto } from '../shared/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Post()
  async create(@Body() createMessageDto: CreateMessageDto, @Request() req: AuthenticatedRequest) {
    return this.messageService.create(createMessageDto, req.user.id);
  }

  @Get('conversation/:conversationId')
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.messageService.findByConversation(conversationId, req.user.id, pageNum, limitNum);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messageService.update(id, updateMessageDto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.messageService.delete(id, req.user.id);
    return { message: 'Message supprimé avec succès' };
  }

  @Get('search/:conversationId')
  async search(
    @Param('conversationId') conversationId: string,
    @Query('q') query: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messageService.search(conversationId, query, req.user.id);
  }
}
