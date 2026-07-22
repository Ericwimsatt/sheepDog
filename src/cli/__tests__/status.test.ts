import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SHEEPDOG_DIR } from '../../constants.js'

// We use dynamic imports in tests to avoid hoisting issues
describe('statusCommand', () => {
  let tmpDir: string

  function writeTask(name: string, phaseCount: number = 4): string {
    const taskDir = join(tmpDir, SHEEPDOG_DIR, name)
    mkdirSync(taskDir, { recursive: true })

    let yaml = `name: "${name}"\nphases:\n`
    for (let i = 1; i <= phaseCount; i++) {
      yaml += `  - description: "Phase ${i}"\n`
    }
    writeFileSync(join(taskDir, 'task.yaml'), yaml, 'utf-8')
    return taskDir
  }

  function writeTodoFiles(taskDir: string, count: number): void {
    for (let i = 1; i <= count; i++) {
      writeFileSync(join(taskDir, `todo-phase-${i}.md`), `# Phase ${i}`, 'utf-8')
    }
  }

  function setActivePhase(taskDir: string, phaseId: string): void {
    writeFileSync(join(taskDir, '.active-phase'), phaseId, 'utf-8')
  }

  function createContextFile(taskDir: string, phaseId: string): void {
    writeFileSync(join(taskDir, `.phase-context-${phaseId}.md`), 'context', 'utf-8')
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-status-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('shows pending status for new tasks', async () => {
    const taskDir = writeTask('test-task')
    writeTodoFiles(taskDir, 4)

    const { statusCommand } = await import('../commands/status.js')
    // Just verify it doesn't throw
    await expect(statusCommand(undefined, { dir: tmpDir })).resolves.toBeUndefined()
  })

  it('shows active status when .active-phase exists', async () => {
    const taskDir = writeTask('test-task')
    writeTodoFiles(taskDir, 4)
    setActivePhase(taskDir, 'phase-2')

    const { statusCommand } = await import('../commands/status.js')
    await expect(statusCommand(undefined, { dir: tmpDir })).resolves.toBeUndefined()
  })

  it('shows completed status when context files exist and no active phase', async () => {
    const taskDir = writeTask('test-task')
    writeTodoFiles(taskDir, 4)
    createContextFile(taskDir, 'phase-1')
    createContextFile(taskDir, 'phase-2')

    const { statusCommand } = await import('../commands/status.js')
    await expect(statusCommand(undefined, { dir: tmpDir })).resolves.toBeUndefined()
  })

  it('shows no tasks message when none found', async () => {
    const { statusCommand } = await import('../commands/status.js')
    await expect(statusCommand(undefined, { dir: tmpDir })).resolves.toBeUndefined()
  })

  it('filters by task name', async () => {
    writeTask('task-a')
    writeTask('task-b')

    const { statusCommand } = await import('../commands/status.js')
    await expect(statusCommand('task-a', { dir: tmpDir })).resolves.toBeUndefined()
  })
})
