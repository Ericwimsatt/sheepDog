import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initCommand } from '../commands/init.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-init-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('initCommand', () => {
  it('creates sheepdog directory structure', async () => {
    await initCommand({ dir: tmpDir, taskName: 'test-task' })

    const taskDir = join(tmpDir, 'sheepdog', 'test-task')
    expect(existsSync(taskDir)).toBe(true)
    expect(existsSync(join(taskDir, 'task.yaml'))).toBe(true)
    expect(existsSync(join(taskDir, 'todo-phase-1.md'))).toBe(true)
    expect(existsSync(join(taskDir, 'todo-phase-2.md'))).toBe(true)
    expect(existsSync(join(taskDir, 'todo-phase-3.md'))).toBe(true)
    expect(existsSync(join(taskDir, 'todo-phase-4.md'))).toBe(true)
  })

  it('writes valid task.yaml with 4 phases', async () => {
    await initCommand({ dir: tmpDir, taskName: 'test-task' })

    const yaml = readFileSync(join(tmpDir, 'sheepdog', 'test-task', 'task.yaml'), 'utf-8')
    expect(yaml).toContain('name: "test-task"')
    expect(yaml).toContain('phase-1')
    expect(yaml).toContain('phase-2')
    expect(yaml).toContain('phase-3')
    expect(yaml).toContain('phase-4')
  })

  it('creates todo-phase-*.md files with content', async () => {
    await initCommand({ dir: tmpDir, taskName: 'test-task' })

    for (let i = 1; i <= 4; i++) {
      const content = readFileSync(join(tmpDir, 'sheepdog', 'test-task', `todo-phase-${i}.md`), 'utf-8')
      expect(content).toContain(`# Phase ${i}`)
    }
  })

  it('does not overwrite existing todo files', async () => {
    const taskDir = join(tmpDir, 'sheepdog', 'test-task')
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'todo-phase-1.md'), 'existing content', 'utf-8')

    await initCommand({ dir: tmpDir, taskName: 'test-task' })

    const content = readFileSync(join(taskDir, 'todo-phase-1.md'), 'utf-8')
    expect(content).toBe('existing content')
  })

  it('errors on non-existent directory', async () => {
    await expect(initCommand({ dir: '/nonexistent/path', taskName: 'test' }))
      .rejects.toThrow('Directory not found')
  })
})
