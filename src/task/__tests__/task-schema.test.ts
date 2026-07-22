import { describe, it, expect } from 'vitest'
import { TaskYamlSchema } from '../task-schema.js'

const minimalTask = {
  name: 'test-task',
  phases: [{ description: 'Phase 1' }],
}

const fullTask = {
  name: 'full-task',
  phases: [
    { description: 'Phase 1', runAfter: ['npm test'] },
    { description: 'Phase 2' },
  ],
  runBeforeAll: ['npm install'],
  runAfterAll: ['npm run lint'],
  onPhaseFailure: 'continue',
  schemas: ['some-schema'],
}

describe('TaskYamlSchema', () => {
  it('parses a valid minimal task', () => {
    const result = TaskYamlSchema.safeParse(minimalTask)
    expect(result.success).toBe(true)
  })

  it('parses a valid full task', () => {
    const result = TaskYamlSchema.safeParse(fullTask)
    expect(result.success).toBe(true)
  })

  it('fails when name is missing', () => {
    const { name, ...noName } = minimalTask as any
    const result = TaskYamlSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it('fails when phases array is empty', () => {
    const result = TaskYamlSchema.safeParse({ ...minimalTask, phases: [] })
    expect(result.success).toBe(false)
  })

  it('fails when onPhaseFailure is invalid', () => {
    const result = TaskYamlSchema.safeParse({
      ...minimalTask,
      onPhaseFailure: 'invalid_action',
    })
    expect(result.success).toBe(false)
  })

  it('applies default values correctly', () => {
    const result = TaskYamlSchema.safeParse(minimalTask)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.runBeforeAll).toEqual([])
      expect(result.data.runAfterAll).toEqual([])
      expect(result.data.onPhaseFailure).toBe('stop')
      expect(result.data.phases[0].runAfter).toEqual([])
    }
  })
})
