/**
 * Meeshy API Adapter - Direct API Gateway integration
 *
 * Communicates with gate.meeshy.me API directly using HTTP requests.
 * Provides real-time capabilities and full API access.
 */

import type {
  PlatformAdapter,
  PlatformCapabilities,
  RetrieveMessagesOptions,
  RetrieveMessagesResult,
  PublishMessageOptions,
  PublishMessageResult,
  EditMessageOptions,
  DeleteMessageOptions,
  ConversationInfo,
  SearchOptions,
  SearchResults,
  PlatformHealthStatus,
  MessageCallback,
  EventCallback,
  Subscription,
} from '../../types/platform'
import type { Message, ConversationParticipant } from '../../types'
import { logger } from '../../utils/logger'
import {
  PlatformError,
  NetworkError,
  AuthenticationError,
  withRetry
} from '../../utils/errors'

export interface MeeshyAPIConfig {
  apiUrl: string
  username: string
  password: string
  connectTimeout?: number
  maxTimeout?: number
  maxRetries?: number
}

interface AuthResponse {
  success: boolean
  data: {
    token: string
    user: {
      id: string
      username: string
    }
  }
}

interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export class MeeshyAPIAdapter implements PlatformAdapter {
  readonly platformName = 'Meeshy'
  readonly platformVersion = '1.0.0'

  private config: Required<MeeshyAPIConfig>
  private token: string | null = null
  private userId: string | null = null
  private connected = false
  private log = logger.child({ adapter: 'MeeshyAPI' })

  constructor(config: MeeshyAPIConfig) {
    this.config = {
      apiUrl: config.apiUrl,
      username: config.username,
      password: config.password,
      connectTimeout: config.connectTimeout ?? 10000,
      maxTimeout: config.maxTimeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
    }

    this.log.info('MeeshyAPIAdapter initialized', {
      apiUrl: this.config.apiUrl,
      username: this.config.username,
    })
  }

  // ===== INITIALIZATION =====

  async initialize(): Promise<void> {
    this.log.info('Initializing Meeshy API adapter...')

    try {
      await this.authenticate()
      this.connected = true
      this.log.info('Meeshy API adapter initialized successfully')
    } catch (error) {
      this.log.error('Failed to initialize Meeshy API adapter', error as Error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    this.log.info('Shutting down Meeshy API adapter...')
    this.token = null
    this.userId = null
    this.connected = false
    this.log.info('Meeshy API adapter shut down')
  }

  isConnected(): boolean {
    return this.connected && this.token !== null
  }

  // ===== AUTHENTICATION =====

  private async authenticate(): Promise<void> {
    this.log.info('Authenticating with Meeshy API...')

    const response = await this.request<AuthResponse['data']>('/api/auth/login', {
      method: 'POST',
      body: {
        username: this.config.username,
        password: this.config.password,
      },
    })

    if (!response.success || !response.data?.token || !response.data?.user) {
      throw new AuthenticationError('Authentication failed: No token or user data received')
    }

    this.token = response.data.token
    this.userId = response.data.user.id

    this.log.info('Authentication successful', {
      userId: this.userId ?? 'unknown',
      username: this.config.username,
    })
  }

  // ===== MESSAGE OPERATIONS =====

  async retrieveMessages(
    conversationId: string,
    options: RetrieveMessagesOptions = {}
  ): Promise<RetrieveMessagesResult> {
    this.log.debug('Retrieving messages', {
      conversationId,
      limit: options.limit,
      offset: options.offset,
      before: options.before?.toISOString(),
      after: options.after?.toISOString(),
    })

    const params: Record<string, string> = {}

    if (options.limit) params.limit = String(options.limit)
    if (options.offset) params.offset = String(options.offset)
    if (options.sortOrder) params.sort = options.sortOrder

    const queryString = new URLSearchParams(params).toString()
    const url = `/api/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`

    const response = await this.request<{
      messages: Array<Record<string, unknown>>
      hasMore: boolean
      total?: number
    }>(url, {
      method: 'GET',
      requiresAuth: true,
    })

    if (!response.success || !response.data) {
      throw new PlatformError(
        'Failed to retrieve messages',
        this.platformName,
        true,
        { conversationId }
      )
    }

    // Transform messages to our Message type
    const messages = response.data.messages.map(msg => this.transformMessage(msg, conversationId))

    this.log.info('Messages retrieved successfully', {
      conversationId,
      count: messages.length,
      hasMore: response.data.hasMore,
    })

    return {
      messages,
      hasMore: response.data.hasMore,
      total: response.data.total,
    }
  }

  async publishMessage(
    conversationId: string,
    options: PublishMessageOptions
  ): Promise<PublishMessageResult> {
    this.log.debug('Publishing message', {
      conversationId,
      contentLength: options.content?.length,
      language: options.language,
      messageType: options.messageType,
      hasReply: Boolean(options.replyToId),
    })

    const body: Record<string, unknown> = {
      content: options.content,
      originalLanguage: options.language || 'en',
      messageType: options.messageType || 'text',
    }

    if (options.replyToId) {
      body.replyToId = options.replyToId
    }

    if (options.metadata) {
      body.metadata = options.metadata
    }

    const response = await this.request<{
      id: string
      createdAt: string
    }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body,
      requiresAuth: true,
    })

    if (!response.success || !response.data) {
      throw new PlatformError(
        'Failed to publish message',
        this.platformName,
        true,
        { conversationId }
      )
    }

    this.log.info('Message published successfully', {
      conversationId,
      messageId: response.data.id,
    })

    return {
      messageId: response.data.id,
      timestamp: new Date(response.data.createdAt),
      success: true,
    }
  }

  async editMessage(
    messageId: string,
    options: EditMessageOptions
  ): Promise<void> {
    this.log.debug('Editing message', {
      messageId,
      newContentLength: options.newContent?.length,
    })

    const response = await this.request<void>(`/api/messages/${messageId}`, {
      method: 'PATCH',
      body: {
        content: options.newContent,
      },
      requiresAuth: true,
    })

    if (!response.success) {
      throw new PlatformError(
        'Failed to edit message',
        this.platformName,
        true,
        { messageId }
      )
    }

    this.log.info('Message edited successfully', { messageId })
  }

  async deleteMessage(
    messageId: string,
    options: DeleteMessageOptions = {}
  ): Promise<void> {
    this.log.debug('Deleting message', {
      messageId,
      reason: options.reason,
    })

    const response = await this.request<void>(`/api/messages/${messageId}`, {
      method: 'DELETE',
      requiresAuth: true,
    })

    if (!response.success) {
      throw new PlatformError(
        'Failed to delete message',
        this.platformName,
        true,
        { messageId }
      )
    }

    this.log.info('Message deleted successfully', { messageId })
  }

  // ===== CONVERSATION OPERATIONS =====

  async getConversationInfo(conversationId: string): Promise<ConversationInfo> {
    this.log.debug('Getting conversation info', { conversationId })

    const response = await this.request<Record<string, unknown>>(
      `/api/conversations/${conversationId}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    )

    if (!response.success || !response.data) {
      throw new PlatformError(
        'Failed to get conversation info',
        this.platformName,
        true,
        { conversationId }
      )
    }

    const data = response.data

    return {
      id: String(data.id),
      identifier: data.identifier as string | undefined,
      title: String(data.title || data.identifier || conversationId),
      description: data.description as string | undefined,
      type: (data.type as 'direct' | 'group' | 'public' | 'broadcast') || 'group',
      memberCount: Number(data.memberCount || 0),
      createdAt: new Date(String(data.createdAt)),
      lastActivity: data.lastActivity ? new Date(String(data.lastActivity)) : undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    }
  }

  async getParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    this.log.debug('Getting participants', { conversationId })

    const response = await this.request<Array<Record<string, unknown>>>(
      `/api/conversations/${conversationId}/participants`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    )

    if (!response.success || !response.data) {
      throw new PlatformError(
        'Failed to get participants',
        this.platformName,
        true,
        { conversationId }
      )
    }

    return response.data.map(p => {
      const participant = p as Record<string, any>
      return {
        userId: String(participant.userId),
        username: String(participant.username || participant.user?.username),
        displayName: participant.displayName as string | undefined,
        role: (participant.role as 'admin' | 'moderator' | 'member') || 'member',
        joinedAt: new Date(String(participant.joinedAt)),
        isActive: Boolean(participant.isActive ?? true),
      }
    })
  }

  // ===== SEARCH =====

  async searchMessages(
    conversationId: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    this.log.debug('Searching messages', {
      conversationId,
      query: options.query,
      limit: options.limit,
      offset: options.offset,
    })

    const params: Record<string, string> = {
      q: options.query,
    }

    if (options.limit) params.limit = String(options.limit)
    if (options.offset) params.offset = String(options.offset)

    const queryString = new URLSearchParams(params).toString()
    const url = `/api/conversations/${conversationId}/messages/search?${queryString}`

    const response = await this.request<{
      results: Array<Record<string, unknown>>
      total: number
      hasMore: boolean
    }>(url, {
      method: 'GET',
      requiresAuth: true,
    })

    if (!response.success || !response.data) {
      throw new PlatformError(
        'Failed to search messages',
        this.platformName,
        true,
        { conversationId, query: options.query }
      )
    }

    return {
      results: response.data.results.map(r => ({
        message: this.transformMessage(r, conversationId),
        score: Number(r.score || 1),
        highlights: r.highlights as string[] | undefined,
      })),
      total: response.data.total,
      hasMore: response.data.hasMore,
    }
  }

  // ===== CAPABILITIES =====

  getCapabilities(): PlatformCapabilities {
    return {
      canRetrieveMessages: true,
      canPublishMessages: true,
      canEditMessages: true,
      canDeleteMessages: true,
      canReplyToMessages: true,
      supportsRealtime: true,
      supportsWebSocket: true,
      supportsWebhooks: false,
      supportsSearch: true,
      supportsMessageHistory: true,
      supportsAttachments: true,
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: true,
      supportsReactions: true,
      supportsThreads: true,
      supportsPolls: false,
      rateLimit: {
        messagesPerMinute: 10,
        messagesPerHour: 100,
        messagesPerDay: 1000,
      },
    }
  }

  // ===== HEALTH CHECK =====

  async healthCheck(): Promise<PlatformHealthStatus> {
    const startTime = Date.now()

    try {
      await this.request<unknown>('/api/health', {
        method: 'GET',
        requiresAuth: false,
      })

      const latency = Date.now() - startTime

      return {
        healthy: true,
        latency,
        lastCheck: new Date(),
      }
    } catch (error) {
      return {
        healthy: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // ===== PRIVATE HELPERS =====

  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
      body?: unknown
      requiresAuth?: boolean
    }
  ): Promise<APIResponse<T>> {
    const url = `${this.config.apiUrl}${path}`

    return withRetry(
      async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': `AAMS/${this.platformVersion}`,
        }

        if (options.requiresAuth && this.token) {
          headers['Authorization'] = `Bearer ${this.token}`
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), this.config.maxTimeout)

        try {
          const response = await fetch(url, {
            method: options.method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal,
          })

          clearTimeout(timeout)

          const data = await response.json() as APIResponse<T>

          if (!response.ok) {
            throw new NetworkError(
              data.error || data.message || `HTTP ${response.status}`,
              response.status
            )
          }

          return data
        } catch (error) {
          clearTimeout(timeout)
          throw error
        }
      },
      {
        maxRetries: this.config.maxRetries,
        shouldRetry: (error) => {
          if (error instanceof AuthenticationError) return false
          if (error instanceof NetworkError && error.statusCode === 404) return false
          return true
        },
      }
    )
  }

  private transformMessage(data: Record<string, unknown>, conversationId: string): Message {
    const sender = data.sender as Record<string, unknown> | undefined
    const anonymousSender = data.anonymousSender as Record<string, unknown> | undefined

    return {
      id: String(data.id),
      conversationId,
      senderId: sender?.id as string | undefined,
      anonymousSenderId: anonymousSender?.id as string | undefined,
      content: String(data.content),
      originalLanguage: String(data.originalLanguage || 'en'),
      messageType: (data.messageType as 'text') || 'text',
      isEdited: Boolean(data.isEdited),
      isDeleted: Boolean(data.isDeleted),
      createdAt: new Date(String(data.createdAt)),
      updatedAt: data.updatedAt ? new Date(String(data.updatedAt)) : undefined,
      timestamp: new Date(String(data.createdAt)),
      sender: sender ? {
        id: String(sender.id),
        username: String(sender.username),
        firstName: sender.firstName as string | undefined,
        lastName: sender.lastName as string | undefined,
        displayName: sender.displayName as string | undefined,
      } : undefined,
    }
  }
}
