export interface User {
    id: string;
    username: string;
    email: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    systemLanguage: string;
    regionalLanguage: string;
    customDestinationLanguage?: string;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
    isOnline: boolean;
    createdAt: Date;
    lastActiveAt: Date;
}
export interface CreateUserDto {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    spokenLanguage: string;
    receiveLanguage: string;
    conversationLinkId: string;
}
export interface ConversationLink {
    id: string;
    createdBy: string;
    participants: string[];
    isActive: boolean;
    createdAt: Date;
    expiresAt?: Date;
}
export interface Conversation {
    id: string;
    linkId: string;
    participants: string[];
    messages: Message[];
    createdAt: Date;
    lastMessageAt: Date;
}
export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    timestamp: Date;
    originalLanguage: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface JoinConversationResponse {
    user: User;
    conversation: Conversation;
    isNewUser: boolean;
    existingUserFound?: boolean;
}
//# sourceMappingURL=types.d.ts.map