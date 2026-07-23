import { mkdirSync, existsSync, readdirSync, statSync, cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { SHEEPDOG_DIR } from '../constants.js'
import { discoverSkills } from './skill-loader.js'
import type { Skill } from './skill-loader.js'

export class SkillRegistry {
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async list(): Promise<Skill[]> {
    return discoverSkills(this.projectRoot)
  }

  async install(name: string, source?: string): Promise<void> {
    const skillsDir = join(this.projectRoot, SHEEPDOG_DIR, 'skills')
    const targetDir = join(skillsDir, name)

    if (existsSync(targetDir)) {
      throw new Error(`Skill "${name}" is already installed`)
    }

    if (!source) {
      source = name
    }

    if (existsSync(source)) {
      const srcStat = statSync(source)
      if (!srcStat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${source}`)
      }
      mkdirSync(skillsDir, { recursive: true })
      cpSync(source, targetDir, { recursive: true })
      return
    }

    if (source.startsWith('http') || source.startsWith('git@') || source.startsWith('git://')) {
      mkdirSync(skillsDir, { recursive: true })
      execSync(`git clone "${source}" "${targetDir}"`, {
        stdio: 'inherit',
        timeout: 120_000,
      })
      return
    }

    if (source.startsWith('npm:') || source === name) {
      const pkgName = source.startsWith('npm:') ? source.slice(4) : `sheepdog-skill-${name}`
      const npmDir = join(this.projectRoot, 'node_modules', pkgName)
      if (!existsSync(npmDir)) {
        execSync(`npm install "${pkgName}"`, {
          cwd: this.projectRoot,
          stdio: 'inherit',
          timeout: 120_000,
        })
      }
      if (!existsSync(npmDir)) {
        throw new Error(`Package "${pkgName}" not found after install`)
      }
      mkdirSync(skillsDir, { recursive: true })
      cpSync(npmDir, targetDir, { recursive: true })
      return
    }

    throw new Error(`Unknown skill source: ${source}`)
  }

  async remove(name: string): Promise<void> {
    const localPath = join(this.projectRoot, SHEEPDOG_DIR, 'skills', name)
    if (!existsSync(localPath)) {
      throw new Error(`Skill "${name}" is not installed`)
    }
    rmSync(localPath, { recursive: true, force: true })
  }
}
