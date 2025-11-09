/**
 * Metrics Engine - Core metrics calculation for conversation quality and density
 *
 * Responsible for calculating and tracking:
 * - Primary metrics: Density and Quality
 * - Intermediate metrics supporting primary metrics
 * - Real-time metric updates
 */

import type {
  Message,
  ConversationContext,
  ConversationMetrics,
  SentimentScore,
  MessageAnalysis,
} from '../types'

export class MetricsEngine {
  private static readonly OPTIMAL_MESSAGES_PER_HOUR = 20
  private static readonly MAX_RESPONSE_TIME_MS = 3600000 // 1 hour
  private static readonly CONTINUITY_WINDOW_MS = 1800000  // 30 minutes

  /**
   * Calculate all metrics for a conversation context
   */
  calculateMetrics(context: ConversationContext): ConversationMetrics {
    const now = Date.now()

    // Calculate intermediate metrics for density
    const messageFrequency = this.calculateMessageFrequency(context)
    const participationRate = this.calculateParticipationRate(context)
    const responseTime = this.calculateAverageResponseTime(context)
    const continuityScore = this.calculateContinuityScore(context)

    // Calculate primary density metric
    const density = this.calculateDensity({
      messageFrequency,
      participationRate,
      continuityScore,
    })

    // Calculate intermediate metrics for quality
    const contentQuality = this.calculateContentQuality(context)
    const topicCoherence = this.calculateTopicCoherence(context)
    const engagementRate = this.calculateEngagementRate(context)
    const sentimentScore = this.calculateAverageSentiment(context)
    const diversityIndex = this.calculateDiversityIndex(context)

    // Calculate primary quality metric
    const quality = this.calculateQuality({
      contentQuality,
      topicCoherence,
      engagementRate,
      sentimentScore,
      diversityIndex,
    })

    // Calculate additional metrics
    const agentContributionRate = this.calculateAgentContributionRate(context)
    const topicVariety = context.activeTopics.filter(t => t.isActive).length
    const threadDepth = this.calculateAverageThreadDepth(context)

    return {
      // Primary metrics
      density,
      quality,

      // Intermediate density metrics
      messageFrequency,
      participationRate,
      responseTime,
      continuityScore,

      // Intermediate quality metrics
      contentQuality,
      topicCoherence,
      engagementRate,
      sentimentScore,
      diversityIndex,

      // Additional metrics
      agentContributionRate,
      topicVariety,
      threadDepth,

      calculatedAt: new Date(),
    }
  }

  // ===== DENSITY METRICS =====

  /**
   * Calculate primary density metric
   * Formula: (message_frequency / optimal) × continuity_factor × participation_weight
   */
  private calculateDensity(components: {
    messageFrequency: number
    participationRate: number
    continuityScore: number
  }): number {
    const { messageFrequency, participationRate, continuityScore } = components

    // Normalize frequency (0-1, where optimal = 1.0)
    const normalizedFrequency = Math.min(
      1.0,
      messageFrequency / MetricsEngine.OPTIMAL_MESSAGES_PER_HOUR
    )

    // Weight components
    const density =
      normalizedFrequency * 0.5 +  // 50% weight on frequency
      continuityScore * 0.3 +       // 30% weight on continuity
      participationRate * 0.2       // 20% weight on participation

    return this.clamp(density, 0, 1)
  }

  /**
   * Calculate message frequency (messages per hour)
   */
  private calculateMessageFrequency(context: ConversationContext): number {
    const oneHourAgo = Date.now() - 3600000
    const recentMessages = context.recentMessages.filter(
      m => m.timestamp.getTime() > oneHourAgo
    )
    return recentMessages.length
  }

  /**
   * Calculate participation rate (% of active participants)
   */
  private calculateParticipationRate(context: ConversationContext): number {
    const totalParticipants = context.participants.size
    if (totalParticipants === 0) return 0

    const oneHourAgo = Date.now() - 3600000
    const activeParticipants = new Set(
      context.recentMessages
        .filter(m => m.timestamp.getTime() > oneHourAgo)
        .map(m => m.senderId || m.anonymousSenderId)
        .filter(Boolean)
    )

    return activeParticipants.size / totalParticipants
  }

