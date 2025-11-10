/**
 * AAMS - Advanced Agent Mentor System
 * Entry point for the application
 */

export { MentorAgent } from './core/MentorAgent'
export { type AgentConfig, type AgentState } from './core/AgentConfig'
export { MeeshyAPIAdapter, type MeeshyAPIConfig } from './platform/adapters/MeeshyAPIAdapter'
export { MeeshyCLIAdapter, type MeeshyCLIConfig } from './platform/adapters/MeeshyCLIAdapter'
export { PlatformRegistry, platformRegistry } from './platform/PlatformRegistry'
export { WorkingMemory } from './memory/WorkingMemory'
export { MetricsEngine } from './engines/MetricsEngine'
export { ConfigLoader } from './utils/config-loader'
export { logger } from './utils/logger'
export * from './utils/errors'
export * from './types'
export * from './types/platform'
