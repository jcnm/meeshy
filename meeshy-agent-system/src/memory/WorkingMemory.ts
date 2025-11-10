/**
 * Working Memory - Short-term context management
 *
 * Stores recent messages and context in RAM for fast access.
 * This is the agent's "active" memory during conversations.
 */

import type { Message, MessageAnalysis } from '../types'
import { logger } from '../utils/logger'
import { MemoryError } from '../utils/errors'

export interface WorkingMemoryConfig {
  maxMessages: number
  maxAge: number  // milliseconds
  enableCompression: boolean
}

export interface MemoryEntry {
  message: Message
  analysis?: MessageAnalysis
  timestamp: Date
  accessCount: number
  lastAccess: Date
  insertionIndex: number
}

export class WorkingMemory {
  private config: WorkingMemoryConfig
  private entries: MemoryEntry[] = []
  private insertionCounter: number = 0
  private log = logger.child({ component: 'WorkingMemory' })

  constructor(config: Partial<WorkingMemoryConfig> = {}) {
    this.config = {
      maxMessages: config.maxMessages || 100,
      maxAge: config.maxAge || 3600000, // 1 hour default
      enableCompression: config.enableCompression ?? false,
    }

    this.log.info('WorkingMemory initialized', {
      maxMessages: this.config.maxMessages,
      maxAge: this.config.maxAge,
      enableCompression: this.config.enableCompression,
    })
  }

  // ===== ADD/STORE =====

  add(message: Message, analysis?: MessageAnalysis): void {
    this.log.debug('Adding message to working memory', {
      messageId: message.id,
      conversationId: message.conversationId,
    })

    const entry: MemoryEntry = {
      message,
      analysis,
      timestamp: new Date(),
      accessCount: 0,
      lastAccess: new Date(),
      insertionIndex: this.insertionCounter++,
    }

    this.entries.push(entry)

    // Cleanup if needed
    this.cleanup()

    this.log.debug('Message added to working memory', {
      messageId: message.id,
      totalEntries: this.entries.length,
    })
  }

  addMany(messages: Message[]): void {
    this.log.debug('Adding multiple messages to working memory', {
      count: messages.length,
    })

    messages.forEach(message => this.add(message))
  }

  // ===== RETRIEVE =====

  get(messageId: string): MemoryEntry | undefined {
    const entry = this.entries.find(e => e.message.id === messageId)

    if (entry) {
      entry.accessCount++
      entry.lastAccess = new Date()
    }

    return entry
  }

  getAll(): MemoryEntry[] {
    return [...this.entries]
  }

  getRecent(count: number): MemoryEntry[] {
    return [...this.entries]
      .sort((a, b) => {
        const timeDiff = b.timestamp.getTime() - a.timestamp.getTime()
        if (timeDiff !== 0) return timeDiff
        // When timestamps are equal, use insertion order (higher index = more recent)
        return b.insertionIndex - a.insertionIndex
      })
      .slice(0, count)
  }

  getByConversation(conversationId: string): MemoryEntry[] {
    return this.entries.filter(e => e.message.conversationId === conversationId)
  }

  getByUser(userId: string): MemoryEntry[] {
    return this.entries.filter(e =>
      e.message.senderId === userId || e.message.anonymousSenderId === userId
    )
  }

  getByTimeRange(start: Date, end: Date): MemoryEntry[] {
    const startTime = start.getTime()
    const endTime = end.getTime()

    return this.entries.filter(e => {
      const msgTime = e.message.timestamp.getTime()
      return msgTime >= startTime && msgTime <= endTime
    })
  }

  // ===== SEARCH =====

  search(query: string, limit: number = 10): MemoryEntry[] {
    const lowerQuery = query.toLowerCase()

    return this.entries
      .filter(e => e.message.content.toLowerCase().includes(lowerQuery))
      .slice(0, limit)
  }

  // ===== UPDATE =====

