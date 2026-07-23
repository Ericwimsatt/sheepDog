import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SHEEPDOG_DIR } from '../constants.js'

export interface Skill {
  name: string
  path: string
  exports: Record<string, unknown>
}

function findIndexFile(skillPath: string): string | null {
  const candidates = ['index.ts', 'index.js', 'index.mjs', 'index.cjs']
  for (const candidate of candidates) {
    const full = join(skillPath, candidate)
    if (existsSync(full)) return full
  }
  return null
}

export function discoverSkills(projectRoot: string): Skill[] {
  const skills: Skill[] = []

  const localSkillsDir = join(projectRoot, SHEEPDOG_DIR, 'skills')
  if (existsSync(localSkillsDir)) {
    for (const entry of readdirSync(localSkillsDir)) {
      const skillPath = join(localSkillsDir, entry)
      if (!statSync(skillPath).isDirectory()) continue
      const indexFile = findIndexFile(skillPath)
      if (!indexFile) continue
      skills.push({
        name: entry,
        path: skillPath,
        exports: {},
      })
    }
  }

  const nodeModulesPath = join(projectRoot, 'node_modules')
  if (existsSync(nodeModulesPath)) {
    for (const entry of readdirSync(nodeModulesPath)) {
      if (entry.startsWith('sheepdog-skill-')) {
        const skillPath = join(nodeModulesPath, entry)
        if (!statSync(skillPath).isDirectory()) continue
        const indexFile = findIndexFile(skillPath)
        if (!indexFile) continue
        const name = entry.replace(/^sheepdog-skill-/, '')
        skills.push({
          name,
          path: skillPath,
          exports: {},
        })
      }
    }
  }

  return skills
}

export async function loadSkill(projectRoot: string, name: string): Promise<Skill> {
  const localSkillDir = join(projectRoot, SHEEPDOG_DIR, 'skills', name)
  if (existsSync(localSkillDir) && statSync(localSkillDir).isDirectory()) {
    const indexFile = findIndexFile(localSkillDir)
    if (!indexFile) throw new Error(`Skill "${name}" has no index file`)
    const skill: Skill = {
      name,
      path: localSkillDir,
      exports: {},
    }
    try {
      const mod = await import(resolve(indexFile))
      skill.exports = { ...mod }
    } catch {
      const raw = readFileSync(indexFile, 'utf-8')
      skill.exports = { raw }
    }
    return skill
  }

  const npmSkillDir = join(projectRoot, 'node_modules', `sheepdog-skill-${name}`)
  if (existsSync(npmSkillDir) && statSync(npmSkillDir).isDirectory()) {
    const indexFile = findIndexFile(npmSkillDir)
    if (!indexFile) throw new Error(`Skill "${name}" has no index file`)
    const skill: Skill = {
      name,
      path: npmSkillDir,
      exports: {},
    }
    try {
      const mod = await import(resolve(indexFile))
      skill.exports = { ...mod }
    } catch {
      const raw = readFileSync(indexFile, 'utf-8')
      skill.exports = { raw }
    }
    return skill
  }

  throw new Error(`Skill "${name}" not found`)
}
