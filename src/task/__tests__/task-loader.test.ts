import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadTask, discoverTasks, phaseFilePath, contextFilePath, doneMarkerPath, activePhasePath } from '../task-loader.js'
import { SheepDogError } from '../../utils/errors.js'
import { SHEEPDOG_DIR } from '../../constants.js'

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
  - description: "Phase 1"
`

describe('loadTask', () => {
  it('reads and parses a valid task.yaml', () => {
    writeTaskYaml(tmpDir, validYaml)
    const loaded = loadTask(tmpDir)
    expect(loaded.task.name).toBe('test-task')
    expect(loaded.task.phases).toHaveLength(1)
    expect(loaded.task.phases[0].id).toBe('phase-1')
    expect(loaded.task.phases[0].file).toBe('todo-phase-1.md')
    expect(loaded.task.phases[0].label).toBe('Phase 1')
    expect(loaded.taskDir).toBe(tmpDir)
  })

  it('resolves phases with auto-generated id/file/label', () => {
    const yaml = `
name: multi-phase
phases:
  - description: "First Phase"
    runAfter:
      - npm test
  - description: "Second Phase"
`
    writeTaskYaml(tmpDir, yaml)
    const loaded = loadTask(tmpDir)
    expect(loaded.task.phases).toHaveLength(2)
    expect(loaded.task.phases[0].id).toBe('phase-1')
    expect(loaded.task.phases[0].file).toBe('todo-phase-1.md')
    expect(loaded.task.phases[0].label).toBe('First Phase')
    expect(loaded.task.phases[0].runAfter).toHaveLength(1)
    expect(loaded.task.phases[0].runAfter[0].command).toBe('npm test')
    expect(loaded.task.phases[1].id).toBe('phase-2')
    expect(loaded.task.phases[1].file).toBe('todo-phase-2.md')
    expect(loaded.task.phases[1].label).toBe('Second Phase')
    expect(loaded.task.phases[1].runAfter).toEqual([])
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
    const task1 = join(tmpDir, SHEEPDOG_DIR, 'task-a')
    const task2 = join(tmpDir, SHEEPDOG_DIR, 'task-b')
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
    expect(phaseFilePath(taskDir, { id: 'phase-1', file: 'todo-phase-1.md', label: 'P1', runAfter: [] })).toBe(join(taskDir, 'todo-phase-1.md'))
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
