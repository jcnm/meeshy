/**
 * Configuration Loader - YAML configuration management
 */

import { readFileSync } from 'fs'
import { parse } from 'yaml'
import type { AgentConfig } from '../core/AgentConfig'
import { logger } from './logger'
import { ConfigurationError, ValidationError } from './errors'

export class ConfigLoader {
  private static log = logger.child({ component: 'ConfigLoader' })

  /**
   * Load agent configuration from YAML file
   */
  static loadFromFile(filePath: string): AgentConfig {
    this.log.info('Loading configuration from file', { filePath })

    try {
      const content = readFileSync(filePath, 'utf-8')
      const parsed = parse(content)

      if (!parsed || !parsed.agent) {
        throw new ConfigurationError('Invalid configuration format: missing "agent" key')
      }

      const config = this.transformConfig(parsed.agent)
      this.validate(config)

      this.log.info('Configuration loaded successfully', {
        agentId: config.id,
        filePath,
      })

      return config
    } catch (error) {
      if (error instanceof ConfigurationError || error instanceof ValidationError) {
        throw error
      }

      this.log.error('Failed to load configuration', error as Error, { filePath })
      throw new ConfigurationError(
        `Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Transform YAML structure to AgentConfig
   */
  private static transformConfig(data: Record<string, unknown>): AgentConfig {
    // Extract with defaults and environment variable substitution
    return {
      id: String(data.id),
      conversationId: String(data.conversation_id),

      platform: {
        adapter: (data.platform as Record<string, unknown>)?.adapter as 'api' | 'cli' || 'api',
        username: this.resolveEnvVar(
          (data.credentials as Record<string, unknown>)?.username as string
        ),
        password: this.resolveEnvVar(
          (data.credentials as Record<string, unknown>)?.password as string
        ),
        apiUrl: (data.platform as Record<string, unknown>)?.api_url as string | undefined,
      },

      personality: {
        name: (data.personality as Record<string, unknown>)?.name as string || 'MentorAgent',
        role: (data.personality as Record<string, unknown>)?.role as string || 'AI Mentor',
        tone: (data.personality as Record<string, unknown>)?.tone as string || 'professional',
        expertise: (data.personality as Record<string, unknown>)?.expertise as string[] || [],
        proactivityLevel: Number((data.personality as Record<string, unknown>)?.proactivity_level) || 0.7,
        formality: Number((data.personality as Record<string, unknown>)?.formality) || 0.6,
      },

      behavior: {
        responseStyle: (data.behavior as Record<string, unknown>)?.response_style as 'concise' | 'detailed' | 'conversational' | 'formal' || 'detailed',
        teachingApproach: (data.behavior as Record<string, unknown>)?.teaching_approach as 'socratic' | 'direct' | 'mixed' || 'mixed',
      },

      targets: {
        density: Number((data.targets as Record<string, unknown>)?.density) || 0.8,
        quality: Number((data.targets as Record<string, unknown>)?.quality) || 0.9,
      },

      limits: {
        maxMessagesPerHour: Number((data.limits as Record<string, unknown>)?.max_messages_per_hour) || 10,
        maxConsecutiveReplies: Number((data.limits as Record<string, unknown>)?.max_consecutive_replies) || 3,
        minTimeBetweenMessages: Number((data.limits as Record<string, unknown>)?.min_time_between_messages) || 60000,
      },

      adaptive: {
        pollingInterval: {
          min: Number(((data.adaptive as Record<string, unknown>)?.polling_interval as Record<string, unknown>)?.min) || 30000,
          max: Number(((data.adaptive as Record<string, unknown>)?.polling_interval as Record<string, unknown>)?.max) || 300000,
          adaptive: Boolean(((data.adaptive as Record<string, unknown>)?.polling_interval as Record<string, unknown>)?.adaptive) ?? true,
        },
        decisionThresholds: {
          mentionResponse: Number(((data.adaptive as Record<string, unknown>)?.decision_thresholds as Record<string, unknown>)?.mention_response) || 0.9,
          questionResponse: Number(((data.adaptive as Record<string, unknown>)?.decision_thresholds as Record<string, unknown>)?.question_response) || 0.8,
          proactiveInitiation: Number(((data.adaptive as Record<string, unknown>)?.decision_thresholds as Record<string, unknown>)?.proactive_initiation) || 0.6,
        },
      },

      features: data.features as Record<string, boolean> | undefined,
    }
  }

  /**
   * Resolve environment variables in config values
   * Format: ${VAR_NAME} or ${VAR_NAME:-default}
   */
  private static resolveEnvVar(value: string): string {
    if (!value) return value

    const envVarRegex = /\$\{([^}]+)\}/g
    return value.replace(envVarRegex, (match, varName) => {
      // Support default values: ${VAR:-default}
      const [name, defaultValue] = varName.split(':-')

      const envValue = process.env[name.trim()]
      if (envValue) return envValue
      if (defaultValue) return defaultValue

      throw new ConfigurationError(
        `Environment variable ${name} is not set and no default provided`
      )
    })
  }

  /**
   * Validate configuration
   */
  private static validate(config: AgentConfig): void {
    // Required fields
    if (!config.id) {
      throw new ValidationError('Agent ID is required', 'id')
    }

    if (!config.conversationId) {
      throw new ValidationError('Conversation ID is required', 'conversationId')
    }

    if (!config.platform.username) {
      throw new ValidationError('Platform username is required', 'platform.username')
    }

    if (!config.platform.password) {
      throw new ValidationError('Platform password is required', 'platform.password')
    }

    // Validate ranges
    if (config.personality.proactivityLevel < 0 || config.personality.proactivityLevel > 1) {
      throw new ValidationError(
        'Proactivity level must be between 0 and 1',
        'personality.proactivityLevel'
      )
    }

    if (config.personality.formality < 0 || config.personality.formality > 1) {
      throw new ValidationError(
        'Formality must be between 0 and 1',
        'personality.formality'
      )
    }

    if (config.targets.density < 0 || config.targets.density > 1) {
      throw new ValidationError(
        'Target density must be between 0 and 1',
        'targets.density'
      )
    }

    if (config.targets.quality < 0 || config.targets.quality > 1) {
      throw new ValidationError(
        'Target quality must be between 0 and 1',
        'targets.quality'
      )
    }

    // Validate intervals
    if (config.adaptive.pollingInterval.min < 1000) {
      throw new ValidationError(
        'Minimum polling interval must be at least 1000ms',
        'adaptive.pollingInterval.min'
      )
    }

    if (config.adaptive.pollingInterval.max < config.adaptive.pollingInterval.min) {
      throw new ValidationError(
        'Maximum polling interval must be greater than minimum',
        'adaptive.pollingInterval.max'
      )
    }

    this.log.debug('Configuration validated successfully')
  }

  /**
   * Create a default configuration template
   */
  static createTemplate(): string {
    return `# Mentor Agent Configuration Template

agent:
  # Unique identifier for this agent instance
  id: mentor-agent-001

  # Conversation to participate in
  conversation_id: my-conversation

  # Platform settings
  platform:
    adapter: api  # or 'cli'
    api_url: https://gate.meeshy.me

  # Credentials (use environment variables!)
  credentials:
    username: \${AGENT_USERNAME}
    password: \${AGENT_PASSWORD}

  # Agent personality
  personality:
    name: "MentorBot"
    role: "AI Mentor and Guide"
    tone: "professional but friendly"
    expertise:
      - "technology"
      - "programming"
      - "problem solving"
    proactivity_level: 0.7
    formality: 0.6

  # Behavior settings
  behavior:
    response_style: detailed  # concise, detailed, conversational, formal
    teaching_approach: mixed  # socratic, direct, mixed

  # Target metrics
  targets:
    density: 0.8
    quality: 0.9

  # Safety limits
  limits:
    max_messages_per_hour: 10
    max_consecutive_replies: 3
    min_time_between_messages: 60000  # 1 minute in ms

  # Adaptive behavior
  adaptive:
    polling_interval:
      min: 30000    # 30 seconds
      max: 300000   # 5 minutes
      adaptive: true

    decision_thresholds:
      mention_response: 0.9
      question_response: 0.8
      proactive_initiation: 0.6

  # Optional features
  features:
    enable_research: false
    enable_memory: true
    enable_learning: false
`
  }
}
