import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillRegistry } from '../skill-registry.js'
import { SHEEPDOG_DIR } from '../../constants.js'

let tmpDir: string

function createSkillSource(name: string, dest: string): void {
  const dir = join(dest, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.ts'), `export function ${name}() { return '${name}' }`, 'utf-8')
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-skill-registry-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('SkillRegistry', () => {
  it('lists empty skills', async () => {
    const registry = new SkillRegistry(tmpDir)
    const skills = await registry.list()
    expect(skills).toEqual([])
  })

  it('installs a skill from a local path', async () => {
    const sourceDir = join(tmpDir, 'source-skills')
    createSkillSource('my-skill', sourceDir)

    const registry = new SkillRegistry(tmpDir)
    await registry.install('my-skill', join(sourceDir, 'my-skill'))

    const targetDir = join(tmpDir, SHEEPDOG_DIR, 'skills', 'my-skill')
    expect(existsSync(targetDir)).toBe(true)
    expect(existsSync(join(targetDir, 'index.ts'))).toBe(true)
  })

  it('lists skills after install', async () => {
    const sourceDir = join(tmpDir, 'source-skills')
    createSkillSource('listed-skill', sourceDir)

    const registry = new SkillRegistry(tmpDir)
    await registry.install('listed-skill', join(sourceDir, 'listed-skill'))

    const skills = await registry.list()
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('listed-skill')
  })

  it('throws on duplicate install', async () => {
    const sourceDir = join(tmpDir, 'source-skills')
    createSkillSource('dup-skill', sourceDir)

    const registry = new SkillRegistry(tmpDir)
    await registry.install('dup-skill', join(sourceDir, 'dup-skill'))
    await expect(
      registry.install('dup-skill', join(sourceDir, 'dup-skill'))
    ).rejects.toThrow('already installed')
  })

  it('removes an installed skill', async () => {
    const sourceDir = join(tmpDir, 'source-skills')
    createSkillSource('removable', sourceDir)

    const registry = new SkillRegistry(tmpDir)
    await registry.install('removable', join(sourceDir, 'removable'))

    const targetDir = join(tmpDir, SHEEPDOG_DIR, 'skills', 'removable')
    expect(existsSync(targetDir)).toBe(true)

    await registry.remove('removable')
    expect(existsSync(targetDir)).toBe(false)
  })

  it('throws when removing non-existent skill', async () => {
    const registry = new SkillRegistry(tmpDir)
    await expect(registry.remove('nonexistent')).rejects.toThrow('not installed')
  })
})
