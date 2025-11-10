/**
 * Meeshy CLI Adapter - Shell script integration (mmr.sh / mmp.sh)
 *
 * Communicates with Meeshy platform using existing shell scripts.
 * Provides fallback when direct API access is not available.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
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
} from '../../types/platform'
import type { Message, ConversationParticipant } from '../../types'
import { logger } from '../../utils/logger'
import { PlatformError, withRetry } from '../../utils/errors'

const execAsync = promisify(exec)

export interface MeeshyCLIConfig {
  username: string
  password: string
  apiUrl?: string
  frontendUrl?: string
  scriptsPath?: string
  maxRetries?: number
}

export class MeeshyCLIAdapter implements PlatformAdapter {
  readonly platformName = 'Meeshy'
  readonly platformVersion = '1.0.0-cli'

  private config: Required<MeeshyCLIConfig>
  private mmrPath: string
  private mmpPath: string
  private connected = false
  private log = logger.child({ adapter: 'MeeshyCLI' })

  constructor(config: MeeshyCLIConfig) {
    const scriptsPath = config.scriptsPath || path.resolve(process.cwd(), '../scripts')

    this.config = {
      username: config.username,
      password: config.password,
      apiUrl: config.apiUrl || 'https://gate.meeshy.me',
      frontendUrl: config.frontendUrl || 'https://meeshy.me',
      scriptsPath,
      maxRetries: config.maxRetries || 3,
    }

    this.mmrPath = path.join(this.config.scriptsPath, 'mmr.sh')
    this.mmpPath = path.join(this.config.scriptsPath, 'mmp.sh')

    this.log.info('MeeshyCLIAdapter initialized', {
      username: this.config.username,
      scriptsPath: this.config.scriptsPath,
    })
  }

  // ===== INITIALIZATION =====

  async initialize(): Promise<void> {
    this.log.info('Initializing Meeshy CLI adapter...')

    try {
      // Test connection with a simple message retrieval
      await this.testConnection()
      this.connected = true
      this.log.info('Meeshy CLI adapter initialized successfully')
    } catch (error) {
      this.log.error('Failed to initialize Meeshy CLI adapter', error as Error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    this.log.info('Shutting down Meeshy CLI adapter...')
    this.connected = false
    this.log.info('Meeshy CLI adapter shut down')
  }

  isConnected(): boolean {
    return this.connected
  }

  // ===== MESSAGE OPERATIONS =====

  async retrieveMessages(
    conversationId: string,
    options: RetrieveMessagesOptions = {}
  ): Promise<RetrieveMessagesResult> {
    this.log.debug('Retrieving messages via CLI', {
      conversationId,
      limit: options.limit,
      offset: options.offset,
      before: options.before?.toISOString(),
      after: options.after?.toISOString(),
    })

    const args: string[] = []

    // Authentication
    args.push(`-u "${this.config.username}"`)
    args.push(`-p "${this.config.password}"`)
    args.push(`-c "${conversationId}"`)
    args.push(`-a "${this.config.apiUrl}"`)

    // Filter options
    if (options.limit) {
      args.push(`-n ${options.limit}`)
    } else if (options.before || options.after) {
      // Convert date range to time filter
      const now = new Date()
      const target = options.after || options.before!
      const diff = Math.abs(now.getTime() - target.getTime())
      const hours = Math.ceil(diff / (1000 * 60 * 60))
      args.push(`-t ${hours}h`)
    }

    // Always use AI format for structured JSON output
    args.push('-f ai')

    // Build command
    const command = `bash "${this.mmrPath}" ${args.join(' ')}`

    try {
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          MEESHY_PASSWORD: this.config.password,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      if (stderr && !stderr.includes('[INFO]') && !stderr.includes('[SUCCESS]')) {
        this.log.warn('MMR stderr output', { stderr })
      }

      const messages = this.parseMessages(stdout, conversationId)

      this.log.info('Messages retrieved successfully', {
        conversationId,
        count: messages.length,
      })

      return {
        messages,
        hasMore: false, // CLI doesn't support pagination indicators
        total: messages.length,
      }
    } catch (error) {
      this.log.error('Failed to retrieve messages', error as Error, { conversationId })
      throw new PlatformError(
        'Failed to retrieve messages via CLI',
        this.platformName,
        true,
        { conversationId, error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async publishMessage(
    conversationId: string,
    options: PublishMessageOptions
  ): Promise<PublishMessageResult> {
    this.log.debug('Publishing message via CLI', {
      conversationId,
      contentLength: options.content?.length,
      language: options.language,
      messageType: options.messageType,
      hasReply: Boolean(options.replyToId),
    })

    const args: string[] = []

    // Authentication
    args.push(`-u "${this.config.username}"`)
    args.push(`-p "${this.config.password}"`)
    args.push(`-c "${conversationId}"`)
    args.push(`-a "${this.config.apiUrl}"`)

    // Language
    if (options.language) {
      args.push(`-l "${options.language}"`)
    }

    // Options
    args.push('-y')  // Skip confirmation
    args.push('--no-backup')
    args.push('--no-cleanup')

    // Escape message content
    const escapedContent = options.content.replace(/"/g, '\\"').replace(/\n/g, '\\n')
    args.push(`"${escapedContent}"`)

    // Build command
    const command = `bash "${this.mmpPath}" ${args.join(' ')}`

    try {
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          MEESHY_PASSWORD: this.config.password,
        },
        maxBuffer: 1024 * 1024, // 1MB
      })

      if (stderr && !stderr.includes('[INFO]') && !stderr.includes('[SUCCESS]')) {
        this.log.warn('MMP stderr output', { stderr })
      }

      // Check for success
      if (!stdout.includes('Publication successful') && !stdout.includes('[SUCCESS]')) {
        throw new Error('Message publication may have failed')
      }

      this.log.info('Message published successfully', { conversationId })

      return {
        messageId: `msg_${Date.now()}`, // CLI doesn't return message ID
        timestamp: new Date(),
        success: true,
      }
    } catch (error) {
      this.log.error('Failed to publish message', error as Error, { conversationId })
      throw new PlatformError(
        'Failed to publish message via CLI',
        this.platformName,
        true,
        { conversationId, error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async editMessage(
    messageId: string,
    options: EditMessageOptions
  ): Promise<void> {
    throw new PlatformError(
      'Message editing not supported via CLI adapter',
      this.platformName,
      false,
      { messageId }
    )
  }

  async deleteMessage(
    messageId: string,
    options: DeleteMessageOptions = {}
  ): Promise<void> {
    throw new PlatformError(
      'Message deletion not supported via CLI adapter',
      this.platformName,
      false,
      { messageId }
    )
  }

  // ===== CONVERSATION OPERATIONS =====

  async getConversationInfo(conversationId: string): Promise<ConversationInfo> {
    this.log.debug('Getting conversation info', { conversationId })

    // Get info from verbose MMR output
    const args = [
      `-u "${this.config.username}"`,
      `-p "${this.config.password}"`,
      `-c "${conversationId}"`,
      `-a "${this.config.apiUrl}"`,
      '-n 1',
      '-v',
    ]

    const command = `bash "${this.mmrPath}" ${args.join(' ')} 2>&1`

    try {
      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          MEESHY_PASSWORD: this.config.password,
        },
      })

      // Parse conversation info from output
      // Format: "Conversation: <title> (type: <type>, members: <count>)"
      const match = stdout.match(/Conversation:\s*([^(]+)\s*\(type:\s*(\w+),\s*members:\s*(\d+)\)/)

      if (match) {
        return {
          id: conversationId,
          title: match[1].trim(),
          type: (match[2] as 'direct' | 'group' | 'public' | 'broadcast') || 'group',
          memberCount: parseInt(match[3], 10),
          createdAt: new Date(), // Not available from CLI
        }
      }

      // Fallback
      return {
        id: conversationId,
        title: conversationId,
        type: 'group',
        memberCount: 0,
        createdAt: new Date(),
      }
    } catch (error) {
      this.log.error('Failed to get conversation info', error as Error, { conversationId })
      throw new PlatformError(
        'Failed to get conversation info via CLI',
        this.platformName,
        true,
        { conversationId }
      )
    }
  }

  async getParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    // CLI doesn't provide participant details
    this.log.warn('Participant retrieval not fully supported via CLI', { conversationId })
    return []
  }

  // ===== SEARCH =====

  async searchMessages(
    conversationId: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    // Search not supported by CLI - retrieve all and filter locally
    this.log.debug('Searching messages (local filter)', { conversationId, query: options.query })

    const result = await this.retrieveMessages(conversationId, {
      limit: options.limit || 100,
    })

    const query = options.query.toLowerCase()
    const filtered = result.messages.filter(msg =>
      msg.content.toLowerCase().includes(query)
    )

    return {
      results: filtered.map(message => ({
        message,
        score: 1.0,
      })),
      total: filtered.length,
      hasMore: false,
    }
  }

  // ===== CAPABILITIES =====

  getCapabilities(): PlatformCapabilities {
    return {
      canRetrieveMessages: true,
      canPublishMessages: true,
      canEditMessages: false,  // Not supported by CLI
      canDeleteMessages: false,  // Not supported by CLI
      canReplyToMessages: false,  // Limited support
      supportsRealtime: false,
      supportsWebSocket: false,
      supportsWebhooks: false,
      supportsSearch: true,  // Local filtering
      supportsMessageHistory: true,
      supportsAttachments: false,
      supportsImages: false,
      supportsVideos: false,
      supportsAudio: false,
      supportsReactions: false,
      supportsThreads: false,
      supportsPolls: false,
      rateLimit: {
        messagesPerMinute: 5,
        messagesPerHour: 50,
        messagesPerDay: 500,
      },
    }
  }

  // ===== HEALTH CHECK =====

  async healthCheck(): Promise<PlatformHealthStatus> {
    const startTime = Date.now()

    try {
      await this.testConnection()
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

  private async testConnection(): Promise<void> {
    // Test with minimal message retrieval
    const args = [
      `-u "${this.config.username}"`,
      `-p "${this.config.password}"`,
      `-c "test"`,
      `-a "${this.config.apiUrl}"`,
      '-n 1',
    ]

    const command = `bash "${this.mmrPath}" ${args.join(' ')}`

    await execAsync(command, {
      env: {
        ...process.env,
        MEESHY_PASSWORD: this.config.password,
      },
    })
  }

  private parseMessages(output: string, conversationId: string): Message[] {
    try {
      // Find JSON array in output
      const jsonMatch = output.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        this.log.warn('No JSON array found in MMR output')
        return []
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>

      return parsed.map(msg => this.transformMessage(msg, conversationId))
    } catch (error) {
      this.log.error('Failed to parse messages from CLI output', error as Error)
      throw new PlatformError(
        'Failed to parse CLI output',
        this.platformName,
        false,
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  private transformMessage(data: Record<string, unknown>, conversationId: string): Message {
    const sender = data.sender as Record<string, unknown> | undefined

    return {
      id: String(data.id),
      conversationId,
      senderId: sender?.id as string | undefined,
      content: String(data.content),
      originalLanguage: String(data.language || 'en'),
      messageType: 'text',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(String(data.timestamp)),
      timestamp: new Date(String(data.timestamp)),
      sender: sender ? {
        id: String(sender.id),
        username: String(sender.username),
        displayName: sender.displayName as string | undefined,
      } : undefined,
    }
  }
}
