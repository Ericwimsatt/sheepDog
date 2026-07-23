import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  checkpointPath,
  computeCallId,
  loadScriptCheckpoint,
  saveScriptCheckpoint,
  clearScriptCheckpoint,
  hasCompletedCall,
  recordCompletedCall,
  recordSkippedCall,
} from '../checkpoint.js'
import type { ScriptCheckpoint, CallLogEntry } from '../types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-cp-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeCheckpoint(overrides?: Partial<ScriptCheckpoint>): ScriptCheckpoint {
  return {
    taskName: 'test-task',
    completedCalls: [],
    ...overrides,
  }
}

describe('checkpointPath', () => {
  it('returns path to .sheepdog-checkpoint.json', () => {
    const result = checkpointPath(tmpDir)
    expect(result).toBe(join(tmpDir, '.sheepdog-checkpoint.json'))
  })
})

describe('computeCallId', () => {
  it('produces a deterministic hash', () => {
    const id1 = computeCallId('runAgentStep', [{ planFile: 'plan.md' }])
    const id2 = computeCallId('runAgentStep', [{ planFile: 'plan.md' }])
    expect(id1).toBe(id2)
  })

  it('produces different ids for different names', () => {
    const id1 = computeCallId('runAgentStep', [{ planFile: 'plan.md' }])
    const id2 = computeCallId('run_command', [{ planFile: 'plan.md' }])
    expect(id1).not.toBe(id2)
  })

  it('produces different ids for different args', () => {
    const id1 = computeCallId('runAgentStep', [{ planFile: 'a.md' }])
    const id2 = computeCallId('runAgentStep', [{ planFile: 'b.md' }])
    expect(id1).not.toBe(id2)
  })

  it('handles undefined args', () => {
    const id = computeCallId('fn', [undefined])
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('handles null args', () => {
    const id = computeCallId('fn', [null])
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('handles nested objects', () => {
    const id = computeCallId('fn', [{ a: { b: { c: 1 } } }])
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('handles very long strings', () => {
    const longStr = 'x'.repeat(10000)
    const id = computeCallId('fn', [longStr])
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns a 64-character hex string (SHA-256)', () => {
    const id = computeCallId('fn', [1, 2, 3])
    expect(id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces hash that depends on arg order', () => {
    const id1 = computeCallId('fn', [1, 2])
    const id2 = computeCallId('fn', [2, 1])
    expect(id1).not.toBe(id2)
  })
})

describe('loadScriptCheckpoint', () => {
  it('returns empty state when no file exists', () => {
    const cp = loadScriptCheckpoint(tmpDir)
    expect(cp.taskName).toBe('')
    expect(cp.completedCalls).toEqual([])
  })

  it('returns empty state when file is corrupt', () => {
    writeFileSync(checkpointPath(tmpDir), 'not-json', 'utf-8')
    const cp = loadScriptCheckpoint(tmpDir)
    expect(cp.taskName).toBe('')
    expect(cp.completedCalls).toEqual([])
  })

  it('loads a saved checkpoint', () => {
    const cp = makeCheckpoint({
      taskName: 'my-task',
      completedCalls: [
        { id: 'abc', name: 'runAgentStep', args: [{ planFile: 'plan.md' }], result: { ok: true }, completedAt: '2025-01-01T00:00:00.000Z' },
      ],
    })
    saveScriptCheckpoint(tmpDir, cp)
    const loaded = loadScriptCheckpoint(tmpDir)
    expect(loaded.taskName).toBe('my-task')
    expect(loaded.completedCalls).toHaveLength(1)
    expect(loaded.completedCalls[0].id).toBe('abc')
  })

  it('preserves skipped field on load', () => {
    const cp = makeCheckpoint({
      completedCalls: [
        { id: 'abc', name: 'fn', args: [], result: 'ok', skipped: true },
      ],
    })
    saveScriptCheckpoint(tmpDir, cp)
    const loaded = loadScriptCheckpoint(tmpDir)
    expect(loaded.completedCalls[0].skipped).toBe(true)
  })
})

describe('saveScriptCheckpoint', () => {
  it('writes a valid JSON file', () => {
    const cp = makeCheckpoint({ taskName: 'save-test' })
    saveScriptCheckpoint(tmpDir, cp)

    const path = checkpointPath(tmpDir)
    expect(existsSync(path)).toBe(true)

    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.taskName).toBe('save-test')
    expect(parsed.completedCalls).toEqual([])
  })

  it('overwrites existing file', () => {
    const cp1 = makeCheckpoint({ taskName: 'first' })
    saveScriptCheckpoint(tmpDir, cp1)

    const cp2 = makeCheckpoint({ taskName: 'second' })
    saveScriptCheckpoint(tmpDir, cp2)

    const loaded = loadScriptCheckpoint(tmpDir)
    expect(loaded.taskName).toBe('second')
  })
})

describe('clearScriptCheckpoint', () => {
  it('removes the checkpoint file', () => {
    saveScriptCheckpoint(tmpDir, makeCheckpoint())
    expect(existsSync(checkpointPath(tmpDir))).toBe(true)

    clearScriptCheckpoint(tmpDir)
    expect(existsSync(checkpointPath(tmpDir))).toBe(false)
  })

  it('does not throw if file does not exist', () => {
    expect(() => clearScriptCheckpoint(tmpDir)).not.toThrow()
  })
})

describe('hasCompletedCall', () => {
  it('returns undefined when no match', () => {
    const cp = makeCheckpoint()
    expect(hasCompletedCall(cp, 'nonexistent')).toBeUndefined()
  })

  it('finds a matching entry', () => {
    const cp = makeCheckpoint({
      completedCalls: [
        { id: 'abc', name: 'fn', args: [], result: 42 },
      ],
    })
    const found = hasCompletedCall(cp, 'abc')
    expect(found).toBeDefined()
    expect(found!.name).toBe('fn')
    expect(found!.result).toBe(42)
  })

  it('returns first match when ids are duplicated', () => {
    const cp = makeCheckpoint({
      completedCalls: [
        { id: 'dup', name: 'first', args: [], result: 1 },
        { id: 'dup', name: 'second', args: [], result: 2 },
      ],
    })
    const found = hasCompletedCall(cp, 'dup')
    expect(found!.name).toBe('first')
  })

  it('finds skipped entries', () => {
    const cp = makeCheckpoint({
      completedCalls: [
        { id: 'skip', name: 'fn', args: [], result: null, skipped: true },
      ],
    })
    const found = hasCompletedCall(cp, 'skip')
    expect(found).toBeDefined()
    expect(found!.skipped).toBe(true)
  })
})

describe('recordCompletedCall', () => {
  it('appends an entry to the checkpoint', () => {
    const cp = makeCheckpoint()
    recordCompletedCall(cp, 'id-1', 'runAgentStep', [{ planFile: 'plan.md' }], { ok: true })

    expect(cp.completedCalls).toHaveLength(1)
    expect(cp.completedCalls[0].id).toBe('id-1')
    expect(cp.completedCalls[0].name).toBe('runAgentStep')
    expect(cp.completedCalls[0].args).toEqual([{ planFile: 'plan.md' }])
    expect(cp.completedCalls[0].result).toEqual({ ok: true })
  })

  it('sets completedAt timestamp', () => {
    const cp = makeCheckpoint()
    recordCompletedCall(cp, 'id-1', 'fn', [], 'done')
    expect(cp.completedCalls[0].completedAt).toBeDefined()
    expect(typeof cp.completedCalls[0].completedAt).toBe('string')
    expect(new Date(cp.completedCalls[0].completedAt!).getTime()).not.toBeNaN()
  })

  it('does not set skipped flag', () => {
    const cp = makeCheckpoint()
    recordCompletedCall(cp, 'id-1', 'fn', [], 'done')
    expect(cp.completedCalls[0].skipped).toBeUndefined()
  })

  it('appends multiple calls in order', () => {
    const cp = makeCheckpoint()
    recordCompletedCall(cp, 'a', 'fn1', [], 1)
    recordCompletedCall(cp, 'b', 'fn2', [], 2)
    expect(cp.completedCalls).toHaveLength(2)
    expect(cp.completedCalls[0].id).toBe('a')
    expect(cp.completedCalls[1].id).toBe('b')
  })
})

describe('recordSkippedCall', () => {
  it('appends an entry with skipped=true', () => {
    const cp = makeCheckpoint()
    recordSkippedCall(cp, 'id-1', 'runAgentStep', [{ planFile: 'plan.md' }], { cached: true })

    expect(cp.completedCalls).toHaveLength(1)
    expect(cp.completedCalls[0].id).toBe('id-1')
    expect(cp.completedCalls[0].name).toBe('runAgentStep')
    expect(cp.completedCalls[0].args).toEqual([{ planFile: 'plan.md' }])
    expect(cp.completedCalls[0].result).toEqual({ cached: true })
    expect(cp.completedCalls[0].skipped).toBe(true)
  })

  it('does not set completedAt', () => {
    const cp = makeCheckpoint()
    recordSkippedCall(cp, 'id-1', 'fn', [], 'ok')
    expect(cp.completedCalls[0].completedAt).toBeUndefined()
  })
})

describe('round-trip (save + load)', () => {
  it('persists all fields correctly', () => {
    const original = makeCheckpoint({
      taskName: 'full-test',
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T01:00:00.000Z',
      completedCalls: [
        { id: '1', name: 'fn1', args: [1], result: 'a', completedAt: '2025-01-01T00:30:00.000Z' },
        { id: '2', name: 'fn2', args: [{ nested: { key: 'val' } }], result: null, skipped: true },
      ],
    })

    saveScriptCheckpoint(tmpDir, original)
    const loaded = loadScriptCheckpoint(tmpDir)

    expect(loaded.taskName).toBe('full-test')
    expect(loaded.startedAt).toBe('2025-01-01T00:00:00.000Z')
    expect(loaded.completedAt).toBe('2025-01-01T01:00:00.000Z')
    expect(loaded.completedCalls).toHaveLength(2)
    expect(loaded.completedCalls[0].id).toBe('1')
    expect(loaded.completedCalls[0].result).toBe('a')
    expect(loaded.completedCalls[1].id).toBe('2')
    expect(loaded.completedCalls[1].skipped).toBe(true)
    expect(loaded.completedCalls[1].args[0]).toEqual({ nested: { key: 'val' } })
  })
})