  /**
   * Calculate average response time between messages
   */
  private calculateAverageResponseTime(context: ConversationContext): number {
    if (context.recentMessages.length < 2) {
      return MetricsEngine.MAX_RESPONSE_TIME_MS
    }

    const times: number[] = []
    for (let i = 1; i < context.recentMessages.length; i++) {
      const current = context.recentMessages[i].timestamp.getTime()
      const previous = context.recentMessages[i - 1].timestamp.getTime()
      times.push(current - previous)
    }

    return times.reduce((a, b) => a + b, 0) / times.length
  }

  /**
   * Calculate continuity score (lack of large gaps in conversation)
   */
  private calculateContinuityScore(context: ConversationContext): number {
    if (context.recentMessages.length < 2) return 0

    const gaps: number[] = []
    for (let i = 1; i < context.recentMessages.length; i++) {
      const current = context.recentMessages[i].timestamp.getTime()
      const previous = context.recentMessages[i - 1].timestamp.getTime()
      gaps.push(current - previous)
    }

    // Calculate penalty for large gaps
    const largePenalty = gaps.filter(g => g > MetricsEngine.CONTINUITY_WINDOW_MS).length
    const penaltyRatio = largePenalty / gaps.length

    // Continuity = 1 - penalty_ratio
    return Math.max(0, 1 - penaltyRatio)
  }

  // ===== QUALITY METRICS =====

  /**
   * Calculate primary quality metric
   * Weighted average of quality components
   */
  private calculateQuality(components: {
    contentQuality: number
    topicCoherence: number
    engagementRate: number
    sentimentScore: SentimentScore
    diversityIndex: number
  }): number {
    const {
      contentQuality,
      topicCoherence,
      engagementRate,
      sentimentScore,
      diversityIndex,
    } = components

    // Normalize sentiment (-1 to 1) to (0 to 1)
    const normalizedSentiment = (sentimentScore.score + 1) / 2

    // Weighted average
    const quality =
      contentQuality * 0.3 +       // 30% - Content quality
      topicCoherence * 0.25 +      // 25% - Topic relevance
      engagementRate * 0.2 +       // 20% - Engagement
      normalizedSentiment * 0.15 + // 15% - Sentiment
      diversityIndex * 0.1         // 10% - Diversity

    return this.clamp(quality, 0, 1)
  }

  /**
   * Calculate content quality score
   * Based on message length, complexity, and linguistic quality
   */
  private calculateContentQuality(context: ConversationContext): number {
    if (context.recentMessages.length === 0) return 0

    const scores = context.recentMessages.map(msg => {
      const length = msg.content.length

      // Length score (optimal 100-500 chars)
      const lengthScore = length < 10
        ? 0.2
        : length < 50
        ? 0.5
        : length < 100
        ? 0.7
        : length < 500
        ? 1.0
        : 0.8  // Too long

      // Word variety score (unique words / total words)
      const words = msg.content.toLowerCase().split(/\s+/)
      const uniqueWords = new Set(words)
      const varietyScore = words.length > 0 ? uniqueWords.size / words.length : 0

      // Sentence structure score (presence of punctuation)
      const hasPunctuation = /[.!?]/.test(msg.content)
      const punctuationScore = hasPunctuation ? 1.0 : 0.5

      // Combined score
      return (lengthScore * 0.5 + varietyScore * 0.3 + punctuationScore * 0.2)
    })

    return scores.reduce((a, b) => a + b, 0) / scores.length
  }

  /**
   * Calculate topic coherence (how well messages stay on topic)
   */
  private calculateTopicCoherence(context: ConversationContext): number {
    if (context.activeTopics.length === 0) return 0.5  // Neutral

    // Count how many recent messages relate to active topics
    const recentMessagesWithTopics = context.recentMessages.filter(msg => {
      const content = msg.content.toLowerCase()
      return context.activeTopics.some(topic =>
        topic.keywords.some(keyword =>
          content.includes(keyword.toLowerCase())
        )
      )
    })

    if (context.recentMessages.length === 0) return 0

    const coherence = recentMessagesWithTopics.length / context.recentMessages.length

    return this.clamp(coherence, 0, 1)
  }

  /**
   * Calculate engagement rate (replies and interactions per message)
   */
  private calculateEngagementRate(context: ConversationContext): number {
    if (context.recentMessages.length === 0) return 0

    // Count messages with replies
    const repliesCount = context.recentMessages.filter(m => m.replyTo).length

    // Engagement = % of messages that are replies or generate replies
    const engagementRate = repliesCount / context.recentMessages.length

    return this.clamp(engagementRate, 0, 1)
  }

