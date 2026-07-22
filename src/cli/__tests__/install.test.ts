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
  })

  it(`does not overwrite existing ${SHEEPDOG_DIR}/AGENTS.md`, async () => {
    const sheepdogDir = join(tmpDir, SHEEPDOG_DIR)
    mkdirSync(sheepdogDir, { recursive: true })
    writeFileSync(join(sheepdogDir, 'AGENTS.md'), 'custom content', 'utf-8')

    await installCommand({ dir: tmpDir })

    const content = readFileSync(join(sheepdogDir, 'AGENTS.md'), 'utf-8')
    expect(content).toBe('custom content')
  })

  it('copies skill files into .sheepdog/skills/', async () => {
    await installCommand({ dir: tmpDir })

    const skillsDir = join(tmpDir, SHEEPDOG_DIR, 'skills')
    expect(existsSync(skillsDir)).toBe(true)
    expect(existsSync(join(skillsDir, 'install.md'))).toBe(true)
    expect(existsSync(join(skillsDir, 'create-task.md'))).toBe(true)
    expect(existsSync(join(skillsDir, 'handle-failure.md'))).toBe(true)
  })

  it('does not overwrite existing skill files', async () => {
    const skillsDir = join(tmpDir, SHEEPDOG_DIR, 'skills')
    mkdirSync(skillsDir, { recursive: true })
    writeFileSync(join(skillsDir, 'install.md'), 'custom content', 'utf-8')

    await installCommand({ dir: tmpDir })

    const content = readFileSync(join(skillsDir, 'install.md'), 'utf-8')
    expect(content).toBe('custom content')
  })

  it('errors on non-existent directory', async () => {
    await expect(installCommand({ dir: '/nonexistent/path' }))
      .rejects.toThrow('Directory not found')
  })
})
