import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPhaseContext, buildFixContext } from '../context-builder.js'
import type { Phase, TestResult } from '../../types/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-ctx-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const phase: Phase = { id: 'p1', file: 'todo-p1.md', label: 'Phase 1', runAfter: [] }

describe('buildPhaseContext', () => {
  it('builds context with todo content', () => {
    writeFileSync(join(tmpDir, 'todo-p1.md'), 'Do the thing\n', 'utf-8')

    buildPhaseContext({ taskDir: tmpDir, phase })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).toContain('# Phase: Phase 1')
    expect(content).toContain('## Instructions')
    expect(content).toContain('Do the thing')
  })

  it('appends previous test failures', () => {
    writeFileSync(join(tmpDir, 'todo-p1.md'), 'Do the thing\n', 'utf-8')

    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: 'Test failed', passed: false },
    ]

    buildPhaseContext({ taskDir: tmpDir, phase, previousTestResults: failures })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).toContain('## Previous Phase Test Failures')
    expect(content).toContain('npm test')
    expect(content).toContain('Test failed')
  })

  it('handles missing todo file gracefully', () => {
    buildPhaseContext({ taskDir: tmpDir, phase })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).toContain('# No instructions provided')
  })

  it('handles empty test results', () => {
    writeFileSync(join(tmpDir, 'todo-p1.md'), 'Do the thing\n', 'utf-8')

    buildPhaseContext({ taskDir: tmpDir, phase, previousTestResults: [] })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).not.toContain('## Previous Phase Test Failures')
  })

  it('handles mixed passed/failed test results', () => {
    writeFileSync(join(tmpDir, 'todo-p1.md'), 'Do the thing\n', 'utf-8')

    const mixedResults: TestResult[] = [
      { command: 'test-a', exitCode: 0, stdout: 'ok', stderr: '', passed: true },
      { command: 'test-b', exitCode: 1, stdout: '', stderr: 'fail', passed: false },
    ]

    buildPhaseContext({ taskDir: tmpDir, phase, previousTestResults: mixedResults })

    const contextPath = join(tmpDir, '.phase-context-p1.md')
    const content = readFileSync(contextPath, 'utf-8')
    expect(content).toContain('test-b')
    expect(content).not.toContain('test-a')
  })

  it('returns the path to the written file', () => {
    writeFileSync(join(tmpDir, 'todo-p1.md'), 'content', 'utf-8')

    const result = buildPhaseContext({ taskDir: tmpDir, phase })

    expect(result).toBe(join(tmpDir, '.phase-context-p1.md'))
  })
})

describe('buildFixContext', () => {
  it('writes context file with failure details', () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: 'Test failed', passed: false },
    ]

    const result = buildFixContext({ taskDir: tmpDir, phase, testResults: failures, attempt: 1, maxAttempts: 2 })

    const expectedPath = join(tmpDir, '.phase-fix-context-p1-attempt-1.md')
    expect(result).toBe(expectedPath)
    expect(existsSync(expectedPath)).toBe(true)

    const content = readFileSync(expectedPath, 'utf-8')
    expect(content).toContain('# Fix Attempt 1/2: Phase 1')
    expect(content).toContain('npm test')
    expect(content).toContain('Test failed')
    expect(content).toContain('sheepdog_done')
  })

  it('includes final attempt warning on last attempt', () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
    ]

    buildFixContext({ taskDir: tmpDir, phase, testResults: failures, attempt: 2, maxAttempts: 2 })

    const content = readFileSync(join(tmpDir, '.phase-fix-context-p1-attempt-2.md'), 'utf-8')
    expect(content).toContain('final attempt')
  })

  it('includes retry note when attempt > 1', () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
    ]

    buildFixContext({ taskDir: tmpDir, phase, testResults: failures, attempt: 2, maxAttempts: 3 })

    const content = readFileSync(join(tmpDir, '.phase-fix-context-p1-attempt-2.md'), 'utf-8')
    expect(content).toContain('did not resolve')
  })

  it('omits retry note on first attempt', () => {
    const failures: TestResult[] = [
      { command: 'npm test', exitCode: 1, stdout: '', stderr: '', passed: false },
    ]

    buildFixContext({ taskDir: tmpDir, phase, testResults: failures, attempt: 1, maxAttempts: 2 })

    const content = readFileSync(join(tmpDir, '.phase-fix-context-p1-attempt-1.md'), 'utf-8')
    expect(content).not.toContain('did not resolve')
  })
})
