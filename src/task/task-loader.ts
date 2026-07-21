import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { TaskSchema, type ParsedTask } from './task-schema.js'
import { glob } from '../utils/fs.js'
import { SheepDogError } from '../utils/errors.js'

const SHEEPDOG_DIR = 'sheepdog'

export interface LoadedTask {
  task: ParsedTask
  taskDir: string
  projectRoot: string
}

export function discoverTasks(projectRoot: string): string[] {
  const pattern = join(SHEEPDOG_DIR, '*', 'task.yaml')
  const files = glob(pattern, projectRoot)
  return files.map(f => dirname(f))
}

export function loadTask(taskDir: string): LoadedTask {
  const yamlPath = join(taskDir, 'task.yaml')
  if (!existsSync(yamlPath)) {
    throw new SheepDogError(`task.yaml not found in ${taskDir}`)
  }

  const raw = readFileSync(yamlPath, 'utf-8')
  let parsed: unknown
  try {
    parsed = parseYaml(raw)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new SheepDogError(`Invalid YAML in task.yaml: ${msg}`)
  }

  const result = TaskSchema.safeParse(parsed)
  if (!result.success) {
    throw new SheepDogError(`Invalid task.yaml: ${result.error.message}`)
  }

  return {
    task: result.data,
    taskDir,
    projectRoot: dirname(taskDir),
  }
}

export function loadTaskByName(projectRoot: string, name: string): LoadedTask {
  const taskDir = join(projectRoot, SHEEPDOG_DIR, name)
  return loadTask(taskDir)
}

export function phaseFilePath(taskDir: string, phase: { file: string }): string {
  return join(taskDir, phase.file)
}

export function contextFilePath(taskDir: string, phaseId: string): string {
  return join(taskDir, `.phase-context-${phaseId}.md`)
}

export function doneMarkerPath(taskDir: string): string {
  return join(taskDir, '.phase-done')
}

export function activePhasePath(taskDir: string): string {
  return join(taskDir, '.active-phase')
}
