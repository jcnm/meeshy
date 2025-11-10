/**
 * Platform Types - Core types for platform abstraction
 */

import type { Message, Conversation, ConversationParticipant } from './index'

// ===== PLATFORM CAPABILITIES =====

export interface PlatformCapabilities {
  // Message operations
  canRetrieveMessages: boolean
  canPublishMessages: boolean
  canEditMessages: boolean
  canDeleteMessages: boolean
  canReplyToMessages: boolean

  // Real-time features
  supportsRealtime: boolean
  supportsWebSocket: boolean
  supportsWebhooks: boolean

  // Search & discovery
  supportsSearch: boolean
  supportsMessageHistory: boolean

  // Media support
  supportsAttachments: boolean
  supportsImages: boolean
  supportsVideos: boolean
  supportsAudio: boolean

  // Advanced features
  supportsReactions: boolean
  supportsThreads: boolean
  supportsPolls: boolean

  // Rate limits
  rateLimit?: {
    messagesPerMinute: number
    messagesPerHour: number
    messagesPerDay: number
  }
}

// ===== RETRIEVE OPTIONS =====

export interface RetrieveMessagesOptions {
  // Pagination
  limit?: number
  offset?: number
  before?: Date
  after?: Date

  // Filtering
  fromUser?: string
  messageType?: string
  hasAttachments?: boolean

  // Sorting
  sortOrder?: 'asc' | 'desc'

  // Include related data
  includeTranslations?: boolean
  includeReactions?: boolean
  includeReplies?: boolean
}

export interface RetrieveMessagesResult {
  messages: Message[]
  hasMore: boolean
  total?: number
  nextCursor?: string
}

// ===== PUBLISH OPTIONS =====

export interface PublishMessageOptions {
  content: string
  language?: string
  messageType?: 'text' | 'image' | 'file' | 'audio' | 'video'

  // Threading
  replyToId?: string
  threadId?: string

  // Attachments
  attachments?: PlatformMessageAttachment[]

  // Formatting
  markdown?: boolean
  mentions?: string[]

  // Metadata
  metadata?: Record<string, unknown>
}

export interface PlatformMessageAttachment {
  type: 'image' | 'file' | 'audio' | 'video'
  url?: string
  path?: string
  filename: string
  mimeType?: string
  size?: number
}

export interface PublishMessageResult {
  messageId: string
  timestamp: Date
  success: boolean
  error?: string
}

// ===== EDIT/DELETE OPTIONS =====

export interface EditMessageOptions {
  newContent: string
  preserveHistory?: boolean
}

export interface DeleteMessageOptions {
  reason?: string
  soft?: boolean  // Soft delete vs hard delete
}

// ===== CONVERSATION INFO =====

export interface ConversationInfo {
  id: string
  identifier?: string
  title: string
  description?: string
  type: 'direct' | 'group' | 'public' | 'broadcast'
  memberCount: number
  createdAt: Date
  lastActivity?: Date
  metadata?: Record<string, unknown>
}

// ===== SEARCH =====

export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  filters?: SearchFilters
}

export interface SearchFilters {
  fromUser?: string
  dateRange?: {
    start: Date
    end: Date
  }
  messageType?: string
  hasAttachments?: boolean
}

export interface SearchResult {
  message: Message
  score: number
  highlights?: string[]
}

export interface SearchResults {
  results: SearchResult[]
  total: number
  hasMore: boolean
}

// ===== REAL-TIME SUBSCRIPTIONS =====

export type MessageCallback = (message: Message) => void | Promise<void>
export type EventCallback = (event: PlatformEvent) => void | Promise<void>

export interface Subscription {
  unsubscribe: () => void
  isActive: () => boolean
}

export type PlatformEvent =
  | { type: 'message:new'; message: Message }
  | { type: 'message:edit'; messageId: string; newContent: string }
  | { type: 'message:delete'; messageId: string }
  | { type: 'user:join'; userId: string; conversationId: string }
  | { type: 'user:leave'; userId: string; conversationId: string }
  | { type: 'user:typing'; userId: string; conversationId: string }
  | { type: 'reaction:add'; messageId: string; userId: string; emoji: string }
  | { type: 'reaction:remove'; messageId: string; userId: string; emoji: string }

// ===== PLATFORM ADAPTER INTERFACE =====

export interface PlatformAdapter {
  // Identity
  readonly platformName: string
  readonly platformVersion: string

  // Initialization
  initialize(): Promise<void>
  shutdown(): Promise<void>
  isConnected(): boolean

  // Message operations
  retrieveMessages(
    conversationId: string,
    options?: RetrieveMessagesOptions
  ): Promise<RetrieveMessagesResult>

  publishMessage(
    conversationId: string,
    options: PublishMessageOptions
  ): Promise<PublishMessageResult>

  editMessage(
    messageId: string,
    options: EditMessageOptions
  ): Promise<void>

  deleteMessage(
    messageId: string,
    options?: DeleteMessageOptions
  ): Promise<void>

  // Conversation operations
  getConversationInfo(conversationId: string): Promise<ConversationInfo>

  getParticipants(conversationId: string): Promise<ConversationParticipant[]>

  // Search & discovery
  searchMessages(
    conversationId: string,
    options: SearchOptions
  ): Promise<SearchResults>

  // Real-time operations (optional)
  subscribeToMessages?(
    conversationId: string,
    callback: MessageCallback
  ): Promise<Subscription>

  subscribeToEvents?(
    conversationId: string,
    callback: EventCallback
  ): Promise<Subscription>

  // Capabilities
  getCapabilities(): PlatformCapabilities

  // Health check
  healthCheck(): Promise<PlatformHealthStatus>
}

export interface PlatformHealthStatus {
  healthy: boolean
  latency?: number  // ms
  lastCheck: Date
  error?: string
}
