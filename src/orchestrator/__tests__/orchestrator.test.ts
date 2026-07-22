import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Orchestrator } from '../orchestrator.js'
import { checkpointPath, loadCheckpoint } from '../../checkpoint/checkpoint.js'

const mockSpawn = vi.hoisted(() => vi.fn())
let onErrorCb: ((...args: any[]) => void) | undefined
let onExitCb: ((...args: any[]) => void) | undefined

vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
}))

const mockHerdrStart = vi.fn()
const mockHerdrReadOutput = vi.fn()

vi.mock('../../session/herdr-session.js', () => ({
  HerdrSessionManager: vi.fn().mockImplementation(() => ({
    startAgent: mockHerdrStart,
    waitForStatus: vi.fn(),
    readPaneOutput: mockHerdrReadOutput,
    closePane: vi.fn(),
    listAgents: vi.fn(),
    getAgent: vi.fn(),
  })),
}))

let tmpDir: string

beforeEach(() => {
  vi.clearAllMocks()
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-ortest-'))
  onErrorCb = undefined
  onExitCb = undefined
  mockSpawn.mockImplementation(() => {
    const cbs: Record<string, (...args: any[]) => void> = {}
    const proc = {
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        cbs[event] = cb
        return proc
      }),
    }
    setImmediate(() => {
      if (cbs.exit) cbs.exit(0)
    })
    return proc
  })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function scheduleDoneMarker(): void {
  mockHerdrStart.mockImplementation(async () => {
    setTimeout(() => {
      writeFileSync(join(tmpDir, '.phase-done'), 'done', 'utf-8')
    }, 50)
    return { paneId: 'pane_test', agentName: 'test-agent', status: 'running' }
  })
}

function writeValidTask(overrides: string = ''): void {
  const yaml = `
name: test-task
phases:
  - description: "Phase 1"
  - description: "Phase 2"
${overrides}
`
  writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')
}

function writeTaskWithRunAfter(): void {
  const yaml = `
name: test-task
phases:
  - description: "Phase 1"
    runAfter:
      - echo "check"
  - description: "Phase 2"
`
  writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')
}

function writeTaskWithRunBeforeAll(): void {
  const yaml = `
name: test-task
phases:
  - description: "Phase 1"
  - description: "Phase 2"
runBeforeAll:
  - echo "setup"
`
  writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')
}

function writeTaskWithAfterAll(): void {
  const yaml = `
name: test-task
phases:
  - description: "Phase 1"
  - description: "Phase 2"
runAfterAll:
  - echo "final"
`
  writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')
}

function writeTaskWithEverything(): void {
  const yaml = `
name: test-task
phases:
  - description: "Phase 1"
    runAfter:
      - echo "check"
  - description: "Phase 2"
runAfterAll:
  - echo "final"
`
  writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
  writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')
}

async function runOrchestrator(): Promise<ReturnType<Orchestrator['runTask']>> {
  const orchestrator = new Orchestrator()
  return orchestrator.runTask(tmpDir)
}

