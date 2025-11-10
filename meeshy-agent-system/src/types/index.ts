/**
 * Meeshy Agent System - Core Types
 *
 * Type definitions for all MAS components
 */

// ===== MESSAGE TYPES =====

export interface Message {
  id: string
  conversationId: string
  senderId?: string
  anonymousSenderId?: string
  content: string
  originalLanguage: string
  messageType: MessageType
  isEdited: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt?: Date
  sender?: MessageSender
  translations?: MessageTranslation[]
  attachments?: MessageAttachment[]
  replyTo?: Message
  timestamp: Date
}

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'location'

export interface MessageSender {
  id: string
  username: string
  firstName?: string
  lastName?: string
  displayName?: string
  avatar?: string
  isOnline?: boolean
}

export interface MessageTranslation {
  id: string
  messageId: string
  sourceLanguage: string
  targetLanguage: string
  translatedContent: string
  createdAt: Date
}

export interface MessageAttachment {
  id: string
  messageId: string
  filename: string
  mimeType: string
  size: number
  url: string
}

// ===== CONVERSATION TYPES =====

export interface Conversation {
  id: string
  identifier?: string
  title?: string
  description?: string
  type: ConversationType
  status: ConversationStatus
  participants: ConversationParticipant[]
  messageCount?: number
  unreadCount?: number
  createdAt: Date
  updatedAt: Date
  lastActivityAt?: Date
}

export type ConversationType = 'direct' | 'group' | 'public' | 'global' | 'broadcast'
export type ConversationStatus = 'active' | 'archived' | 'deleted'

export interface ConversationParticipant {
  userId: string
  username: string
  displayName?: string
  role: ParticipantRole
  joinedAt: Date
  isActive: boolean
}

export type ParticipantRole = 'admin' | 'moderator' | 'member'

// ===== AGENT CONFIGURATION =====

export interface AgentConfig {
  // Identity
  id: string
  conversationId: string
  username: string
  password: string

  // Personality & Behavior
  personality: AgentPersonality
  responseStyle: ResponseStyle

  // Targets
  targetMetrics: TargetMetrics

  // Limits
  limits: AgentLimits

  // Adaptive behavior
  adaptive: AdaptiveConfig
}

export interface AgentPersonality {
  name: string
  role: string
  tone: string
  expertise: string[]
  proactivityLevel: number  // 0-1
  formality: number         // 0-1
}

export type ResponseStyle = 'concise' | 'detailed' | 'conversational' | 'formal'

export interface TargetMetrics {
  density: number   // 0-1
  quality: number   // 0-1
}

export interface AgentLimits {
  maxMessagesPerHour: number
  maxConsecutiveReplies: number
  minTimeBetweenMessages: number  // milliseconds
}

export interface AdaptiveConfig {
  pollingInterval: {
    min: number      // milliseconds
    max: number      // milliseconds
    adaptive: boolean
  }
  decisionThresholds: {
    mentionResponse: number
    questionResponse: number
    proactiveInitiation: number
  }
}

// ===== CONTEXT & MEMORY =====

export interface ConversationContext {
  conversationId: string

  // Recent messages (working memory)
  recentMessages: Message[]

  // Summaries (episode memory)
  summaries: ConversationSummary[]

  // Participant profiles
  participants: Map<string, UserProfile>

  // Active topics
  activeTopics: Topic[]

  // State
  state: ConversationState

  // Metrics
  metrics: ConversationMetrics

  // Agent activity
  lastAgentMessage?: Date
  agentMessageCount: number
  messagesLastHour: number
}

export interface ConversationSummary {
  id: string
  conversationId: string
  startTime: Date
  endTime: Date
  messageCount: number
  participants: string[]
  topics: string[]
  summary: string
  keyPoints: string[]
  sentiment: SentimentScore
}

export interface UserProfile {
  userId: string
  username: string
  displayName?: string

  // Activity
  messageCount: number
  lastActive: Date
  averageResponseTime: number  // milliseconds

  // Patterns
  activeHours: number[]  // hours of day (0-23)
  preferredTopics: string[]
  communicationStyle: CommunicationStyle

  // Sentiment
  averageSentiment: SentimentScore
}

export type CommunicationStyle = 'verbose' | 'concise' | 'technical' | 'casual'

export interface Topic {
  id: string
  name: string
  keywords: string[]
  firstMentioned: Date
  lastMentioned: Date
  messageCount: number
  participants: string[]
  sentiment: SentimentScore
  isActive: boolean
}

export interface ConversationState {
  phase: ConversationPhase
  energy: number         // 0-1
  coherence: number      // 0-1
  lastActivityGap: number  // milliseconds
  stagnationReason?: StagnationReason
}

export type ConversationPhase = 'starting' | 'active' | 'declining' | 'stale' | 'reviving'
export type StagnationReason = 'topic_exhausted' | 'low_participation' | 'time_gap' | 'lack_direction'

// ===== METRICS =====

export interface ConversationMetrics {
  // Primary metrics
  density: number    // 0-1
  quality: number    // 0-1

