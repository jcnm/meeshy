/**
 * Working Memory Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WorkingMemory } from '../src/memory/WorkingMemory'
import type { Message } from '../src/types'

describe('WorkingMemory', () => {
  let memory: WorkingMemory

  beforeEach(() => {
    memory = new WorkingMemory({
      maxMessages: 10,
      maxAge: 60000, // 1 minute
    })
  })

  const createMockMessage = (id: string, content: string): Message => ({
    id,
    conversationId: 'test-conv',
    content,
    originalLanguage: 'en',
    messageType: 'text',
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(),
    timestamp: new Date(),
  })

  it('should add and retrieve messages', () => {
    const message = createMockMessage('msg1', 'Hello')
    memory.add(message)

    const retrieved = memory.get('msg1')
    expect(retrieved).toBeDefined()
    expect(retrieved?.message.content).toBe('Hello')
  })

  it('should return undefined for non-existent message', () => {
    const retrieved = memory.get('non-existent')
    expect(retrieved).toBeUndefined()
  })

  it('should get recent messages', () => {
    memory.add(createMockMessage('msg1', 'First'))
    memory.add(createMockMessage('msg2', 'Second'))
    memory.add(createMockMessage('msg3', 'Third'))

    const recent = memory.getRecent(2)
    expect(recent).toHaveLength(2)
    expect(recent[0].message.content).toBe('Third')
    expect(recent[1].message.content).toBe('Second')
  })

  it('should filter by conversation', () => {
    const msg1 = createMockMessage('msg1', 'Conv1')
    msg1.conversationId = 'conv1'
    const msg2 = createMockMessage('msg2', 'Conv2')
    msg2.conversationId = 'conv2'

    memory.add(msg1)
    memory.add(msg2)

    const conv1Messages = memory.getByConversation('conv1')
    expect(conv1Messages).toHaveLength(1)
    expect(conv1Messages[0].message.content).toBe('Conv1')
  })

  it('should search messages by content', () => {
    memory.add(createMockMessage('msg1', 'Hello world'))
    memory.add(createMockMessage('msg2', 'Goodbye world'))
    memory.add(createMockMessage('msg3', 'Something else'))

    const results = memory.search('world')
    expect(results).toHaveLength(2)
  })

  it('should remove messages', () => {
    memory.add(createMockMessage('msg1', 'Test'))

    expect(memory.get('msg1')).toBeDefined()

    const removed = memory.remove('msg1')
    expect(removed).toBe(true)
    expect(memory.get('msg1')).toBeUndefined()
  })

  it('should clear all messages', () => {
    memory.add(createMockMessage('msg1', 'Test1'))
    memory.add(createMockMessage('msg2', 'Test2'))

    expect(memory.getAll()).toHaveLength(2)

    memory.clear()
    expect(memory.getAll()).toHaveLength(0)
  })

  it('should track access count', () => {
    memory.add(createMockMessage('msg1', 'Test'))

    const first = memory.get('msg1')
    expect(first?.accessCount).toBe(1)

    const second = memory.get('msg1')
    expect(second?.accessCount).toBe(2)
  })

  it('should provide stats', () => {
    memory.add(createMockMessage('msg1', 'Test1'))
    memory.add(createMockMessage('msg2', 'Test2'))

    const stats = memory.getStats()
    expect(stats.totalEntries).toBe(2)
    expect(stats.oldestEntry).toBeDefined()
    expect(stats.newestEntry).toBeDefined()
  })
})
