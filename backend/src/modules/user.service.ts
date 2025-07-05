import { Injectable } from '@nestjs/common';
import { User } from '../types';

@Injectable()
export class UserService {
  private users: Map<string, User> = new Map();
  private onlineUsers: Set<string> = new Set();

  constructor() {
    this.initializeUsers();
  }

  private initializeUsers() {
    const predefinedUsers: User[] = [
      {
        id: '1',
        username: 'Alice',
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
      },
      {
        id: '2',
        username: 'Bob',
        systemLanguage: 'en',
        regionalLanguage: 'ru',
        autoTranslateEnabled: true,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: true,
        useCustomDestination: false,
        isOnline: false,
      },
      {
        id: '3',
        username: 'Carlos',
        systemLanguage: 'es',
        regionalLanguage: 'es',
        customDestinationLanguage: 'en',
        autoTranslateEnabled: true,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: true,
        isOnline: false,
      },
      {
        id: '4',
        username: 'Diana',
        systemLanguage: 'de',
        regionalLanguage: 'de',
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
      },
      {
        id: '5',
        username: 'Erik',
        systemLanguage: 'sv',
        regionalLanguage: 'sv',
        customDestinationLanguage: 'en',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
      },
    ];

    predefinedUsers.forEach(user => {
      this.users.set(user.id, user);
    });
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  updateUserSettings(userId: string, settings: Partial<User>): User | null {
    const user = this.users.get(userId);
    if (!user) return null;

    const updatedUser = { ...user, ...settings };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  setUserOnline(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    this.onlineUsers.add(userId);
    user.isOnline = true;
    return true;
  }

  setUserOffline(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    this.onlineUsers.delete(userId);
    user.isOnline = false;
    return true;
  }

  getOnlineUsers(): User[] {
    return Array.from(this.onlineUsers)
      .map(id => this.users.get(id))
      .filter(user => user !== undefined) as User[];
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
