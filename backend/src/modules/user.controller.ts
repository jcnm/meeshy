import { Controller, Get, Patch, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from '../dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Get('search')
  async search(@Query('q') query: string, @Request() req: AuthenticatedRequest) {
    return this.userService.searchUsers(query, [req.user.id]);
  }

  @Get('me')
  async getProfile(@Request() req: AuthenticatedRequest) {
    return this.userService.findOne(req.user.id);
  }

  @Patch('me')
  async updateProfile(@Body() updateUserDto: UpdateUserDto, @Request() req: AuthenticatedRequest) {
    return this.userService.update(req.user.id, updateUserDto);
  }

  @Get('me/stats')
  async getMyStats(@Request() req: AuthenticatedRequest) {
    return this.userService.getStats(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.userService.getStats(id);
  }
}
