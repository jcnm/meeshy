#!/usr/bin/env node
/**
 * CLI Entry Point for AAMS
 */

import { MentorAgent } from './core/MentorAgent'
import { MeeshyAPIAdapter } from './platform/adapters/MeeshyAPIAdapter'
import { MeeshyCLIAdapter } from './platform/adapters/MeeshyCLIAdapter'
import { ConfigLoader } from './utils/config-loader'
import { logger } from './utils/logger'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: aams <config-file.yaml>')
    console.error('')
    console.error('Example:')
    console.error('  aams config/agents/my-agent.yaml')
    process.exit(1)
  }

  const configPath = args[0]

  try {
    // Load configuration
    logger.info('Loading configuration...', { path: configPath })
    const config = ConfigLoader.loadFromFile(configPath)

    // Create platform adapter
    let adapter
    if (config.platform.adapter === 'api') {
      adapter = new MeeshyAPIAdapter({
        apiUrl: config.platform.apiUrl || 'https://gate.meeshy.me',
        username: config.platform.username,
        password: config.platform.password,
      })
    } else {
      adapter = new MeeshyCLIAdapter({
        username: config.platform.username,
        password: config.platform.password,
        apiUrl: config.platform.apiUrl,
      })
    }

    // Create agent
    logger.info('Creating mentor agent...', { id: config.id })
    const agent = new MentorAgent(config, adapter)

    // Handle shutdown gracefully
    const shutdown = async () => {
      logger.info('Shutting down...')
      await agent.stop()
      await adapter.shutdown()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Start agent
    logger.info('Starting mentor agent...')
    await agent.start()

    logger.info('Mentor agent is running!', {
      id: config.id,
      conversation: config.conversationId,
    })

    // Keep process alive
    process.stdin.resume()

  } catch (error) {
    logger.error('Fatal error', error as Error)
    process.exit(1)
  }
}

main()
