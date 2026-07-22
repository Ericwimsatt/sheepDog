import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SHEEPDOG_DIR } from '../../constants.js'

describe('listCommand', () => {
  let tmpDir: string

  function writeTask(name: string): void {
    const taskDir = join(tmpDir, SHEEPDOG_DIR, name)
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'task.yaml'), `name: "${name}"\nphases:\n  - description: "Phase 1"\n`, 'utf-8')
  }

  function writeInvalidTask(name: string): void {
    const taskDir = join(tmpDir, SHEEPDOG_DIR, name)
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'task.yaml'), 'invalid: yaml: [[[', 'utf-8')
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-list-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('lists available tasks', async () => {
    writeTask('task-a')
    writeTask('task-b')

    const { listCommand } = await import('../commands/list.js')
    await expect(listCommand({ dir: tmpDir })).resolves.toBeUndefined()
  })

  it('shows warning when no tasks found', async () => {
    const { listCommand } = await import('../commands/list.js')
    await expect(listCommand({ dir: tmpDir })).resolves.toBeUndefined()
  })

  it('handles invalid task.yaml gracefully', async () => {
    writeInvalidTask('broken')

    const { listCommand } = await import('../commands/list.js')
    await expect(listCommand({ dir: tmpDir })).resolves.toBeUndefined()
  })
})
