import { Controller, Get, Put, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getAllUsers(): User[] {
    return this.userService.getAllUsers();
  }

  @Get('online')
  getOnlineUsers(): User[] {
    return this.userService.getOnlineUsers();
  }

  @Get(':id')
  getUserById(@Param('id') id: string): User {
    const user = this.userService.getUserById(id);
    if (!user) {
      throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Put(':id/settings')
  updateUserSettings(
    @Param('id') id: string,
    @Body() settings: Partial<User>,
  ): User {
    const updatedUser = this.userService.updateUserSettings(id, settings);
    if (!updatedUser) {
      throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
    }
    return updatedUser;
  }
}
