# Phase 1: Foundation

Build the TypeScript project scaffold, type system, and task file loader.

## Files to Create

### `package.json`

```json
{
  "name": "sheepdog",
  "version": "0.1.0",
  "description": "Multi-phase agent task orchestrator for herdr + opencode",
  "type": "module",
  "bin": {
    "sheepdog": "./dist/cli/index.js"
  },
  "exports": {
    "./plugin": {
      "import": "./dist/plugin/register.js",
      "types": "./dist/plugin/register.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "zod": "^3.24.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.15.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

### `.gitignore`

```
node_modules/
dist/
*.tsbuildinfo
.sheepdog-*
```

### `src/types/types.ts`

Define all shared TypeScript interfaces:

```typescript
// ---------- Task Definition ----------

export interface Task {
  name: string
  phases: Phase[]
  runBetween: TestCommand[]
  runAfterAll: TestCommand[]
  onTestFailure: OnTestFailure
}

export interface Phase {
  id: string
  file: string
  label: string
}

export interface TestCommand {
  command: string
  optional?: boolean
  failOnError?: boolean
}

export interface OnTestFailure {
  action: 'append_to_next_phase' | 'stop'
}

// ---------- Runtime State ----------

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface PhaseState {
  phaseId: string
  status: PhaseStatus
  startedAt?: string
  completedAt?: string
  testResults: TestResult[]
}

export interface TestResult {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  passed: boolean
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface TaskState {
  taskName: string
  status: TaskStatus
  phases: PhaseState[]
  currentPhaseIndex: number
  startedAt?: string
  completedAt?: string
}

// ---------- Herdr Agent ----------

export interface AgentInfo {
  paneId: string
  agentName: string
  status: 'running' | 'done' | 'idle' | 'blocked' | 'unknown'
}

// ---------- CLI ----------

export interface RunOptions {
  phase?: string
  fromPhase?: string
}
```

### `src/task/task-schema.ts`

Zod schema for task.yaml validation:

```typescript
import { z } from 'zod'

export const TestCommandSchema = z.object({
  command: z.string(),
  optional: z.boolean().optional().default(false),
  failOnError: z.boolean().optional().default(true),
})

export const PhaseSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  label: z.string().min(1),
})

export const OnTestFailureSchema = z.object({
  action: z.enum(['append_to_next_phase', 'stop']),
})

export const TaskSchema = z.object({
  name: z.string().min(1),
  phases: z.array(PhaseSchema).min(1).max(10),
  runBetween: z.array(TestCommandSchema).optional().default([]),
  runAfterAll: z.array(TestCommandSchema).optional().default([]),
  onTestFailure: OnTestFailureSchema.optional().default({ action: 'stop' }),
})

export type ParsedTask = z.infer<typeof TaskSchema>
```

### `src/task/task-loader.ts`

Discover and parse task.yaml files:

```typescript
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
  const parsed = parseYaml(raw)

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
```

### `src/utils/fs.ts`

File system utilities needed by task-loader and elsewhere:

```typescript
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export function glob(pattern: string, root: string): string[] {
  // Simple recursive glob for patterns like "sheepdog/*/task.yaml"
  const parts = pattern.replace(/\\/g, '/').split('/')
  return walk(parts, root, root)
}

function walk(parts: string[], currentRoot: string, baseRoot: string): string[] {
  const part = parts[0]
  if (!part) return [currentRoot]

  if (part === '**') {
    const results: string[] = []
    const rest = parts.slice(1)
    collectRecursive(currentRoot, rest, baseRoot, results)
    return results
  }

  if (part === '*') {
    const results: string[] = []
    const rest = parts.slice(1)
    try {
      for (const entry of readdirSync(currentRoot)) {
        const full = join(currentRoot, entry)
        if (statSync(full).isDirectory()) {
          results.push(...walk(rest, full, baseRoot))
        }
      }
    } catch { /* skip unreadable dirs */ }
    return results
  }

  const next = join(currentRoot, part)
  try {
    if (statSync(next).isFile() || statSync(next).isDirectory()) {
      return walk(parts.slice(1), next, baseRoot)
    }
  } catch { /* not found */ }
  return []
}

