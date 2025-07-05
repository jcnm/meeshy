"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const uuid_1 = require("uuid");
class UserService {
    constructor() {
        this.users = new Map();
        this.usersByEmail = new Map();
        this.usersByPhone = new Map();
        this.onlineUsers = new Set();
        this.initializeUsers();
    }
    initializeUsers() {
        const predefinedUsers = [
            {
                id: '1',
                username: 'Alice Martin',
                firstName: 'Alice',
                lastName: 'Martin',
                email: 'alice.martin@email.com',
                phoneNumber: '+33123456789',
                systemLanguage: 'fr',
                regionalLanguage: 'fr',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: false,
                createdAt: new Date('2024-01-01'),
                lastActiveAt: new Date(),
            },
            {
                id: '2',
                username: 'Bob Johnson',
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob.johnson@email.com',
                phoneNumber: '+1234567890',
                systemLanguage: 'en',
                regionalLanguage: 'en',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: false,
                createdAt: new Date('2024-01-02'),
                lastActiveAt: new Date(),
            },
            {
                id: '3',
                username: 'Carlos Rodriguez',
                firstName: 'Carlos',
                lastName: 'Rodriguez',
                email: 'carlos.rodriguez@email.com',
                phoneNumber: '+34987654321',
                systemLanguage: 'es',
                regionalLanguage: 'es',
                customDestinationLanguage: 'en',
                autoTranslateEnabled: true,
                translateToSystemLanguage: false,
                translateToRegionalLanguage: false,
                useCustomDestination: true,
                isOnline: false,
                createdAt: new Date('2024-01-03'),
                lastActiveAt: new Date(),
            },
            {
                id: '4',
                username: 'Diana Weber',
                firstName: 'Diana',
                lastName: 'Weber',
                email: 'diana.weber@email.com',
                phoneNumber: '+49123456789',
                systemLanguage: 'de',
                regionalLanguage: 'de',
                autoTranslateEnabled: false,
                translateToSystemLanguage: false,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: false,
                createdAt: new Date('2024-01-04'),
                lastActiveAt: new Date(),
            },
            {
                id: '5',
                username: 'Erik Andersson',
                firstName: 'Erik',
                lastName: 'Andersson',
                email: 'erik.andersson@email.com',
                phoneNumber: '+46123456789',
                systemLanguage: 'sv',
                regionalLanguage: 'sv',
                customDestinationLanguage: 'en',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: false,
                createdAt: new Date('2024-01-05'),
                lastActiveAt: new Date(),
            },
        ];
        predefinedUsers.forEach(user => {
            this.users.set(user.id, user);
            this.usersByEmail.set(user.email, user.id);
            this.usersByPhone.set(user.phoneNumber, user.id);
        });
        console.log(`👤 ${predefinedUsers.length} utilisateurs prédéfinis initialisés`);
    }
    getAllUsers() {
        return Array.from(this.users.values());
    }
    getUserById(id) {
        return this.users.get(id);
    }
    getUserByEmail(email) {
        const userId = this.usersByEmail.get(email);
        return userId ? this.users.get(userId) : undefined;
    }
    getUserByPhone(phoneNumber) {
        const userId = this.usersByPhone.get(phoneNumber);
        return userId ? this.users.get(userId) : undefined;
    }
    findExistingUser(email, phoneNumber) {
        const userByEmail = this.getUserByEmail(email);
        const userByPhone = this.getUserByPhone(phoneNumber);
        return userByEmail || userByPhone;
    }
    createUser(userData) {
        const userId = (0, uuid_1.v4)();
        const now = new Date();
        const user = {
            id: userId,
            username: `${userData.firstName} ${userData.lastName}`,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phoneNumber: userData.phoneNumber,
            systemLanguage: userData.spokenLanguage,
            regionalLanguage: userData.spokenLanguage,
            customDestinationLanguage: userData.receiveLanguage !== userData.spokenLanguage ? userData.receiveLanguage : undefined,
            autoTranslateEnabled: userData.receiveLanguage !== userData.spokenLanguage,
            translateToSystemLanguage: userData.receiveLanguage === userData.spokenLanguage,
            translateToRegionalLanguage: false,
            useCustomDestination: userData.receiveLanguage !== userData.spokenLanguage,
            isOnline: false,
            createdAt: now,
            lastActiveAt: now,
        };
        this.users.set(userId, user);
        this.usersByEmail.set(userData.email, userId);
        this.usersByPhone.set(userData.phoneNumber, userId);
        console.log(`👤 Nouvel utilisateur créé: ${user.username} (${user.id})`);
        return user;
    }
    setUserOnline(userId) {
        const user = this.users.get(userId);
        if (!user)
            return false;
        this.onlineUsers.add(userId);
        user.isOnline = true;
        user.lastActiveAt = new Date();
        return true;
    }
    setUserOffline(userId) {
        const user = this.users.get(userId);
        if (!user)
            return false;
        this.onlineUsers.delete(userId);
        user.isOnline = false;
        return true;
    }
    getOnlineUsers() {
        return Array.from(this.onlineUsers)
            .map(id => this.users.get(id))
            .filter((user) => user !== undefined);
    }
    isUserOnline(userId) {
        return this.onlineUsers.has(userId);
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map