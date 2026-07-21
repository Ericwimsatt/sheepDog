import { describe, it, expect } from 'vitest'
import { TaskSchema } from '../task-schema.js'

const minimalTask = {
  name: 'test-task',
  phases: [{ id: 'p1', file: 'phase1.md', label: 'Phase 1' }],
}

const fullTask = {
  name: 'full-task',
  phases: [
    { id: 'p1', file: 'phase1.md', label: 'Phase 1' },
    { id: 'p2', file: 'phase2.md', label: 'Phase 2' },
  ],
  runBetween: [
    { command: 'npm test', optional: true },
  ],
  runAfterAll: [
    { command: 'npm run lint' },
  ],
  onTestFailure: { action: 'append_to_next_phase' },
}

describe('TaskSchema', () => {
  it('parses a valid minimal task', () => {
    const result = TaskSchema.safeParse(minimalTask)
    expect(result.success).toBe(true)
  })

  it('parses a valid full task', () => {
    const result = TaskSchema.safeParse(fullTask)
    expect(result.success).toBe(true)
  })

  it('fails when name is missing', () => {
    const { name, ...noName } = minimalTask as any
    const result = TaskSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it('fails when phases array is empty', () => {
    const result = TaskSchema.safeParse({ ...minimalTask, phases: [] })
    expect(result.success).toBe(false)
  })

  it('fails when onTestFailure.action is invalid', () => {
    const result = TaskSchema.safeParse({
      ...minimalTask,
      onTestFailure: { action: 'invalid_action' },
    })
    expect(result.success).toBe(false)
  })

  it('applies default values correctly', () => {
    const result = TaskSchema.safeParse(minimalTask)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.runBetween).toEqual([])
      expect(result.data.runAfterAll).toEqual([])
      expect(result.data.onTestFailure).toEqual({ action: 'stop' })
    }
  })
})