function collectRecursive(dir: string, rest: string[], baseRoot: string, results: string[]): void {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        results.push(...walk(rest, full, baseRoot))
        collectRecursive(full, rest, baseRoot, results)
      }
    }
  } catch { /* skip */ }
}
```

### `src/utils/logger.ts`

```typescript
const PREFIX = '\x1b[34m[sheepdog]\x1b[0m'

export function info(msg: string): void {
  console.log(`${PREFIX} ${msg}`)
}

export function success(msg: string): void {
  console.log(`${PREFIX} \x1b[32m✓\x1b[0m ${msg}`)
}

export function warn(msg: string): void {
  console.log(`${PREFIX} \x1b[33m⚠\x1b[0m ${msg}`)
}

export function error(msg: string): void {
  console.error(`${PREFIX} \x1b[31m✗\x1b[0m ${msg}`)
}

export function step(msg: string): void {
  console.log(`  \x1b[90m→\x1b[0m ${msg}`)
}
```

### `src/utils/errors.ts`

```typescript
export class SheepDogError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheepDogError'
  }
}

export class HerdrCommandError extends SheepDogError {
  constructor(cmd: string, exitCode: number, stderr: string) {
    super(`herdr command failed: ${cmd} (exit ${exitCode}): ${stderr}`)
    this.name = 'HerdrCommandError'
  }
}

export class TaskError extends SheepDogError {
  constructor(taskName: string, message: string) {
    super(`[${taskName}] ${message}`)
    this.name = 'TaskError'
  }
}
```

### `src/cli/index.ts` (skeleton)

Minimal commander entry point. All commands are stubs for now:

```typescript
#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('sheepdog')
  .description('Multi-phase agent task orchestrator for herdr + opencode')
  .version('0.1.0')

program
  .command('init')
  .description('Scaffold sheepdog config in a project')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    console.log('init command — not yet implemented')
  })

program
  .command('run <task>')
  .description('Execute a sheepdog task')
  .option('--phase <id>', 'Run a single phase')
  .option('--from-phase <id>', 'Start from a specific phase')
  .action(async (task, options) => {
    console.log(`run command — not yet implemented (task: ${task})`)
  })

program
  .command('status')
  .description('Show task/phase status')
  .argument('[task]', 'Task name (optional)')
  .action(async (task) => {
    console.log('status command — not yet implemented')
  })

program
  .command('list')
  .description('List available tasks')
  .action(async () => {
    console.log('list command — not yet implemented')
  })

program
  .command('plan')
  .description('Generate a task plan via agent')
  .argument('<description>', 'Description of the work')
  .action(async (description) => {
    console.log(`plan command — not yet implemented (description: ${description})`)
  })

program.parse(process.argv)
```

## Testing Instructions

### Run Tests

```bash
npm test
```

### What to Verify

1. **`npm run typecheck`** — zero type errors
2. **`npm test`** — all tests pass
3. **Type validation** — a valid task.yaml parses correctly, an invalid one throws
4. **Task discovery** — `discoverTasks` finds all `sheepdog/*/task.yaml` files
5. **CLI skeleton** — `node dist/cli/index.js --help` shows all 5 commands

### Write These Tests

**`src/task/__tests__/task-schema.test.ts`**
- Valid minimal task.yaml parses
- Valid full task.yaml parses
- Missing `name` field fails
- Empty `phases` array fails
- Invalid `onTestFailure.action` fails
- Default values are applied correctly

**`src/task/__tests__/task-loader.test.ts`**
- `loadTask` reads and parses a valid task.yaml
- `loadTask` throws on missing file
- `loadTask` throws on invalid YAML
- `loadTask` throws on schema violation
- `discoverTasks` finds task dirs
- Path helpers return correct paths

**`src/utils/__tests__/fs.test.ts`**
- `glob` matches `sheepdog/*/task.yaml`
- `glob` with `**` patterns

## Acceptance Criteria

- [ ] `package.json` created with all deps
- [ ] `tsconfig.json` with strict mode
- [ ] `vitest.config.ts` configured
- [ ] All types defined in `src/types/types.ts`
- [ ] Zod schema validates task.yaml
- [ ] Task loader reads, parses, validates
- [ ] Glob utility finds task directories
- [ ] Logger provides colored output
- [ ] Custom error classes defined
- [ ] CLI skeleton shows all 5 commands
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm test` passes all tests
- [ ] `npm run build` produces working JS output
