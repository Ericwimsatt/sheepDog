import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPhaseContext } from '../context-builder.js'
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
