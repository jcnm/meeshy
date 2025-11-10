/**
 * Mentor Agent - Core agent implementation
 *
 * The central orchestrator that brings together all components:
 * - Platform communication
 * - Memory management
 * - Decision making
 * - Message generation
 */

import type { PlatformAdapter } from '../types/platform'
import type { Message, ConversationContext } from '../types'
import type { AgentConfig, AgentState } from './AgentConfig'
import { WorkingMemory } from '../memory/WorkingMemory'
import { MetricsEngine } from '../engines/MetricsEngine'
import { logger } from '../utils/logger'
import { AAMSError } from '../utils/errors'

export class MentorAgent {
  private config: AgentConfig
  private adapter: PlatformAdapter
  private workingMemory: WorkingMemory
  private metricsEngine: MetricsEngine
  private state: AgentState
  private log = logger.child({ agent: '' })
  private running = false
  private pollingTimer: NodeJS.Timeout | null = null

  constructor(config: AgentConfig, adapter: PlatformAdapter) {
    this.config = config
    this.adapter = adapter
    this.workingMemory = new WorkingMemory({
      maxMessages: 100,
      maxAge: 3600000, // 1 hour
    })
    this.metricsEngine = new MetricsEngine()

    this.state = {
      status: 'initializing',
      startTime: new Date(),
      lastActivity: new Date(),
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      currentPollingInterval: config.adaptive.pollingInterval.min,
    }

    this.log = logger.child({
      agent: config.id,
      conversation: config.conversationId,
    })

    this.log.info('MentorAgent created', {
      id: config.id,
      conversationId: config.conversationId,
      personality: config.personality.name,
    })
  }

  // ===== LIFECYCLE =====

  async start(): Promise<void> {
    this.log.info('Starting mentor agent...')

    try {
      // Initialize platform adapter
      if (!this.adapter.isConnected()) {
        await this.adapter.initialize()
      }

      this.state.status = 'running'
      this.running = true

      // Start main loop
      this.scheduleNextPoll()

      this.log.info('Mentor agent started successfully')
    } catch (error) {
      this.state.status = 'error'
      this.log.error('Failed to start mentor agent', error as Error)
      throw error
    }
  }

