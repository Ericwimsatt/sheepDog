import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installCommand } from '../commands/install.js'
import { SHEEPDOG_DIR } from '../../constants.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-install-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('installCommand', () => {
  it(`creates ${SHEEPDOG_DIR}/ directory`, async () => {
    await installCommand({ dir: tmpDir })

    expect(existsSync(join(tmpDir, SHEEPDOG_DIR))).toBe(true)
  })

  it(`creates AGENTS.md inside ${SHEEPDOG_DIR}/`, async () => {
    await installCommand({ dir: tmpDir })

    const agentsPath = join(tmpDir, SHEEPDOG_DIR, 'AGENTS.md')
    expect(existsSync(agentsPath)).toBe(true)
    const content = readFileSync(agentsPath, 'utf-8')
    expect(content).toContain('SheepDog is a multi-phase task orchestrator')
    expect(content).toContain('task.yaml')
    expect(content).toContain('Vitest')
  })

  it(`copies sandbox.d.ts into ${SHEEPDOG_DIR}/`, async () => {
    await installCommand({ dir: tmpDir })

    const sandboxPath = join(tmpDir, SHEEPDOG_DIR, 'sandbox.d.ts')
    expect(existsSync(sandboxPath)).toBe(true)
    const content = readFileSync(sandboxPath, 'utf-8')
    expect(content).toContain('@sheepdog/sandbox')
  })

  it(`copies tasks/ directory into ${SHEEPDOG_DIR}/`, async () => {
    await installCommand({ dir: tmpDir })

    const tasksDir = join(tmpDir, SHEEPDOG_DIR, 'tasks')
    expect(existsSync(tasksDir)).toBe(true)
  })

  it(`does not overwrite existing files in ${SHEEPDOG_DIR}/`, async () => {
    const sheepdogDir = join(tmpDir, SHEEPDOG_DIR)
    mkdirSync(sheepdogDir, { recursive: true })
    writeFileSync(join(sheepdogDir, 'AGENTS.md'), 'custom content', 'utf-8')
    writeFileSync(join(sheepdogDir, 'sandbox.d.ts'), 'custom types', 'utf-8')

    await installCommand({ dir: tmpDir })

    expect(readFileSync(join(sheepdogDir, 'AGENTS.md'), 'utf-8')).toBe('custom content')
    expect(readFileSync(join(sheepdogDir, 'sandbox.d.ts'), 'utf-8')).toBe('custom types')
  })

  it('errors on non-existent directory', async () => {
    await expect(installCommand({ dir: '/nonexistent/path' }))
      .rejects.toThrow('Directory not found')
  })
})
