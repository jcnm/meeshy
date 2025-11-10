/**
 * Agent Configuration Types
 */

export interface AgentConfig {
  // Identity
  id: string
  conversationId: string

  // Platform
  platform: {
    adapter: 'api' | 'cli'
    username: string
    password: string
    apiUrl?: string
  }

  // Personality
  personality: {
    name: string
    role: string
    tone: string
    expertise: string[]
    proactivityLevel: number  // 0-1
    formality: number         // 0-1
  }

  // Behavior
  behavior: {
    responseStyle: 'concise' | 'detailed' | 'conversational' | 'formal'
    teachingApproach: 'socratic' | 'direct' | 'mixed'
  }

  // Targets
  targets: {
    density: number   // 0-1
    quality: number   // 0-1
  }

  // Limits
  limits: {
    maxMessagesPerHour: number
    maxConsecutiveReplies: number
    minTimeBetweenMessages: number
  }

  // Adaptive behavior
  adaptive: {
    pollingInterval: {
      min: number
      max: number
      adaptive: boolean
    }
    decisionThresholds: {
      mentionResponse: number
      questionResponse: number
      proactiveInitiation: number
    }
  }

  // Optional features
  features?: {
    enableResearch?: boolean
    enableMemory?: boolean
    enableLearning?: boolean
  }
}

export interface AgentState {
  status: 'initializing' | 'running' | 'paused' | 'stopped' | 'error'
  startTime: Date
  lastActivity: Date
  messagesSent: number
  messagesReceived: number
  errors: number
  currentPollingInterval: number
}
