import { resolve } from 'node:path'
import { Command } from 'commander'
import { SkillRegistry } from '../../skill/skill-registry.js'
import { info, success, error as logError, step } from '../../utils/logger.js'

export function createSkillCommand(): Command {
  const skill = new Command('skill')
    .description('Manage sheepdog skills')

  skill
    .command('list')
    .description('List installed skills')
    .option('--dir <path>', 'Project directory', process.cwd())
    .action(async (options) => {
      try {
        const projectRoot = resolve(options.dir)
        const registry = new SkillRegistry(projectRoot)
        const skills = await registry.list()
        if (skills.length === 0) {
          info('No skills installed')
          return
        }
        info(`Installed skills (${skills.length}):`)
        for (const s of skills) {
          step(`${s.name} (${s.path})`)
        }
      } catch (err) {
        logError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  skill
    .command('install <name>')
    .description('Install a skill')
    .option('--dir <path>', 'Project directory', process.cwd())
    .option('--source <source>', 'Source path, git URL, or npm package')
    .action(async (name, options) => {
      try {
        const projectRoot = resolve(options.dir)
        const registry = new SkillRegistry(projectRoot)
        await registry.install(name, options.source)
        success(`Skill "${name}" installed`)
      } catch (err) {
        logError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  skill
    .command('remove <name>')
    .description('Remove a skill')
    .option('--dir <path>', 'Project directory', process.cwd())
    .action(async (name, options) => {
      try {
        const projectRoot = resolve(options.dir)
        const registry = new SkillRegistry(projectRoot)
        await registry.remove(name)
        success(`Skill "${name}" removed`)
      } catch (err) {
        logError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  return skill
}
