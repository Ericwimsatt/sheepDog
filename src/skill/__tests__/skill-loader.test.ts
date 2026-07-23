import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverSkills } from '../skill-loader.js'
import { SHEEPDOG_DIR } from '../../constants.js'

let tmpDir: string

function createLocalSkill(name: string): string {
  const skillDir = join(tmpDir, SHEEPDOG_DIR, 'skills', name)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'index.ts'), `export function ${name}() { return '${name}' }`, 'utf-8')
  return skillDir
}

function createNpmSkill(name: string): string {
  const pkgName = `sheepdog-skill-${name}`
  const skillDir = join(tmpDir, 'node_modules', pkgName)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'index.js'), `module.exports = { ${name}: () => '${name}' }`, 'utf-8')
  return skillDir
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-skill-loader-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('discoverSkills', () => {
  it('discovers local skills in .sheepdog/skills/', () => {
    createLocalSkill('test-skill')
    const skills = discoverSkills(tmpDir)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('test-skill')
    expect(skills[0].path).toContain('.sheepdog/skills/test-skill')
  })

  it('discovers multiple local skills', () => {
    createLocalSkill('skill-a')
    createLocalSkill('skill-b')
    const skills = discoverSkills(tmpDir)
    expect(skills).toHaveLength(2)
    const names = skills.map(s => s.name).sort()
    expect(names).toEqual(['skill-a', 'skill-b'])
  })

  it('discovers npm-installed skills under node_modules/sheepdog-skill-*', () => {
    createNpmSkill('npm-skill')
    const skills = discoverSkills(tmpDir)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('npm-skill')
  })

  it('returns empty array when no skills exist', () => {
    const skills = discoverSkills(tmpDir)
    expect(skills).toEqual([])
  })

  it('skips directories without an index file', () => {
    const emptyDir = join(tmpDir, SHEEPDOG_DIR, 'skills', 'empty-skill')
    mkdirSync(emptyDir, { recursive: true })
    const skills = discoverSkills(tmpDir)
    expect(skills).toEqual([])
  })
})

describe('loadSkill', () => {
  it('loads a local skill', async () => {
    createLocalSkill('my-skill')
    const { loadSkill } = await import('../skill-loader.js')
    const skill = await loadSkill(tmpDir, 'my-skill')
    expect(skill.name).toBe('my-skill')
    expect(skill.path).toContain('.sheepdog/skills/my-skill')
    expect(skill.exports).toBeDefined()
  })

  it('throws for non-existent skill', async () => {
    const { loadSkill } = await import('../skill-loader.js')
    await expect(loadSkill(tmpDir, 'nonexistent')).rejects.toThrow('Skill "nonexistent" not found')
  })
})