  updateAnalysis(messageId: string, analysis: MessageAnalysis): void {
    const entry = this.entries.find(e => e.message.id === messageId)

    if (!entry) {
      throw new MemoryError(`Message ${messageId} not found in working memory`)
    }

    entry.analysis = analysis
    entry.lastAccess = new Date()

    this.log.debug('Analysis updated for message', { messageId })
  }

  // ===== DELETE =====

  remove(messageId: string): boolean {
    const index = this.entries.findIndex(e => e.message.id === messageId)

    if (index === -1) {
      return false
    }

    this.entries.splice(index, 1)
    this.log.debug('Message removed from working memory', { messageId })

    return true
  }

  removeByConversation(conversationId: string): number {
    const before = this.entries.length
    this.entries = this.entries.filter(e => e.message.conversationId !== conversationId)
    const removed = before - this.entries.length

    this.log.debug('Messages removed by conversation', {
      conversationId,
      removed,
    })

    return removed
  }

  clear(): void {
    const count = this.entries.length
    this.entries = []

    this.log.info('Working memory cleared', { entriesRemoved: count })
  }

  // ===== MAINTENANCE =====

  private cleanup(): void {
    const before = this.entries.length

    // Remove old entries
    const now = Date.now()
    this.entries = this.entries.filter(e => {
      const age = now - e.timestamp.getTime()
      return age < this.config.maxAge
    })

    // Remove excess entries (keep most recent)
    if (this.entries.length > this.config.maxMessages) {
      this.entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      this.entries = this.entries.slice(0, this.config.maxMessages)
    }

    const after = this.entries.length
    const removed = before - after

    if (removed > 0) {
      this.log.debug('Working memory cleanup', {
        removed,
        remaining: after,
      })
    }
  }

  compact(): void {
    this.log.info('Compacting working memory...')

    // Remove low-value entries (rarely accessed, old)
    const threshold = Date.now() - (this.config.maxAge / 2)

    const before = this.entries.length
    this.entries = this.entries.filter(e => {
      if (e.accessCount === 0 && e.timestamp.getTime() < threshold) {
        return false
      }
      return true
    })

    const removed = before - this.entries.length

    this.log.info('Working memory compacted', {
      removed,
      remaining: this.entries.length,
    })
  }

  // ===== STATS =====

  getStats(): {
    totalEntries: number
    uniqueConversations: number
    uniqueUsers: number
    averageAge: number
    oldestEntry: Date | null
    newestEntry: Date | null
  } {
    if (this.entries.length === 0) {
      return {
        totalEntries: 0,
        uniqueConversations: 0,
        uniqueUsers: 0,
        averageAge: 0,
        oldestEntry: null,
        newestEntry: null,
      }
    }

    const conversations = new Set(this.entries.map(e => e.message.conversationId))
    const users = new Set(
      this.entries
        .map(e => e.message.senderId || e.message.anonymousSenderId)
        .filter((id): id is string => id !== undefined)
    )

    const now = Date.now()
    const ages = this.entries.map(e => now - e.timestamp.getTime())
    const averageAge = ages.reduce((a, b) => a + b, 0) / ages.length

    const timestamps = this.entries.map(e => e.timestamp.getTime())
    const oldestEntry = new Date(Math.min(...timestamps))
    const newestEntry = new Date(Math.max(...timestamps))

    return {
      totalEntries: this.entries.length,
      uniqueConversations: conversations.size,
      uniqueUsers: users.size,
      averageAge,
      oldestEntry,
      newestEntry,
    }
  }

  // ===== EXPORT/IMPORT =====

  export(): MemoryEntry[] {
    return this.getAll()
  }

  import(entries: MemoryEntry[]): void {
    this.log.info('Importing entries to working memory', {
      count: entries.length,
    })

    this.entries = [...entries]

    // Update insertionCounter to be higher than any imported index
    if (entries.length > 0) {
      const maxIndex = Math.max(...entries.map(e => e.insertionIndex))
      this.insertionCounter = maxIndex + 1
    }

    this.cleanup()

    this.log.info('Entries imported', {
      imported: entries.length,
      final: this.entries.length,
    })
  }
}
