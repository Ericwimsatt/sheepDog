# Phase 4: CLI Commands & Polish

Wire up all CLI commands, implement the `plan` command (agent-driven plan generation), add end-to-end tests, and polish for distribution.

This phase depends on Phases 1–3 (all infrastructure is in place; commands just call the orchestrator).

## Files to Create / Modify

### `src/cli/commands/init.ts`

Scaffold the `sheepdog/` directory in a target project. Creates folder, default `task.yaml`, and template todo files. Also installs the opencode plugin.

```typescript
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
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

  // Create directory structure
  mkdirSync(taskDir, { recursive: true })
  step(`Created ${taskDir}`)

  // Write task.yaml
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

  // Write template todo files
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
```

### `src/cli/commands/run.ts`

Main run command. Finds the task directory, creates an Orchestrator, runs the task.

```typescript
import { resolve } from 'node:path'
import { Orchestrator } from '../../orchestrator/index.js'
import { loadTaskByName, discoverTasks } from '../../task/task-loader.js'
import { SheepDogError } from '../../utils/errors.js'
import { info, error } from '../../utils/logger.js'
import type { RunOptions } from '../../types/types.js'

export interface RunCliOptions {
  phase?: string
  fromPhase?: string
  dir?: string
}

export async function runCommand(taskName: string, options: RunCliOptions): Promise<void> {
  const projectRoot = resolve(options.dir ?? process.cwd())

  // Verify the task exists
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
```

### `src/cli/commands/status.ts`

Show status of tasks and their phases.

```typescript
import { resolve, basename } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { discoverTasks, loadTask, doneMarkerPath, activePhasePath, contextFilePath } from '../../task/task-loader.js'
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

    // Only show requested task if filter given
    if (taskName && taskName !== name && basename(taskDir) !== taskName) continue

    info(`\nTask: ${name} (${taskDir})`)

    for (const phase of loaded.task.phases) {
      const contextPath = contextFilePath(taskDir, phase.id)
      const isActive = activePhase === phase.id
      const completed = existsSync(contextPath) && !isActive
      const status = isActive ? '▶ active' : completed ? '✓ done' : '○ pending'
      info(`  ${status}  ${phase.id}: ${phase.label}`)
    }
  }
}
```

### `src/cli/commands/list.ts`

List all available sheepdog tasks in the current project.

```typescript
import { resolve } from 'node:path'
import { discoverTasks, loadTask } from '../../task/task-loader.js'
import { info, warn } from '../../utils/logger.js'

export interface ListOptions {
  dir?: string
}

export async function listCommand(options?: ListOptions): Promise<void> {
  const projectRoot = resolve(options?.dir ?? process.cwd())
  const tasks = discoverTasks(projectRoot)

  if (tasks.length === 0) {
    warn(`No sheepdog tasks found in ${projectRoot}`)
    info('Run `sheepdog init` to create one, or `sheepdog plan <description>` to generate one.')
    return
  }

  info(`Sheepdog tasks in ${projectRoot}:`)
  for (const taskDir of tasks) {
    try {
      const loaded = loadTask(taskDir)
      info(`  ${loaded.task.name} (${loaded.task.phases.length} phases)`)
    } catch {
      info(`  ${taskDir} (invalid task.yaml)`)
    }
  }
}
```

### `src/cli/commands/plan.ts`

Ask an agent (via opencode CLI) to analyze the project and generate a task plan.

Uses opencode's CLI to invoke an agent with instructions to create the task files.

```typescript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { info, success, step, error } from '../../utils/logger.js'
import { SheepDogError } from '../../utils/errors.js'

const execFileAsync = promisify(execFile)

export interface PlanOptions {
  dir?: string
}

export async function planCommand(description: string, options?: PlanOptions): Promise<void> {
  const projectRoot = resolve(options?.dir ?? process.cwd())
  const name = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  const taskDir = resolve(projectRoot, 'sheepdog', name)
  mkdirSync(taskDir, { recursive: true })

  info(`Generating plan for: ${description}`)
  step(`Task directory: ${taskDir}`)

  // Build the prompt for the agent
  const prompt = `Analyze the project at ${projectRoot} and create a sheepdog task plan.

The description of the work is: "${description}"

Create the following files:

## 1. ${taskDir}/task.yaml

YAML config with 4 phases, test commands, and failure handling.

Example format:
\`\`\`yaml
name: "${name}"
phases:
  - id: phase-1
    file: todo-phase-1.md
    label: "Phase 1: Analysis & Planning"
  - id: phase-2
    file: todo-phase-2.md
    label: "Phase 2: Implementation"
  - id: phase-3
    file: todo-phase-3.md
    label: "Phase 3: Testing & Refinement"
  - id: phase-4
    file: todo-phase-4.md
    label: "Phase 4: Polish"
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
\`\`\`

## 2-5. ${taskDir}/todo-phase-1.md through todo-phase-4.md

Each is a markdown file with detailed instructions for that phase.
Phase instructions should be clear, step-by-step, and specific to the project.
Include specific files to modify, patterns to follow, and acceptance criteria.

IMPORTANT: Write each file using the \`write\` tool. Do not just describe them — create them.`

  // Call opencode CLI to generate the plan
  try {
    info('Invoking opencode agent to generate plan...')
    const { stdout, stderr } = await execFileAsync('opencode', [
      '--prompt', prompt,
      '--yes', // auto-confirm tool usage
    ], {
      cwd: projectRoot,
      timeout: 600_000, // 10 minutes
      maxBuffer: 10 * 1024 * 1024,
    })

    success('Plan generated by agent.')
    console.log(stdout)
  } catch (err: any) {
    // If files were already created, that's a partial success
    error(`Agent exited with error: ${err.message}`)
    info('Check if the task files were created. If not, try running the plan command again.')
    process.exit(1)
  }

  info(`\nRun: sheepdog run ${name}`)
}
```

### Modify `src/cli/index.ts`

Replace the stub actions with imports from the command modules:

```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { runCommand } from './commands/run.js'
import { statusCommand } from './commands/status.js'
import { listCommand } from './commands/list.js'
import { planCommand } from './commands/plan.js'