  async stop(): Promise<void> {
    this.log.info('Stopping mentor agent...')

    this.running = false

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer)
      this.pollingTimer = null
    }

    this.state.status = 'stopped'

    this.log.info('Mentor agent stopped')
  }

  pause(): void {
    this.log.info('Pausing mentor agent')
    this.state.status = 'paused'

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  resume(): void {
    if (this.state.status !== 'paused') {
      throw new AAMSError('Agent is not paused', 'INVALID_STATE', false)
    }

    this.log.info('Resuming mentor agent')
    this.state.status = 'running'
    this.scheduleNextPoll()
  }

  // ===== MAIN LOOP =====

  private scheduleNextPoll(): void {
    if (!this.running || this.state.status !== 'running') {
      return
    }

    this.pollingTimer = setTimeout(() => {
      this.tick().catch(error => {
        this.log.error('Error in agent tick', error as Error)
        this.state.errors++

        // Continue running despite errors
        this.scheduleNextPoll()
      })
    }, this.state.currentPollingInterval)
  }

  private async tick(): Promise<void> {
    try {
      // 1. Observe - Get new messages
      const updates = await this.observe()

      if (updates.length === 0) {
        // No new messages
        this.scheduleNextPoll()
        return
      }

      // 2. Think - Analyze and decide
      const decision = await this.think(updates)

      // 3. Act - Execute action if needed
      if (decision.shouldAct) {
        await this.act(decision.action)
      }

      // 4. Learn - Update memory and adapt
      await this.learn(updates)

      // 5. Adapt - Adjust polling interval
      this.adapt()
    } finally {
      // Always schedule next poll
      this.scheduleNextPoll()
    }
  }

  // ===== OBSERVE =====

  private async observe(): Promise<Message[]> {
    this.log.debug('Observing conversation for new messages')

    try {
      const result = await this.adapter.retrieveMessages(
        this.config.conversationId,
        {
          limit: 50,
          after: this.state.lastActivity,
        }
      )

      // Filter out messages already in memory
      const newMessages = result.messages.filter(msg => {
        return !this.workingMemory.get(msg.id)
      })

      if (newMessages.length > 0) {
        this.log.info('New messages observed', {
          count: newMessages.length,
        })

        // Add to working memory
        this.workingMemory.addMany(newMessages)

        this.state.messagesReceived += newMessages.length
        this.state.lastActivity = new Date()
      }

      return newMessages
    } catch (error) {
      this.log.error('Failed to observe messages', error as Error)
      return []
    }
  }

  // ===== THINK =====

  private async think(updates: Message[]): Promise<
    | {
        shouldAct: true
        action: {
          type: 'respond' | 'wait'
          content?: string
          reasoning: string
        }
      }
    | {
        shouldAct: false
        action?: {
          type: 'respond' | 'wait'
          content?: string
          reasoning: string
        }
      }
  > {
    this.log.debug('Analyzing messages and making decision', {
      updateCount: updates.length,
    })

    // Build conversation context
    const context = this.buildContext()

    // Calculate metrics
    const metrics = this.metricsEngine.calculateMetrics(context)

    this.log.debug('Current metrics', {
      density: metrics.density.toFixed(2),
      quality: metrics.quality.toFixed(2),
    })

    // Basic decision logic (to be enhanced)
    const factors = {
      hasMention: updates.some(msg =>
        msg.content.toLowerCase().includes(`@${this.config.platform.username}`)
      ),
      hasQuestion: updates.some(msg => msg.content.includes('?')),
      densityLow: metrics.density < this.config.targets.density,
      qualityLow: metrics.quality < this.config.targets.quality,
    }

    // Decision thresholds
    let confidence = 0

    if (factors.hasMention) {
      confidence += this.config.adaptive.decisionThresholds.mentionResponse
    }

    if (factors.hasQuestion) {
      confidence += this.config.adaptive.decisionThresholds.questionResponse
    }

    if (factors.densityLow || factors.qualityLow) {
      confidence += this.config.adaptive.decisionThresholds.proactiveInitiation
    }

    // Check rate limits
    const recentMessages = this.getRecentAgentMessages()
    if (recentMessages.length >= this.config.limits.maxConsecutiveReplies) {
      this.log.debug('Rate limit reached, waiting')
      return {
        shouldAct: false,
        action: {
          type: 'wait',
          reasoning: 'Rate limit reached',
        },
      }
    }

    // Decide
    const shouldAct = confidence > 0.5

    if (shouldAct) {
      this.log.info('Decision: Should respond', {
        confidence: confidence.toFixed(2),
        hasMention: factors.hasMention,
        hasQuestion: factors.hasQuestion,
        densityLow: factors.densityLow,
        qualityLow: factors.qualityLow,
      })

      return {
        shouldAct: true,
        action: {
          type: 'respond',
          content: this.generatePlaceholderResponse(updates, context),
          reasoning: `Confidence: ${confidence.toFixed(2)}, Factors: ${JSON.stringify(factors)}`,
        },
      }
    }

    this.log.debug('Decision: Wait', {
      confidence: confidence.toFixed(2),
      hasMention: factors.hasMention,
      hasQuestion: factors.hasQuestion,
      densityLow: factors.densityLow,
      qualityLow: factors.qualityLow,
    })

    return {
      shouldAct: false,
      action: {
        type: 'wait',
        reasoning: 'Confidence too low',
      },
    }
  }

  // ===== ACT =====

  private async act(action: { type: string; content?: string; reasoning: string }): Promise<void> {
    if (action.type !== 'respond' || !action.content) {
      return
    }

    this.log.info('Acting: Publishing message', {
      contentLength: action.content.length,
    })

    try {
      const result = await this.adapter.publishMessage(
        this.config.conversationId,
        {
          content: action.content,
          language: 'en',
        }
      )

      if (result.success) {
        this.log.info('Message published successfully', {
          messageId: result.messageId,
        })

        this.state.messagesSent++
        this.state.lastActivity = new Date()
      }
    } catch (error) {
      this.log.error('Failed to publish message', error as Error)
      this.state.errors++
    }
  }

  // ===== LEARN =====

  private async learn(updates: Message[]): Promise<void> {
    // TODO: Implement learning from interactions
    // For now, just log
    this.log.debug('Learning from updates', {
      count: updates.length,
    })
  }

  // ===== ADAPT =====

  private adapt(): void {
    // Adapt polling interval based on conversation activity
    const stats = this.workingMemory.getStats()

    if (stats.totalEntries > 50) {
      // High activity - poll more frequently
      this.state.currentPollingInterval = Math.max(
        this.config.adaptive.pollingInterval.min,
        this.state.currentPollingInterval * 0.8
      )
    } else if (stats.totalEntries < 10) {
      // Low activity - poll less frequently
      this.state.currentPollingInterval = Math.min(
        this.config.adaptive.pollingInterval.max,
        this.state.currentPollingInterval * 1.2
      )
    }

    this.log.debug('Polling interval adapted', {
      interval: this.state.currentPollingInterval,
      memoryEntries: stats.totalEntries,
    })
  }

  // ===== HELPERS =====

  private buildContext(): ConversationContext {
    const recentMessages = this.workingMemory.getRecent(50)

    return {
      conversationId: this.config.conversationId,
      recentMessages: recentMessages.map(e => e.message),
      summaries: [],
      participants: new Map(),
      activeTopics: [],
      state: {
        phase: 'active',
        energy: 0.7,
        coherence: 0.8,
        lastActivityGap: Date.now() - this.state.lastActivity.getTime(),
      },
      metrics: {
        density: 0,
        quality: 0,
        messageFrequency: 0,
        participationRate: 0,
        responseTime: 0,
        continuityScore: 0,
        contentQuality: 0,
        topicCoherence: 0,
        engagementRate: 0,
        sentimentScore: { score: 0, magnitude: 0, label: 'neutral' },
        diversityIndex: 0,
        agentContributionRate: 0,
        topicVariety: 0,
        threadDepth: 0,
        calculatedAt: new Date(),
      },
      lastAgentMessage: undefined,
      agentMessageCount: this.state.messagesSent,
      messagesLastHour: recentMessages.length,
    }
  }

  private getRecentAgentMessages(): Message[] {
    const oneHourAgo = Date.now() - 3600000
    return this.workingMemory
      .getAll()
      .filter(e => {
        const isAgent = e.message.senderId === this.config.platform.username
        const isRecent = e.message.timestamp.getTime() > oneHourAgo
        return isAgent && isRecent
      })
      .map(e => e.message)
  }

  private generatePlaceholderResponse(updates: Message[], context: ConversationContext): string {
    // TODO: Replace with actual LLM generation
    const lastMessage = updates[updates.length - 1]

    return `Thank you for your message! I'm ${this.config.personality.name}, ` +
      `${this.config.personality.role}. I'm here to help with ` +
      `${this.config.personality.expertise.join(', ')}. ` +
      `How can I assist you today?`
  }

  // ===== STATE GETTERS =====

  getState(): AgentState {
    return { ...this.state }
  }

  getConfig(): AgentConfig {
    return { ...this.config }
  }

  getMemoryStats() {
    return this.workingMemory.getStats()
  }
}
