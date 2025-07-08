import { ApiResponse } from './apiService';
import { Group, GroupMember, User } from '@/types';

// Données mock pour les tests
export const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@test.com',
    phoneNumber: '',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN' as const,
    permissions: {
      canAccessAdmin: true,
      canManageUsers: true,
      canManageGroups: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canViewAuditLogs: true,
      canManageNotifications: true,
      canManageTranslations: true,
    },
    systemLanguage: 'fr',
    regionalLanguage: 'fr',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: true,
    createdAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
  },
  {
    id: '2',
    username: 'member1',
    email: 'member1@test.com',
    phoneNumber: '',
    firstName: 'Member',
    lastName: 'One',
    role: 'USER' as const,
    permissions: {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    systemLanguage: 'en',
    regionalLanguage: 'en',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: false,
    createdAt: new Date('2024-01-02'),
    lastActiveAt: new Date('2024-01-10'),
  },
  {
    id: '3',
    username: 'member2',
    email: 'member2@test.com',
    phoneNumber: '',
    firstName: 'Member',
    lastName: 'Two',
    role: 'USER' as const,
    permissions: {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    systemLanguage: 'es',
    regionalLanguage: 'es',
    autoTranslateEnabled: false,
    translateToSystemLanguage: false,
    translateToRegionalLanguage: true,
    useCustomDestination: false,
    isOnline: true,
    createdAt: new Date('2024-01-03'),
    lastActiveAt: new Date(),
  },
];

export const mockGroupMembers: GroupMember[] = [
  {
    id: '1',
    userId: '1',
    groupId: 'group-1',
    role: 'ADMIN',
    joinedAt: new Date('2024-01-01'),
    user: mockUsers[0],
  },
  {
    id: '2',
    userId: '2',
    groupId: 'group-1',
    role: 'MEMBER',
    joinedAt: new Date('2024-01-02'),
    user: mockUsers[1],
  },
  {
    id: '3',
    userId: '3',
    groupId: 'group-1',
    role: 'MEMBER',
    joinedAt: new Date('2024-01-03'),
    user: mockUsers[2],
  },
];

export const mockGroups: Group[] = [
  {
    id: 'group-1',
    name: 'Groupe de test',
    description: 'Description du groupe de test',
    isPrivate: false,
    maxMembers: 50,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    members: mockGroupMembers,
    conversations: [],
  },
  {
    id: 'group-2',
    name: 'Groupe privé',
    description: 'Un groupe privé pour les tests',
    isPrivate: true,
    maxMembers: 10,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    members: [mockGroupMembers[0]], // Seul l'admin
    conversations: [],
  },
];

class MockApiService {
  private delay: number;
  private shouldFail: boolean;
  private failureStatus: number;
  private failureMessage: string;

  constructor() {
    this.delay = 100; // Délai simulé de 100ms
    this.shouldFail = false;
    this.failureStatus = 500;
    this.failureMessage = 'Mock API Error';
  }

  // Configuration des tests
  setDelay(delay: number) {
    this.delay = delay;
  }

  setFailure(shouldFail: boolean, status: number = 500, message: string = 'Mock API Error') {
    this.shouldFail = shouldFail;
    this.failureStatus = status;
    this.failureMessage = message;
  }

  private async mockRequest<T>(data: T): Promise<ApiResponse<T>> {
    await new Promise(resolve => setTimeout(resolve, this.delay));

    if (this.shouldFail) {
      throw new Error(`${this.failureStatus}: ${this.failureMessage}`);
    }

    return {
      data,
      status: 200,
      message: 'Success',
    };
  }

  // Mock des méthodes groupes
  async getGroups() {
    return this.mockRequest({
      groups: mockGroups,
      total: mockGroups.length,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  }

  async getGroupById(id: string) {
    const group = mockGroups.find(g => g.id === id);
    if (!group) {
      throw new Error('404: Group not found');
    }
    return this.mockRequest(group);
  }

  async createGroup(groupData: Partial<Group>) {
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: groupData.name || 'Nouveau groupe',
      description: groupData.description,
      isPrivate: groupData.isPrivate || false,
      maxMembers: groupData.maxMembers,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [],
      conversations: [],
    };
    return this.mockRequest(newGroup);
  }

  async updateGroup(id: string, groupData: Partial<Group>) {
    const group = mockGroups.find(g => g.id === id);
    if (!group) {
      throw new Error('404: Group not found');
    }
    const updatedGroup = { ...group, ...groupData, updatedAt: new Date() };
    return this.mockRequest(updatedGroup);
  }

  async deleteGroup(id: string) {
    const groupIndex = mockGroups.findIndex(g => g.id === id);
    if (groupIndex === -1) {
      throw new Error('404: Group not found');
    }
    return this.mockRequest(undefined);
  }

  async getGroupMembers(id: string) {
    const group = mockGroups.find(g => g.id === id);
    if (!group) {
      throw new Error('404: Group not found');
    }
    return this.mockRequest(group.members);
  }

  async inviteMember(groupId: string, memberData: { userId: string; role?: 'ADMIN' | 'MEMBER' }) {
    const user = mockUsers.find(u => u.id === memberData.userId);
    if (!user) {
      throw new Error('404: User not found');
    }

    const newMember: GroupMember = {
      id: `member-${Date.now()}`,
      userId: memberData.userId,
      groupId,
      role: memberData.role || 'MEMBER',
      joinedAt: new Date(),
      user,
    };

    return this.mockRequest(newMember);
  }

  async updateMemberRole(groupId: string, memberId: string, role: 'ADMIN' | 'MEMBER') {
    const member = mockGroupMembers.find(m => m.id === memberId && m.groupId === groupId);
    if (!member) {
      throw new Error('404: Member not found');
    }
    const updatedMember = { ...member, role };
    return this.mockRequest(updatedMember);
  }

  async removeMember(groupId: string, memberId: string) {
    const memberIndex = mockGroupMembers.findIndex(m => m.id === memberId && m.groupId === groupId);
    if (memberIndex === -1) {
      throw new Error('404: Member not found');
    }
    return this.mockRequest(undefined);
  }

  async searchUsers(query: string) {
    const filteredUsers = mockUsers.filter(user =>
      user.username.toLowerCase().includes(query.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(query.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(query.toLowerCase()) ||
      user.email.toLowerCase().includes(query.toLowerCase())
    );
    return this.mockRequest(filteredUsers);
  }

  async generateInviteLink(groupId: string) {
    return this.mockRequest({
      link: `https://app.meeshy.com/join/${groupId}/abc123`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  async joinGroupByInvite(inviteCode: string) {
    const group = mockGroups[0]; // Simuler qu'on rejoint le premier groupe
    const member = mockGroupMembers[0];
    return this.mockRequest({ group, member });
  }
}

export const mockApiService = new MockApiService();
