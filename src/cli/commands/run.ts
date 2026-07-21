import { resolve } from 'node:path'
import { Orchestrator } from '../../orchestrator/index.js'
import { loadTaskByName, discoverTasks } from '../../task/task-loader.js'
import { info, error } from '../../utils/logger.js'
import type { RunOptions } from '../../types/types.js'

export interface RunCliOptions {
  phase?: string
  fromPhase?: string
  dir?: string
}

export async function runCommand(taskName: string, options: RunCliOptions): Promise<void> {
  const projectRoot = resolve(options.dir ?? process.cwd())

  try {
    loadTaskByName(projectRoot, taskName)
  } catch (e: any) {
    error(`Task '${taskName}' not found in ${projectRoot}`)
    info('Available tasks:')
    const tasks = discoverTasks(projectRoot)
    for (const t of tasks) {
      info(`  - ${t}`)
    }
    process.exit(1)
  }

  const taskDir = resolve(projectRoot, 'sheepdog', taskName)
  const orchestrator = new Orchestrator()

  const runOpts: RunOptions = {}
  if (options.phase) runOpts.phase = options.phase
  if (options.fromPhase) runOpts.fromPhase = options.fromPhase

  try {
    const result = await orchestrator.runTask(taskDir, runOpts)
    if (result.status === 'failed') {
      process.exit(1)
    }
  } catch (e: any) {
    error(`Task failed: ${e.message}`)
    process.exit(1)
  }
}
