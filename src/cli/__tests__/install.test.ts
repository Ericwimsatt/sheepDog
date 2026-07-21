import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installCommand } from '../commands/install.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-install-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('installCommand', () => {
  it('creates sheepdog/ directory', async () => {
    await installCommand({ dir: tmpDir })

    expect(existsSync(join(tmpDir, 'sheepdog'))).toBe(true)
  })

  it('creates AGENTS.md', async () => {
    await installCommand({ dir: tmpDir })

    const agentsPath = join(tmpDir, 'AGENTS.md')
    expect(existsSync(agentsPath)).toBe(true)
    const content = readFileSync(agentsPath, 'utf-8')
    expect(content).toContain('Creating a SheepDog Task')
    expect(content).toContain('task.yaml')
  })

  it('does not overwrite existing AGENTS.md', async () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), 'custom content', 'utf-8')

    await installCommand({ dir: tmpDir })

    const content = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8')
    expect(content).toBe('custom content')
  })

  it('errors on non-existent directory', async () => {
    await expect(installCommand({ dir: '/nonexistent/path' }))
      .rejects.toThrow('Directory not found')
  })
})
