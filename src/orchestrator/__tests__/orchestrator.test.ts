import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Orchestrator } from '../orchestrator.js'

type ExecFileCallback = (...args: any[]) => void

const mockExecImpl = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => {
    const cb = args[args.length - 1] as ExecFileCallback
    try {
      const result = mockExecImpl(args[0], args[1])
      if (result && typeof (result as any).then === 'function') {
        (result as Promise<any>).then(
          (res: any) => cb(null, res),
          (err: Error) => cb(err),
        )
      } else {
        cb(null, result ?? { stdout: '', stderr: '' })
      }
    } catch (err) {
      cb(err)
    }
  },
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
    mockExecImpl.mockReturnValue({ stdout: 'ok', stderr: '' })

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
    mockExecImpl.mockReturnValue({ stdout: 'ok', stderr: '' })

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

    mockExecImpl.mockImplementation(() => {
      const err = new Error('test failed') as any
      err.code = 1
      err.stderr = 'failure'
      throw err
    })

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

    mockExecImpl.mockImplementation(() => {
      const err = new Error('test failed') as any
      err.code = 1
      err.stderr = 'failure'
      throw err
    })

    const result = await orchestrator.runTask(tmpDir)

    expect(result.status).toBe('failed')
    expect(result.phases).toHaveLength(1)
    expect(mockHerdrStart).toHaveBeenCalledTimes(1)
  })

  it('runs after-all tests', async () => {
    writeTaskWithAfterAll()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')
    mockExecImpl.mockReturnValue({ stdout: 'ok', stderr: '' })

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(mockExecImpl).toHaveBeenCalled()
  })

  it('runs before-all commands', async () => {
    writeTaskWithRunBeforeAll()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')
    mockExecImpl.mockReturnValue({ stdout: 'ok', stderr: '' })

    const result = await runOrchestrator()

    expect(result.status).toBe('completed')
    expect(mockExecImpl).toHaveBeenCalled()
  })

  it('returns correct TaskState', async () => {
    writeValidTask()
    scheduleDoneMarker()
    mockHerdrReadOutput.mockResolvedValue('output')
    mockExecImpl.mockReturnValue({ stdout: 'ok', stderr: '' })

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
    mockExecImpl.mockReturnValue({ stdout: 'ok', stderr: '' })

    await runOrchestrator()

    expect(existsSync(join(tmpDir, '.active-phase'))).toBe(false)
    expect(existsSync(join(tmpDir, '.phase-done'))).toBe(false)
  })
})
