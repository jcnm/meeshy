/**
 * Meeshy Client - Wrapper for mmr.sh and mmp.sh scripts
 *
 * Provides TypeScript interface to interact with Meeshy platform
 * via shell scripts
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import type { Message } from '../types'

const execAsync = promisify(exec)

export interface MeeshyClientConfig {
  username: string
  password: string
  conversationId: string
  apiUrl?: string
  frontendUrl?: string
  scriptsPath?: string
}

export interface RetrieveMessagesOptions {
  count?: number           // Number of messages (default: 50)
  time?: {                // Time period filter
    value: number
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
  }
  format?: 'pretty' | 'json' | 'compact' | 'raw' | 'ai'
  showTranslations?: boolean
  showMetadata?: boolean
  showAttachments?: boolean
}

export interface PublishMessageOptions {
  content: string
  language?: string
  replyToId?: string
  skipConfirmation?: boolean
  noBackup?: boolean
  noCleanup?: boolean
}

/**
 * Client for interacting with Meeshy platform via mmr.sh and mmp.sh
 */
export class MeeshyClient {
  private config: Required<MeeshyClientConfig>
  private mmrPath: string
  private mmpPath: string

  constructor(config: MeeshyClientConfig) {
    this.config = {
      username: config.username,
      password: config.password,
      conversationId: config.conversationId,
      apiUrl: config.apiUrl || 'https://gate.meeshy.me',
      frontendUrl: config.frontendUrl || 'https://meeshy.me',
      scriptsPath: config.scriptsPath || path.resolve(__dirname, '../../../scripts'),
    }

    this.mmrPath = path.join(this.config.scriptsPath, 'mmr.sh')
    this.mmpPath = path.join(this.config.scriptsPath, 'mmp.sh')
  }

  /**
   * Retrieve messages from conversation using mmr.sh
   */
  async retrieveMessages(options: RetrieveMessagesOptions = {}): Promise<Message[]> {
    const args: string[] = []

    // Authentication
    args.push(`-u "${this.config.username}"`)
    args.push(`-p "${this.config.password}"`)
    args.push(`-c "${this.config.conversationId}"`)
    args.push(`-a "${this.config.apiUrl}"`)

    // Filter options
    if (options.count) {
      args.push(`-n ${options.count}`)
    } else if (options.time) {
      const timeStr = `${options.time.value}${this.getTimeUnitShort(options.time.unit)}`
      args.push(`-t ${timeStr}`)
    }

    // Format - always use 'ai' format for structured JSON output
    args.push('-f ai')

    // Display options (only apply to non-ai formats, but keeping for compatibility)
    if (options.showTranslations) {
      args.push('--show-translations')
    }
    if (options.showMetadata) {
      args.push('--show-metadata')
    }
    if (options.showAttachments) {
      args.push('--show-attachments')
    }

    // Verbose for debugging
    if (process.env.DEBUG === 'true') {
      args.push('-v')
    }

    const command = `bash "${this.mmrPath}" ${args.join(' ')}`

    try {
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          MEESHY_PASSWORD: this.config.password,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      })

      if (stderr && !stderr.includes('[INFO]') && !stderr.includes('[SUCCESS]')) {
        console.warn('MMR stderr:', stderr)
      }

