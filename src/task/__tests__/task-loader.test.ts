import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadTask, discoverTasks, phaseFilePath, contextFilePath, doneMarkerPath, activePhasePath } from '../task-loader.js'
import { SheepDogError } from '../../utils/errors.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeTaskYaml(taskDir: string, content: string): void {
  mkdirSync(taskDir, { recursive: true })
  writeFileSync(join(taskDir, 'task.yaml'), content, 'utf-8')
}

const validYaml = `
name: test-task
phases:
  - id: p1
    file: phase1.md
    label: Phase 1
`

describe('loadTask', () => {
  it('reads and parses a valid task.yaml', () => {
    writeTaskYaml(tmpDir, validYaml)
    const loaded = loadTask(tmpDir)
    expect(loaded.task.name).toBe('test-task')
    expect(loaded.task.phases).toHaveLength(1)
    expect(loaded.task.phases[0].id).toBe('p1')
    expect(loaded.taskDir).toBe(tmpDir)
  })

  it('throws on missing file', () => {
    expect(() => loadTask(tmpDir)).toThrow(SheepDogError)
    expect(() => loadTask(tmpDir)).toThrow(/task.yaml not found/)
  })

  it('throws on invalid YAML', () => {
    writeTaskYaml(tmpDir, 'invalid: yaml: broken: [')
    expect(() => loadTask(tmpDir)).toThrow(SheepDogError)
  })

  it('throws on schema violation', () => {
    writeTaskYaml(tmpDir, 'name: "only-name"')
    expect(() => loadTask(tmpDir)).toThrow(SheepDogError)
    expect(() => loadTask(tmpDir)).toThrow(/Invalid task.yaml/)
  })
})

describe('discoverTasks', () => {
  it('finds task directories', () => {
    const task1 = join(tmpDir, 'sheepdog', 'task-a')
    const task2 = join(tmpDir, 'sheepdog', 'task-b')
    writeTaskYaml(task1, validYaml)
    writeTaskYaml(task2, validYaml)

    const dirs = discoverTasks(tmpDir)
    expect(dirs).toHaveLength(2)
    expect(dirs).toContain(task1)
    expect(dirs).toContain(task2)
  })

  it('returns empty array when no tasks exist', () => {
    const dirs = discoverTasks(tmpDir)
    expect(dirs).toEqual([])
  })
})

describe('path helpers', () => {
  const taskDir = '/some/task/dir'

  it('phaseFilePath returns correct path', () => {
    expect(phaseFilePath(taskDir, { file: 'phase1.md' })).toBe(join(taskDir, 'phase1.md'))
  })

  it('contextFilePath returns correct path', () => {
    expect(contextFilePath(taskDir, 'p1')).toBe(join(taskDir, '.phase-context-p1.md'))
  })

  it('doneMarkerPath returns correct path', () => {
    expect(doneMarkerPath(taskDir)).toBe(join(taskDir, '.phase-done'))
  })

  it('activePhasePath returns correct path', () => {
    expect(activePhasePath(taskDir)).toBe(join(taskDir, '.active-phase'))
  })
})
