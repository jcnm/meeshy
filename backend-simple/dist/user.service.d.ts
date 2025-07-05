import { User, CreateUserDto } from './types';
export declare class UserService {
    private users;
    private usersByEmail;
    private usersByPhone;
    private onlineUsers;
    constructor();
    private initializeUsers;
    getAllUsers(): User[];
    getUserById(id: string): User | undefined;
    getUserByEmail(email: string): User | undefined;
    getUserByPhone(phoneNumber: string): User | undefined;
    findExistingUser(email: string, phoneNumber: string): User | undefined;
    createUser(userData: CreateUserDto): User;
    setUserOnline(userId: string): boolean;
    setUserOffline(userId: string): boolean;
    getOnlineUsers(): User[];
    isUserOnline(userId: string): boolean;
}
//# sourceMappingURL=user.service.d.ts.map