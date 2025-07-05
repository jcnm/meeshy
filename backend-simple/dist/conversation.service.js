"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const uuid_1 = require("uuid");
class ConversationService {
    constructor() {
        this.conversationLinks = new Map();
        this.conversations = new Map();
        this.messages = new Map();
    }
    createConversationLink(createdBy, expiresInHours = 24 * 7) {
        const link = {
            id: (0, uuid_1.v4)(),
            createdBy,
            participants: [createdBy],
            isActive: true,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        };
        this.conversationLinks.set(link.id, link);
        console.log(`📎 Lien de conversation créé: ${link.id} par ${createdBy}`);
        return link;
    }
    getConversationLink(linkId) {
        const link = this.conversationLinks.get(linkId);
        if (link && (!link.expiresAt || link.expiresAt > new Date())) {
            return link;
        }
        return undefined;
    }
    joinConversationViaLink(linkId, userId) {
        const link = this.getConversationLink(linkId);
        if (!link || !link.isActive) {
            return null;
        }
        if (!link.participants.includes(userId)) {
            link.participants.push(userId);
        }
        let conversation = this.getConversationByLinkId(linkId);
        if (!conversation) {
            conversation = {
                id: (0, uuid_1.v4)(),
                linkId,
                participants: [userId],
                messages: [],
                createdAt: new Date(),
                lastMessageAt: new Date(),
            };
            this.conversations.set(conversation.id, conversation);
            this.messages.set(conversation.id, []);
        }
        else if (!conversation.participants.includes(userId)) {
            conversation.participants.push(userId);
        }
        console.log(`👥 Utilisateur ${userId} a rejoint la conversation ${conversation.id}`);
        return conversation;
    }
    getConversationByLinkId(linkId) {
        return Array.from(this.conversations.values()).find(conv => conv.linkId === linkId);
    }
    getUserConversations(userId) {
        return Array.from(this.conversations.values()).filter(conv => conv.participants.includes(userId));
    }
    addMessage(conversationId, senderId, content, originalLanguage) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation || !conversation.participants.includes(senderId)) {
            return null;
        }
        const message = {
            id: (0, uuid_1.v4)(),
            conversationId,
            senderId,
            content,
            timestamp: new Date(),
            originalLanguage,
        };
        const messages = this.messages.get(conversationId) || [];
        messages.push(message);
        this.messages.set(conversationId, messages);
        conversation.lastMessageAt = new Date();
        console.log(`💬 Message ajouté à la conversation ${conversationId}`);
        return message;
    }
    getConversationMessages(conversationId, userId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation || !conversation.participants.includes(userId)) {
            return [];
        }
        return this.messages.get(conversationId) || [];
    }
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    }
    deactivateConversationLink(linkId, userId) {
        const link = this.conversationLinks.get(linkId);
        if (!link || link.createdBy !== userId) {
            return false;
        }
        link.isActive = false;
        console.log(`🔒 Lien de conversation ${linkId} désactivé`);
        return true;
    }
    getUserConversationLinks(userId) {
        return Array.from(this.conversationLinks.values()).filter(link => link.createdBy === userId);
    }
    cleanupExpiredLinks() {
        const now = new Date();
        let cleaned = 0;
        for (const [id, link] of this.conversationLinks.entries()) {
            if (link.expiresAt && link.expiresAt < now) {
                this.conversationLinks.delete(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 ${cleaned} liens de conversation expirés supprimés`);
        }
        return cleaned;
    }
}
exports.ConversationService = ConversationService;
//# sourceMappingURL=conversation.service.js.map