describe('Orchestrator', () => {
  it('runs all phases sequentially', async () => {
    writeValidTask()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('phase output')

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(result.phases).toHaveLength(2)
    expect(result.phases[0].phaseId).toBe('phase-1')
    expect(result.phases[1].phaseId).toBe('phase-2')
    expect(mockHerdrStart).toHaveBeenCalledTimes(2)
  })

  it('runs phase runAfter commands', async () => {
    writeTaskWithEverything()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(result.phases).toHaveLength(2)
    expect(result.phases[0].testResults).toHaveLength(1)
    expect(result.phases[0].testResults[0].passed).toBe(true)
  })

  it('passes test failures to next phase', async () => {
    const yaml = `
name: test-task
phases:
  - description: "Phase 1"
    runAfter:
      - echo "check"
  - description: "Phase 2"
onPhaseFailure: continue
`
    writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')

    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === 'error') cb(Object.assign(new Error('test failed'), { code: 1 }))
        if (event === 'exit') onExitCb = cb
      }),
    }))

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(result.phases).toHaveLength(2)
    expect(result.phases[0].testResults[0].passed).toBe(false)

    const p2Context = join(tmpDir, '.phase-context-phase-2.md')
    const content = readFileSync(p2Context, 'utf-8')
    expect(content).toContain('## Previous Phase Test Failures')
  })

  it('stops on onPhaseFailure: stop', async () => {
    const yaml = `
name: test-task
phases:
  - description: "Phase 1"
    runAfter:
      - echo "check"
  - description: "Phase 2"
onPhaseFailure: stop
`
    writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2 content\n', 'utf-8')

    const orchestrator = new Orchestrator()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === 'error') cb(Object.assign(new Error('test failed'), { code: 1 }))
        if (event === 'exit') onExitCb = cb
      }),
    }))

    const result = await orchestrator.runTask(tmpDir)

    expect(result.status).toBe('failed')
    expect(result.phases).toHaveLength(1)
    expect(mockHerdrStart).toHaveBeenCalledTimes(1)
  })

  it('runs after-all tests', async () => {
    writeTaskWithAfterAll()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(mockSpawn).toHaveBeenCalled()
  })

  it('runs before-all commands', async () => {
    writeTaskWithRunBeforeAll()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(mockSpawn).toHaveBeenCalled()
  })

  it('returns correct TaskState', async () => {
    writeValidTask()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    const result = await runOrchestrator()

    expect(result).toMatchObject({
      taskName: 'test-task',
      status: 'completed',
      phases: [
        { phaseId: 'phase-1', status: 'completed' },
        { phaseId: 'phase-2', status: 'completed' },
      ],
    })
    expect(result.startedAt).toBeDefined()
    expect(result.completedAt).toBeDefined()
  })

  it('cleans up marker files after completion', async () => {
    writeValidTask()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    await runOrchestrator()

    expect(existsSync(join(tmpDir, '.active-phase'))).toBe(false)
    expect(existsSync(join(tmpDir, '.phase-done'))).toBe(false)
  })

  it('writes checkpoint after each phase and verifies from TaskState', async () => {
    writeValidTask()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    const result = await runOrchestrator()

    expect(result.phases).toHaveLength(2)
    expect(result.phases[0].phaseId).toBe('phase-1')
    expect(result.phases[1].phaseId).toBe('phase-2')
    expect(existsSync(checkpointPath(tmpDir))).toBe(false)
  })

  it('clears checkpoint on successful completion', async () => {
    writeValidTask()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    await runOrchestrator()

    expect(existsSync(checkpointPath(tmpDir))).toBe(false)
  })

  it('preserves checkpoint on failure', async () => {
    const yaml = `
name: test-task
phases:
  - description: "Phase 1"
    runAfter:
      - echo "check"
onPhaseFailure: stop
`
    writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1 content\n', 'utf-8')

    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')
    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === 'error') cb(Object.assign(new Error('test failed'), { code: 1 }))
        if (event === 'exit') onExitCb = cb
      }),
    }))

    const orchestrator = new Orchestrator()
    const result = await orchestrator.runTask(tmpDir)

    expect(result.status).toBe('failed')
    const cp = loadCheckpoint(tmpDir)
    expect(cp).not.toBeNull()
    expect(cp!.status).toBe('failed')
    expect(cp!.phases).toHaveLength(1)
    expect(cp!.phases[0].phaseId).toBe('phase-1')
    expect(cp!.phases[0].testResults[0].passed).toBe(false)
  })

  it('resumes from checkpoint when no fromPhase given', async () => {
    const yaml = `
name: test-task
phases:
  - description: "Phase 1"
    runAfter:
      - echo "pass"
  - description: "Phase 2"
    runAfter:
      - echo "should-fail"
onPhaseFailure: stop
`
    writeFileSync(join(tmpDir, 'task.yaml'), yaml, 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-1.md'), 'Phase 1\n', 'utf-8')
    writeFileSync(join(tmpDir, 'todo-phase-2.md'), 'Phase 2\n', 'utf-8')

    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')

    let callCount = 0
    mockSpawn.mockImplementation(() => {
      callCount++
      const cbs: Record<string, (...args: any[]) => void> = {}
      const proc = {
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          cbs[event] = cb
          return proc
        }),
      }
      setImmediate(() => {
        if (cbs.exit) {
          if (callCount === 2) cbs.exit(1)
          else cbs.exit(0)
        }
      })
      return proc
    })

    const orchestrator1 = new Orchestrator()
    const result1 = await orchestrator1.runTask(tmpDir)
    expect(result1.status).toBe('failed')
    expect(result1.phases).toHaveLength(2)
    expect(result1.phases[1].testResults[0].passed).toBe(false)

    const cp = loadCheckpoint(tmpDir)
    expect(cp).not.toBeNull()
    expect(cp!.status).toBe('failed')

    const orchestrator2 = new Orchestrator()
    const result2 = await orchestrator2.runTask(tmpDir)
    expect(result2.status).toBe('completed')
    expect(result2.phases).toHaveLength(2)
    expect(result2.phases[0].phaseId).toBe('phase-1')
    expect(result2.phases[1].phaseId).toBe('phase-2')
    expect(result2.phases[1].testResults[0].command).toBe('echo "should-fail"')

    const cp2 = loadCheckpoint(tmpDir)
    expect(cp2).toBeNull()
  })
})
