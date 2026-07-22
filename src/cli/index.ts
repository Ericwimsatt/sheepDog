#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { installCommand } from './commands/install.js'
import { runCommand } from './commands/run.js'
import { resumeCommand } from './commands/resume.js'
import { statusCommand } from './commands/status.js'
import { listCommand } from './commands/list.js'
import { planCommand } from './commands/plan.js'

export const program = new Command()

program
  .name('sheepdog')
  .description('Multi-phase agent task orchestrator for herdr + opencode')
  .version('0.1.0')

program
  .command('init')
  .description('Scaffold sheepdog config in a project')
  .option('--dir <path>', 'Project directory', process.cwd())
  .option('--task-name <name>', 'Task name', 'my-task')
  .action((options) => {
    initCommand(options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program
  .command('install')
  .description('Bootstrap sheepdog in a project (creates sheepdog/ dir + sheepdog/AGENTS.md)')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((options) => {
    installCommand(options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program
  .command('run <task>')
  .description('Execute a sheepdog task')
  .option('--phase <id>', 'Run a single phase')
  .option('--from-phase <id>', 'Start from a specific phase')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((task, options) => {
    runCommand(task, options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program
  .command('status')
  .description('Show task/phase status')
  .argument('[task]', 'Task name')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((task, options) => {
    statusCommand(task, options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program
  .command('list')
  .description('List available tasks')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((options) => {
    listCommand(options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program
  .command('resume <task>')
  .description('Resume a previously interrupted task from its last checkpoint')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((task, options) => {
    resumeCommand(task, options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program
  .command('plan <description>')
  .description('Generate a task plan via agent')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((description, options) => {
    planCommand(description, options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

if (!process.env.VITEST) {
  program.parse(process.argv)
}
