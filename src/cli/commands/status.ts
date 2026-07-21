import { resolve, basename } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { discoverTasks, loadTask, activePhasePath, contextFilePath } from '../../task/task-loader.js'
import { info } from '../../utils/logger.js'

export interface StatusOptions {
  dir?: string
}

export async function statusCommand(taskName?: string, options?: StatusOptions): Promise<void> {
  const projectRoot = resolve(options?.dir ?? process.cwd())
  const tasks = discoverTasks(projectRoot)

  if (tasks.length === 0) {
    info('No sheepdog tasks found.')
    return
  }

  for (const taskDir of tasks) {
    const loaded = loadTask(taskDir)
    const name = loaded.task.name
    const hasActive = existsSync(activePhasePath(taskDir))
    const activePhase = hasActive
      ? readFileSync(activePhasePath(taskDir), 'utf-8').trim()
      : null

    if (taskName && taskName !== name && basename(taskDir) !== taskName) continue

    info(`\nTask: ${name} (${taskDir})`)

    for (const phase of loaded.task.phases) {
      const contextPath = contextFilePath(taskDir, phase.id)
      const isActive = activePhase === phase.id
      const completed = existsSync(contextPath) && !isActive
      const status = isActive ? '\u25b6 active' : completed ? '\u2713 done' : '\u25cb pending'
      info(`  ${status}  ${phase.id}: ${phase.label}`)
    }
  }
}
