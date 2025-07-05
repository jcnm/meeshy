import { ConversationLink, Conversation, Message } from './types';
export declare class ConversationService {
    private conversationLinks;
    private conversations;
    private messages;
    constructor();
    createConversationLink(createdBy: string, expiresInHours?: number): ConversationLink;
    getConversationLink(linkId: string): ConversationLink | undefined;
    joinConversationViaLink(linkId: string, userId: string): Conversation | null;
    getConversationByLinkId(linkId: string): Conversation | undefined;
    getUserConversations(userId: string): Conversation[];
    addMessage(conversationId: string, senderId: string, content: string, originalLanguage: string): Message | null;
    getConversationMessages(conversationId: string, userId: string): Message[];
    getConversation(conversationId: string): Conversation | undefined;
    deactivateConversationLink(linkId: string, userId: string): boolean;
    getUserConversationLinks(userId: string): ConversationLink[];
    cleanupExpiredLinks(): number;
}
//# sourceMappingURL=conversation.service.d.ts.map