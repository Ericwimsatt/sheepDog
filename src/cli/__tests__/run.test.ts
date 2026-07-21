import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mockLoadTaskByName = vi.fn()
const mockDiscoverTasks = vi.fn()
const mockRunTask = vi.fn()

vi.mock('../../task/task-loader.js', () => ({
  loadTaskByName: mockLoadTaskByName,
  discoverTasks: mockDiscoverTasks,
}))

vi.mock('../../orchestrator/index.js', () => ({
  Orchestrator: vi.fn().mockImplementation(() => ({
    runTask: mockRunTask,
  })),
}))

let exitCode: number | null = null
const originalExit = process.exit

let tmpDir: string

beforeEach(() => {
  vi.clearAllMocks()
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-run-'))
  exitCode = null
  process.exit = vi.fn((code?: number) => {
    exitCode = code ?? 0
  }) as any
})

afterEach(() => {
  process.exit = originalExit
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('runCommand', () => {
  it('calls Orchestrator.runTask with correct args', async () => {
    mockLoadTaskByName.mockReturnValue({ task: { name: 'test-task' }, taskDir: join(tmpDir, 'sheepdog', 'test-task') })
    mockRunTask.mockResolvedValue({ status: 'completed' })

    const { runCommand } = await import('../commands/run.js')
    await runCommand('test-task', { dir: tmpDir })

    expect(mockRunTask).toHaveBeenCalledTimes(1)
    expect(mockRunTask).toHaveBeenCalledWith(join(tmpDir, 'sheepdog', 'test-task'), {})
  })

  it('passes phase and fromPhase options', async () => {
    mockLoadTaskByName.mockReturnValue({ task: { name: 'test-task' }, taskDir: join(tmpDir, 'sheepdog', 'test-task') })
    mockRunTask.mockResolvedValue({ status: 'completed' })

    const { runCommand } = await import('../commands/run.js')
    await runCommand('test-task', { dir: tmpDir, phase: 'p1', fromPhase: 'p2' })

    expect(mockRunTask).toHaveBeenCalledWith(
      join(tmpDir, 'sheepdog', 'test-task'),
      { phase: 'p1', fromPhase: 'p2' },
    )
  })

  it('exits with code 1 when task is not found', async () => {
    mockLoadTaskByName.mockImplementation(() => { throw new Error('not found') })
    mockDiscoverTasks.mockReturnValue([])

    const { runCommand } = await import('../commands/run.js')
    await runCommand('unknown-task', { dir: tmpDir })

    expect(exitCode).toBe(1)
    expect(mockDiscoverTasks).toHaveBeenCalled()
  })

  it('exits with code 1 when orchestrator returns failed status', async () => {
    mockLoadTaskByName.mockReturnValue({ task: { name: 'test-task' }, taskDir: join(tmpDir, 'sheepdog', 'test-task') })
    mockRunTask.mockResolvedValue({ status: 'failed' })

    const { runCommand } = await import('../commands/run.js')
    await runCommand('test-task', { dir: tmpDir })

    expect(exitCode).toBe(1)
  })

  it('exits with code 1 when orchestrator throws', async () => {
    mockLoadTaskByName.mockReturnValue({ task: { name: 'test-task' }, taskDir: join(tmpDir, 'sheepdog', 'test-task') })
    mockRunTask.mockRejectedValue(new Error('orchestrator error'))

    const { runCommand } = await import('../commands/run.js')
    await runCommand('test-task', { dir: tmpDir })

    expect(exitCode).toBe(1)
  })
})