const program = new Command()

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
  .command('plan <description>')
  .description('Generate a task plan via agent')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((description, options) => {
    planCommand(description, options).catch(err => {
      console.error(err.message)
      process.exit(1)
    })
  })

program.parse(process.argv)
```

### `README.md`

A project README covering:

```markdown
# SheepDog 🐕

Multi-phase agent task orchestrator for herdr + opencode.

## Installation

```bash
npm install -g sheepdog
```

## Quick Start

```bash
# Create a task
sheepdog init --task-name my-feature

# Edit the todo files in sheepdog/my-feature/
# Then run:
sheepdog run my-feature
```

## Commands

| Command | Description |
|---------|-------------|
| `sheepdog init` | Scaffold sheepdog config in a project |
| `sheepdog run <task>` | Execute a task (launches phases sequentially) |
| `sheepdog status [<task>]` | Show task/phase status |
| `sheepdog list` | List available tasks |
| `sheepdog plan <description>` | Ask an agent to generate a task plan |

## How It Works

1. Define a task in `sheepdog/<task>/task.yaml` with 4 phases and test commands
2. Write instructions in `todo-phase-*.md` files
3. Run `sheepdog run <task>`
4. Each phase launches opencode in its own herdr pane
5. Type `/done` in opencode when a phase is complete
6. SheepDog runs test gates between phases
7. If tests fail, failures are passed to the next phase's context

## Requirements

- [herdr](https://herdr.dev) — terminal workspace manager
- [opencode](https://opencode.ai) — AI coding agent
- The herdr-opencode integration must be installed (`herdr integration install opencode`)
```

## Testing Instructions

### Run All Tests

```bash
npm test
```

### What to Verify

1. **CLI command wiring** — each command calls the correct handler
2. **`init`** — creates `sheepdog/<task>/` with task.yaml + todo files
3. **`run`** — finds task, calls Orchestrator, handles errors
4. **`status`** — reads task dirs and shows phase states
5. **`list`** — discovers and lists tasks
6. **`plan`** — invokes opencode CLI to generate plan files
7. **End-to-end** — a complete `init` → `run` flow works (with mocked herdr)

### Write These Tests

**`src/cli/__tests__/init.test.ts`**
- Creates `sheepdog/<task>/` directory
- Writes valid `task.yaml` with 4 phases
- Writes `todo-phase-1.md` through `todo-phase-4.md`
- Errors on non-existent project directory

**`src/cli/__tests__/run.test.ts`**
- Calls `Orchestrator.runTask` with correct args
- Handles missing task gracefully
- Shows available tasks on error
- Uses `process.exit(1)` on failure

**`src/cli/__tests__/status.test.ts`**
- Shows pending status for new tasks
- Shows active status when `.active-phase` exists
- Shows completed status when context files exist
- Shows 'no tasks' message when none found

**`src/cli/__tests__/list.test.ts`**
- Lists available tasks
- Shows 'no tasks' message when sheepdog/ is empty
- Handles invalid task.yaml gracefully

**`src/cli/__tests__/plan.test.ts`**
- Invokes opencode CLI with correct args
- Creates task directory
- Handles opencode timeout/error

**`src/cli/__tests__/index.test.ts`**
- All 5 commands registered
- `--help` shows all commands
- `--version` shows version

### End-to-End Test (manual)

```bash
# 1. Create a test project
mkdir -p /tmp/sheepdog-e2e && cd /tmp/sheepdog-e2e

# 2. Init a task
node /path/to/sheepdog/dist/cli/index.js init --task-name test-task

# 3. Verify files created
ls -la sheepdog/test-task/

# 4. Verify task.yaml is valid
node -e "
const { loadTask } = require('./dist/task/task-loader.js');
const t = loadTask('sheepdog/test-task');
console.log('Task:', t.task.name);
console.log('Phases:', t.task.phases.length);
"

# 5. Run (will fail without herdr, but should show a clear error)
node /path/to/sheepdog/dist/cli/index.js run test-task
```

## Acceptance Criteria

- [ ] `init` creates complete sheepdog directory structure
- [ ] `run` loads task, calls Orchestrator correctly
- [ ] `status` reads and displays phase states from marker files
- [ ] `list` discovers all `sheepdog/*/task.yaml` directories
- [ ] `plan` invokes opencode CLI to generate task files
- [ ] All CLI commands show clear, colored output
- [ ] CLI handles errors gracefully (no unhandled rejections)
- [ ] `npm run build` produces working JS output
- [ ] `node dist/cli/index.js --help` shows all 5 commands
- [ ] `npm test` — all tests pass
- [ ] `npm run typecheck` — zero type errors
- [ ] README written with install + usage instructions
