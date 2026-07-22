import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  writeCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
  getResumePhaseId,
  checkpointPath,
} from '../checkpoint.js'
import type { TaskState } from '../../types/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-cp-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeState(overrides?: Partial<TaskState>): TaskState {
  return {
    taskName: 'test-task',
    status: 'running',
    phases: [],
    currentPhaseIndex: 0,
    startedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('checkpoint', () => {
  it('writes and loads checkpoint', () => {
    const state = makeState()
    writeCheckpoint(tmpDir, state)

    const path = checkpointPath(tmpDir)
    expect(existsSync(path)).toBe(true)

    const loaded = loadCheckpoint(tmpDir)
    expect(loaded).not.toBeNull()
    expect(loaded!.taskName).toBe('test-task')
    expect(loaded!.status).toBe('running')
  })

  it('clears checkpoint', () => {
    writeCheckpoint(tmpDir, makeState())
    expect(existsSync(checkpointPath(tmpDir))).toBe(true)

    clearCheckpoint(tmpDir)
    expect(existsSync(checkpointPath(tmpDir))).toBe(false)
  })

  it('returns null when no checkpoint exists', () => {
    expect(loadCheckpoint(tmpDir)).toBeNull()
  })

  it('persists phase state with test results', () => {
    const state = makeState({
      phases: [
        {
          phaseId: 'phase-1',
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          testResults: [
            { command: 'npm test', exitCode: 0, stdout: '', stderr: '', passed: true },
          ],
        },
      ],
      currentPhaseIndex: 1,
    })

    writeCheckpoint(tmpDir, state)
    const loaded = loadCheckpoint(tmpDir)
    expect(loaded!.phases).toHaveLength(1)
    expect(loaded!.phases[0].phaseId).toBe('phase-1')
    expect(loaded!.phases[0].testResults[0].passed).toBe(true)
  })

  it('getResumePhaseId returns null for completed tasks', () => {
    const state = makeState({
      status: 'completed',
      phases: [
        {
          phaseId: 'phase-1',
          status: 'completed',
          testResults: [],
        },
      ],
      currentPhaseIndex: 1,
    })
    writeCheckpoint(tmpDir, state)
    expect(getResumePhaseId(tmpDir)).toBeNull()
  })

  it('getResumePhaseId returns phaseId for failed tasks', () => {
    const state = makeState({
      status: 'failed',
      phases: [
        {
          phaseId: 'phase-1',
          status: 'completed',
          testResults: [],
        },
        {
          phaseId: 'phase-2',
          status: 'completed',
          testResults: [
            { command: 'npm test', exitCode: 1, stdout: '', stderr: 'failure', passed: false },
          ],
        },
      ],
      currentPhaseIndex: 2,
    })
    writeCheckpoint(tmpDir, state)
    expect(getResumePhaseId(tmpDir)).toBe('phase-2')
  })

  it('returns null when no phases in checkpoint', () => {
    writeCheckpoint(tmpDir, makeState({ status: 'failed' }))
    expect(getResumePhaseId(tmpDir)).toBeNull()
  })

  it('handles corrupt checkpoint gracefully', () => {
    writeFileSync(checkpointPath(tmpDir), 'not-json', 'utf-8')
    expect(loadCheckpoint(tmpDir)).toBeNull()
  })

  it('persists across sequential writes', () => {
    const state1 = makeState({
      phases: [
        {
          phaseId: 'phase-1',
          status: 'completed',
          testResults: [],
        },
      ],
      currentPhaseIndex: 1,
    })
    writeCheckpoint(tmpDir, state1)

    const state2 = makeState({
      status: 'failed',
      phases: [
        {
          phaseId: 'phase-1',
          status: 'completed',
          testResults: [],
        },
        {
          phaseId: 'phase-2',
          status: 'completed',
          testResults: [
            { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
          ],
        },
      ],
      currentPhaseIndex: 2,
    })
    writeCheckpoint(tmpDir, state2)

    const loaded = loadCheckpoint(tmpDir)
    expect(loaded!.phases).toHaveLength(2)
    expect(loaded!.status).toBe('failed')
  })
})
