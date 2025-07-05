import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { GroupService } from './group.service';
import { CreateGroupDto, UpdateGroupDto } from '../shared/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupController {
  constructor(private groupService: GroupService) {}

  @Post()
  async create(@Body() createGroupDto: CreateGroupDto, @Request() req: AuthenticatedRequest) {
    return this.groupService.create(createGroupDto, req.user.id);
  }

  @Get()
  async findUserGroups(@Request() req: AuthenticatedRequest) {
    return this.groupService.findUserGroups(req.user.id);
  }

  @Get('search')
  async searchPublicGroups(@Query('q') query: string, @Query('page') page?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    return this.groupService.searchPublicGroups(query || '', pageNum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.groupService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupService.update(id, updateGroupDto, req.user.id);
  }

  @Post(':id/join')
  async join(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.groupService.join(id, req.user.id);
  }

  @Delete(':id/leave')
  async leave(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.groupService.leave(id, req.user.id);
  }

  @Post(':id/members/:userId')
  async addMember(
    @Param('id') groupId: string,
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupService.addMember(groupId, userId, req.user.id);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') groupId: string,
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupService.removeMember(groupId, userId, req.user.id);
  }

  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Param('id') groupId: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'member' | 'moderator' | 'admin' },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupService.updateMemberRole(groupId, userId, body.role, req.user.id);
  }
}
