import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { info, success, step } from '../../utils/logger.js'
import { SheepDogError } from '../../utils/errors.js'

const SHEEPDOG_DIR = 'sheepdog'

export interface InitOptions {
  dir: string
  taskName?: string
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectRoot = resolve(options.dir)
  const taskName = options.taskName ?? 'my-task'
  const taskDir = join(projectRoot, SHEEPDOG_DIR, taskName)

  if (!existsSync(projectRoot)) {
    throw new SheepDogError(`Directory not found: ${projectRoot}`)
  }

  info(`Initializing sheepdog task '${taskName}' in ${projectRoot}`)

  mkdirSync(taskDir, { recursive: true })
  step(`Created ${taskDir}`)

  const taskYaml = `name: "${taskName}"
phases:
  - id: phase-1
    file: todo-phase-1.md
    label: "Phase 1: Planning"
  - id: phase-2
    file: todo-phase-2.md
    label: "Phase 2: Implementation"
  - id: phase-3
    file: todo-phase-3.md
    label: "Phase 3: Testing & Refinement"
  - id: phase-4
    file: todo-phase-4.md
    label: "Phase 4: Polish & Documentation"
run_between:
  - command: npm run typecheck
  - command: npm run lint
    optional: true
  - command: npm test
    fail_on_error: true
run_after_all:
  - command: npm run typecheck
  - command: npm test
on_test_failure:
  action: append_to_next_phase
`

  writeFileSync(join(taskDir, 'task.yaml'), taskYaml, 'utf-8')
  step('Created task.yaml')

  for (let i = 1; i <= 4; i++) {
    const todoPath = join(taskDir, `todo-phase-${i}.md`)
    if (!existsSync(todoPath)) {
      writeFileSync(todoPath, `# Phase ${i}\n\nTODO: Describe the work for phase ${i}.\n`, 'utf-8')
      step(`Created todo-phase-${i}.md`)
    }
  }

  success(`Sheepdog task '${taskName}' initialized.`)
  info(`Edit ${join(taskDir, 'task.yaml')} to configure phases and test commands.`)
  info(`Edit the todo-phase-*.md files with instructions for each phase.`)
  info(`Then run: sheepdog run ${taskName}`)
}
