import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PhaseRunner } from '../phase-runner.js'
import type { Phase, TestResult } from '../../types/types.js'

let tmpDir: string
let runner: PhaseRunner
let mockHerdr: any

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-pr-test-'))
  mockHerdr = {
    startAgent: vi.fn().mockResolvedValue({ paneId: 'pane_test', agentName: 'test-agent', status: 'running' }),
    waitForStatus: vi.fn().mockResolvedValue(undefined),
    readPaneOutput: vi.fn().mockResolvedValue('mock phase output'),
    closePane: vi.fn().mockResolvedValue(undefined),
    listAgents: vi.fn().mockResolvedValue([]),
    getAgent: vi.fn().mockResolvedValue(null),
  }
  runner = new PhaseRunner()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const phase: Phase = { id: 'p1', file: 'todo-p1.md', label: 'Phase 1', runAfter: [] }

function writeTodoFile(): void {
  writeFileSync(join(tmpDir, 'todo-p1.md'), 'Do the work\n', 'utf-8')
}

function scheduleDoneMarker(): void {
  mockHerdr.startAgent.mockImplementation(async () => {
    setTimeout(() => {
      writeFileSync(join(tmpDir, '.phase-done'), 'done', 'utf-8')
    }, 50)
    return { paneId: 'pane_test', agentName: 'test-agent', status: 'running' }
  })
}

describe('PhaseRunner', () => {
  it('writes context file before launching', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    expect(existsSync(contextPath)).toBe(true)
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).toContain('# Phase: Phase 1')
    expect(content).toContain('Do the work')
  })

  it('writes .active-phase marker', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase })

    const activePath = join(tmpDir, '.active-phase')
    expect(existsSync(activePath)).toBe(true)
    const content = readFileSync(activePath, 'utf-8')
    expect(content).toBe('p1')
  })

  it('removes stale .phase-done marker', async () => {
    writeTodoFile()
    writeFileSync(join(tmpDir, '.phase-done'), 'stale', 'utf-8')
    scheduleDoneMarker()

    await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase })

    expect(existsSync(join(tmpDir, '.phase-done'))).toBe(false)
  })

  it('waits for .phase-done marker to appear', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase })
  })

  it('cleans up marker after completion', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase })

    expect(existsSync(join(tmpDir, '.phase-done'))).toBe(false)
  })

  it('returns correct PhaseState', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    const result = await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase })

    expect(result).toMatchObject({
      phaseId: 'p1',
      status: 'completed',
      testResults: [],
    })
    expect(result.startedAt).toBeDefined()
    expect(result.completedAt).toBeDefined()
  })

  it('calls herdr.startAgent with correct arguments', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    await runner.run({ taskDir: tmpDir, projectRoot: '/project', herdr: mockHerdr, phase })

    expect(mockHerdr.startAgent).toHaveBeenCalledWith(
      'Sheepdog (p1)',
      '/project',
      ['opencode', '--prompt', expect.stringContaining('Phase "Phase 1" has started'), '--auto'],
      { split: 'right' },
    )
  })

  it('appends previous failures to context', async () => {
    writeTodoFile()
    scheduleDoneMarker()

    const failures: TestResult[] = [
      { command: 'prev-test', exitCode: 1, stdout: '', stderr: 'prev error', passed: false },
    ]

    await runner.run({ taskDir: tmpDir, projectRoot: '/tmp', herdr: mockHerdr, phase, previousTestResults: failures })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).toContain('## Previous Phase Test Failures')
    expect(content).toContain('prev-test')
  })
})

describe('PhaseRunner.runFixAttempt', () => {
  it('writes fix context file', async () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: 'fail', passed: false },
    ]

    mockHerdr.startAgent.mockImplementation(async () => {
      setTimeout(() => {
        writeFileSync(join(tmpDir, '.phase-done'), 'done', 'utf-8')
      }, 50)
      return { paneId: 'pane_fix', agentName: 'fix-agent', status: 'running' }
    })

    await runner.runFixAttempt({
      taskDir: tmpDir,
      projectRoot: '/tmp',
      herdr: mockHerdr,
      phase,
      testResults: failures,
      attempt: 1,
      maxAttempts: 2,
    })

    const fixContextPath = join(tmpDir, '.phase-fix-context-p1-attempt-1.md')
    expect(existsSync(fixContextPath)).toBe(true)
    const content = readFileSync(fixContextPath, 'utf-8')
    expect(content).toContain('Fix Attempt 1/2')
    expect(content).toContain('npm test')
  })

  it('writes .active-phase marker with fix suffix', async () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
    ]

    mockHerdr.startAgent.mockImplementation(async () => {
      setTimeout(() => writeFileSync(join(tmpDir, '.phase-done'), 'done', 'utf-8'), 50)
      return { paneId: 'pane_fix', agentName: 'fix-agent', status: 'running' }
    })

    await runner.runFixAttempt({
      taskDir: tmpDir,
      projectRoot: '/tmp',
      herdr: mockHerdr,
      phase,
      testResults: failures,
      attempt: 1,
      maxAttempts: 2,
    })

    const activePath = join(tmpDir, '.active-phase')
    const content = readFileSync(activePath, 'utf-8')
    expect(content).toBe('p1-fix-1')
  })

  it('launches fix agent with correct arguments', async () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
    ]

    mockHerdr.startAgent.mockImplementation(async () => {
      setTimeout(() => writeFileSync(join(tmpDir, '.phase-done'), 'done', 'utf-8'), 50)
      return { paneId: 'pane_fix', agentName: 'fix-agent', status: 'running' }
    })

    await runner.runFixAttempt({
      taskDir: tmpDir,
      projectRoot: '/project',
      herdr: mockHerdr,
      phase,
      testResults: failures,
      attempt: 1,
      maxAttempts: 2,
    })

    expect(mockHerdr.startAgent).toHaveBeenCalledWith(
      'Sheepdog fix (p1, attempt 1)',
      '/project',
      expect.arrayContaining(['opencode', '--auto']),
      { split: 'right' },
    )
  })

  it('cleans up .phase-done marker after completion', async () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
    ]

    mockHerdr.startAgent.mockImplementation(async () => {
      setTimeout(() => writeFileSync(join(tmpDir, '.phase-done'), 'done', 'utf-8'), 50)
      return { paneId: 'pane_fix', agentName: 'fix-agent', status: 'running' }
    })

    await runner.runFixAttempt({
      taskDir: tmpDir,
      projectRoot: '/tmp',
      herdr: mockHerdr,
      phase,
      testResults: failures,
      attempt: 1,
      maxAttempts: 2,
    })

    expect(existsSync(join(tmpDir, '.phase-done'))).toBe(false)
  })
})