      // Parse JSON output from 'ai' format
      const messages = this.parseMessages(stdout)
      return messages
    } catch (error) {
      throw new Error(`Failed to retrieve messages: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Publish message to conversation using mmp.sh
   */
  async publishMessage(options: PublishMessageOptions): Promise<void> {
    // For mmp.sh, we need to either:
    // 1. Write content to a file and use -f option
    // 2. Pass content as inline argument

    // Using inline message approach for simplicity
    const args: string[] = []

    // Authentication
    args.push(`-u "${this.config.username}"`)
    args.push(`-p "${this.config.password}"`)
    args.push(`-c "${this.config.conversationId}"`)
    args.push(`-a "${this.config.apiUrl}"`)

    // Language
    if (options.language) {
      args.push(`-l "${options.language}"`)
    }

    // Options
    if (options.skipConfirmation) {
      args.push('-y')
    }
    if (options.noBackup) {
      args.push('--no-backup')
    }
    if (options.noCleanup) {
      args.push('--no-cleanup')
    }

    // Verbose for debugging
    if (process.env.DEBUG === 'true') {
      args.push('-v')
    }

    // Message content (properly escaped)
    const escapedContent = options.content.replace(/"/g, '\\"')
    args.push(`"${escapedContent}"`)

    const command = `bash "${this.mmpPath}" ${args.join(' ')}`

    try {
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          MEESHY_PASSWORD: this.config.password,
        },
        maxBuffer: 1024 * 1024, // 1MB buffer
      })

      if (stderr && !stderr.includes('[INFO]') && !stderr.includes('[SUCCESS]')) {
        console.warn('MMP stderr:', stderr)
      }

      // Check for success message
      if (!stdout.includes('Publication successful') && !stdout.includes('[SUCCESS]')) {
        throw new Error('Message publication may have failed')
      }
    } catch (error) {
      throw new Error(`Failed to publish message: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get conversation metadata
   */
  async getConversationInfo(): Promise<{
    title: string
    type: string
    members: number
  }> {
    // This info is returned in the verbose output of mmr.sh
    // We can extract it from a single message retrieval
    const args = [
      `-u "${this.config.username}"`,
      `-p "${this.config.password}"`,
      `-c "${this.config.conversationId}"`,
      `-a "${this.config.apiUrl}"`,
      '-n 1',  // Just get 1 message to trigger conversation check
      '-v',    // Verbose to get conversation info
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
          title: match[1].trim(),
          type: match[2],
          members: parseInt(match[3], 10),
        }
      }

      // Fallback
      return {
        title: this.config.conversationId,
        type: 'unknown',
        members: 0,
      }
    } catch (error) {
      console.warn('Failed to get conversation info:', error)
      return {
        title: this.config.conversationId,
        type: 'unknown',
        members: 0,
      }
    }
  }

  /**
   * Test connection to Meeshy API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.retrieveMessages({ count: 1 })
      return true
    } catch {
      return false
    }
  }

  // ===== PRIVATE HELPERS =====

  /**
   * Parse messages from mmr.sh AI format JSON output
   */
  private parseMessages(output: string): Message[] {
    try {
      // Find JSON array in output (mmr.sh may have logs before/after)
      const jsonMatch = output.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in output')
      }

      const parsed = JSON.parse(jsonMatch[0])

      if (!Array.isArray(parsed)) {
        throw new Error('Expected array of messages')
      }

      // Transform from AI format to our Message type
      return parsed.map(msg => this.transformMessage(msg))
    } catch (error) {
      throw new Error(`Failed to parse messages: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Transform message from AI format to our Message type
   */
  private transformMessage(aiMsg: any): Message {
    return {
      id: aiMsg.id,
      conversationId: this.config.conversationId,
      senderId: aiMsg.sender?.id,
      anonymousSenderId: aiMsg.sender?.id,
      content: aiMsg.content,
      originalLanguage: aiMsg.language || 'en',
      messageType: aiMsg.type || 'text',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(aiMsg.timestamp),
      updatedAt: new Date(aiMsg.timestamp),
      timestamp: new Date(aiMsg.timestamp),
      sender: aiMsg.sender ? {
        id: aiMsg.sender.id,
        username: aiMsg.sender.username,
        firstName: aiMsg.sender.displayName?.split(' ')[0],
        lastName: aiMsg.sender.displayName?.split(' ').slice(1).join(' '),
        displayName: aiMsg.sender.displayName,
      } : undefined,
      translations: aiMsg.translations?.map((t: any) => ({
        id: `${aiMsg.id}-${t.language}`,
        messageId: aiMsg.id,
        sourceLanguage: aiMsg.language,
        targetLanguage: t.language,
        translatedContent: t.content,
        createdAt: new Date(aiMsg.timestamp),
      })),
      attachments: aiMsg.hasAttachments ? aiMsg.attachments?.map((a: any) => ({
        id: a.url,
        messageId: aiMsg.id,
        filename: a.filename,
        mimeType: a.type,
        size: a.size,
        url: a.url,
      })) : undefined,
      replyTo: aiMsg.replyTo ? {
        id: aiMsg.replyTo.id,
        conversationId: this.config.conversationId,
        content: aiMsg.replyTo.content,
        senderId: aiMsg.replyTo.sender,
        originalLanguage: 'en',
        messageType: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        timestamp: new Date(),
      } : undefined,
    }
  }

  /**
   * Get short time unit for mmr.sh
   */
  private getTimeUnitShort(unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'): string {
    const map: Record<string, string> = {
      minutes: 'm',
      hours: 'h',
      days: 'd',
      weeks: 'w',
      months: 'M',
    }
    return map[unit] || 'h'
  }
}