  /**
   * Calculate average sentiment across recent messages
   */
  private calculateAverageSentiment(context: ConversationContext): SentimentScore {
    if (context.recentMessages.length === 0) {
      return { score: 0, magnitude: 0, label: 'neutral' }
    }

    // Simple sentiment estimation based on content
    // In production, use proper sentiment analysis library
    let totalScore = 0
    let totalMagnitude = 0

    context.recentMessages.forEach(msg => {
      const sentiment = this.estimateSentiment(msg.content)
      totalScore += sentiment.score
      totalMagnitude += sentiment.magnitude
    })

    const avgScore = totalScore / context.recentMessages.length
    const avgMagnitude = totalMagnitude / context.recentMessages.length

    const label =
      avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral'

    return {
      score: avgScore,
      magnitude: avgMagnitude,
      label,
    }
  }

  /**
   * Simple sentiment estimation (placeholder - use proper library in production)
   */
  private estimateSentiment(text: string): SentimentScore {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'thanks', 'perfect']
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'problem', 'issue', 'wrong']

    const lowerText = text.toLowerCase()
    let score = 0

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.2
    })

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.2
    })

    const magnitude = Math.abs(score)
    score = this.clamp(score, -1, 1)

    return {
      score,
      magnitude: Math.min(1, magnitude),
      label: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
    }
  }

  /**
   * Calculate diversity index (variety of participants and topics)
   */
  private calculateDiversityIndex(context: ConversationContext): number {
    if (context.recentMessages.length === 0) return 0

    // Participant diversity
    const uniqueParticipants = new Set(
      context.recentMessages
        .map(m => m.senderId || m.anonymousSenderId)
        .filter(Boolean)
    )
    const participantDiversity = uniqueParticipants.size / Math.max(1, context.participants.size)

    // Topic diversity
    const topicDiversity = Math.min(1, context.activeTopics.length / 5)  // Optimal ~5 topics

    // Combined
    return (participantDiversity * 0.6 + topicDiversity * 0.4)
  }

  // ===== ADDITIONAL METRICS =====

  /**
   * Calculate agent contribution rate
   */
  private calculateAgentContributionRate(context: ConversationContext): number {
    if (context.recentMessages.length === 0) return 0

    const agentMessages = context.recentMessages.filter(m =>
      // Assuming agent messages have a specific marker or username
      // This would need to be adapted based on how agents are identified
      false  // Placeholder
    )

    return agentMessages.length / context.recentMessages.length
  }

  /**
   * Calculate average thread depth (reply chains)
   */
  private calculateAverageThreadDepth(context: ConversationContext): number {
    const depths: number[] = []

    context.recentMessages.forEach(msg => {
      let depth = 0
      let current = msg
      while (current.replyTo) {
        depth++
        current = current.replyTo
      }
      depths.push(depth)
    })

    if (depths.length === 0) return 0
    return depths.reduce((a, b) => a + b, 0) / depths.length
  }

  // ===== UTILITY =====

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  /**
   * Get trend for a metric (improving, stable, declining)
   */
  getTrend(history: number[]): 'improving' | 'stable' | 'declining' {
    if (history.length < 2) return 'stable'

    const recent = history.slice(-3)
    const older = history.slice(-6, -3)

    if (older.length === 0) return 'stable'

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length

    const diff = recentAvg - olderAvg

    if (diff > 0.05) return 'improving'
    if (diff < -0.05) return 'declining'
    return 'stable'
  }

  /**
   * Check if metrics meet targets
   */
  meetsTargets(
    metrics: ConversationMetrics,
    targets: { density: number; quality: number }
  ): boolean {
    return (
      metrics.density >= targets.density && metrics.quality >= targets.quality
    )
  }

  /**
   * Calculate distance from targets (for optimization)
   */
  distanceFromTargets(
    metrics: ConversationMetrics,
    targets: { density: number; quality: number }
  ): number {
    const densityGap = Math.max(0, targets.density - metrics.density)
    const qualityGap = Math.max(0, targets.quality - metrics.quality)

    // Euclidean distance
    return Math.sqrt(densityGap ** 2 + qualityGap ** 2)
  }
}