  // Intermediate metrics for density
  messageFrequency: number       // messages per hour
  participationRate: number      // % of active participants
  responseTime: number           // average time between messages (ms)
  continuityScore: number        // 0-1 (lack of gaps)

  // Intermediate metrics for quality
  contentQuality: number         // 0-1
  topicCoherence: number         // 0-1
  engagementRate: number         // replies/reactions per message
  sentimentScore: SentimentScore
  diversityIndex: number         // 0-1

  // Additional metrics
  agentContributionRate: number  // % of messages from agent
  topicVariety: number           // number of unique topics
  threadDepth: number            // average reply depth

  // Timestamp
  calculatedAt: Date
}

export interface SentimentScore {
  score: number        // -1 to 1
  magnitude: number    // 0 to 1
  label: 'negative' | 'neutral' | 'positive'
}

// ===== ANALYSIS =====

export interface MessageAnalysis {
  messageId: string

  // Content analysis
  sentiment: SentimentScore
  topics: string[]
  entities: Entity[]
  keywords: string[]

  // Structure
  hasQuestion: boolean
  hasMention: boolean
  mentionedUsers: string[]
  replyToId?: string

  // Quality indicators
  lengthScore: number       // 0-1
  complexityScore: number   // 0-1
  coherenceScore: number    // 0-1

  // Engagement prediction
  engagementScore: number   // 0-1 (predicted likelihood of engagement)

  // Classification
  messageClass: MessageClass

  analyzedAt: Date
}

export interface Entity {
  text: string
  type: EntityType
  confidence: number
}

export type EntityType = 'person' | 'organization' | 'location' | 'date' | 'product' | 'technology'

export type MessageClass =
  | 'question'
  | 'statement'
  | 'greeting'
  | 'announcement'
  | 'discussion'
  | 'off_topic'

// ===== DECISION MAKING =====

export interface ResponseDecision {
  shouldRespond: boolean
  confidence: number       // 0-1
  responseType: ResponseType
  targetUsers?: string[]   // For individual responses
  replyToMessageId?: string
  urgency: number          // 0-1
  reasoning: string
  factors: DecisionFactors
}

export type ResponseType =
  | 'collective'        // Address all participants
  | 'individual'        // Address specific user
  | 'reply'            // Reply to specific message
  | 'proactive'        // Initiate new topic

export interface DecisionFactors {
  directMention: boolean
  questionAsked: boolean
  topicRelevance: number     // 0-1
  conversationStale: boolean
  densityLow: boolean
  recentAgentActivity: number  // messages in last N minutes
}

// ===== RESPONSE GENERATION =====

export interface GeneratedResponse {
  content: string
  language: string
  responseType: ResponseType
  metadata: ResponseMetadata
}

export interface ResponseMetadata {
  prompt: string
  model: string
  tokensUsed: number
  generationTime: number  // milliseconds
  temperature: number
  topicsAddressed: string[]
  style: ResponseStyle
}

// ===== PROACTIVE TOPICS =====

export interface ProactiveTopic {
  id: string
  source: TopicSource
  content: string
  relevance: number      // 0-1
  urgency: number        // 0-1
  suggestedMessage: string
  metadata: TopicMetadata
}

export type TopicSource = 'news' | 'historical' | 'stimulation' | 'scheduled'

export interface TopicMetadata {
  keywords: string[]
  relatedTopics: string[]
  sourceUrl?: string
  publishedAt?: Date
  expiresAt?: Date
}

// ===== SYSTEM PROMPTS =====

export interface SystemPrompt {
  base: string
  context: PromptContext
  instructions: string[]
  examples?: PromptExample[]
}

export interface PromptContext {
  conversationTitle: string
  conversationDescription: string
  agentExpertise: string[]
  activeParticipants: string[]
  recentTopics: string[]
  currentDensity: number
  currentQuality: number
  targetDensity: number
  targetQuality: number
  tone: string
  recentContext: string
}

export interface PromptExample {
  situation: string
  goodResponse: string
  badResponse: string
  explanation: string
}

// ===== HEALTH & MONITORING =====

export interface AgentHealth {
  status: HealthStatus
  uptime: number         // milliseconds
  lastPoll: Date
  lastMessage: Date
  errorCount: number
  successRate: number    // 0-1
  averageResponseTime: number  // milliseconds
  apiUsage: ApiUsage
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'stopped'

export interface ApiUsage {
  requestsLastHour: number
  requestsToday: number
  tokensUsedToday: number
  errorRate: number      // 0-1
  quotaRemaining?: number
}

// ===== EVENTS =====

export type AgentEvent =
  | { type: 'started'; timestamp: Date }
  | { type: 'stopped'; timestamp: Date; reason?: string }
  | { type: 'message_received'; messageId: string; timestamp: Date }
  | { type: 'message_sent'; messageId: string; timestamp: Date }
  | { type: 'decision_made'; decision: ResponseDecision; timestamp: Date }
  | { type: 'error'; error: Error; timestamp: Date }
  | { type: 'metrics_updated'; metrics: ConversationMetrics; timestamp: Date }

export type EventHandler = (event: AgentEvent) => void | Promise<void>
