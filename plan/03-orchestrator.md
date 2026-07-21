# Phase 3: Orchestrator

Build the core orchestration engine: phase loop, phase execution, test runner, and context builder.

This phase depends on Phase 1 (types, task loader, fs utils, logger, errors) and Phase 2 (herdr session, plugin).

## Files to Create

### `src/orchestrator/test-runner.ts`

Execute shell commands and collect structured results.

```typescript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { TestCommand, TestResult } from '../types/types.js'
import { step, warn, error } from '../utils/logger.js'

const execFileAsync = promisify(execFile)

export interface TestRunnerOptions {
  cwd: string
  env?: Record<string, string>
}

export class TestRunner {
  private options: TestRunnerOptions

  constructor(options: TestRunnerOptions) {
    this.options = options
  }

  async run(commands: TestCommand[]): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (const cmd of commands) {
      step(`Running: ${cmd.command}`)
      const result = await this.executeCommand(cmd.command)
      results.push(result)

      if (!result.passed && !cmd.optional && cmd.failOnError) {
        error(`Command failed: ${cmd.command}`)
        break // stop on hard failure
      }

      if (!result.passed && cmd.optional) {
        warn(`Optional command failed (ignored): ${cmd.command}`)
      }
    }

    return results
  }

  private async executeCommand(command: string): Promise<TestResult> {
    const parts = command.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        timeout: 300_000, // 5 minute timeout per command
      })

      return {
        command,
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        passed: true,
      }
    } catch (err: any) {
      return {
        command,
        exitCode: err.code ?? 1,
        stdout: err.stdout?.trim() ?? '',
        stderr: err.stderr?.trim() ?? err.message ?? '',
        passed: false,
      }
    }
  }
}
```

### `src/orchestrator/context-builder.ts`

Assemble the phase context file from the todo instructions and any previous test failures.

```typescript
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Phase, TestResult } from '../types/types.js'
import { phaseFilePath, contextFilePath } from '../task/task-loader.js'

export interface ContextBuilderOptions {
  taskDir: string
  phase: Phase
  previousTestResults?: TestResult[]
}

/**
 * Build the phase context markdown file.
 * Returns the path to the written file.
 */
export function buildPhaseContext(options: ContextBuilderOptions): string {
  const { taskDir, phase, previousTestResults } = options

  // Read todo instructions
  const todoPath = phaseFilePath(taskDir, phase)
  const todoContent = existsSync(todoPath)
    ? readFileSync(todoPath, 'utf-8')
    : '# No instructions provided\n'

  // Build context document
  const lines: string[] = []

  lines.push(`# Phase: ${phase.label}`)
  lines.push('')
  lines.push('## Instructions')
  lines.push('')
  lines.push(todoContent.trim())
  lines.push('')

  // Append previous test failures if any
  if (previousTestResults && previousTestResults.length > 0) {
    const failures = previousTestResults.filter(r => !r.passed)
    if (failures.length > 0) {
      lines.push('---')
      lines.push('')
      lines.push('## Previous Phase Test Failures')
      lines.push('')
      lines.push('The following tests failed in the previous phase. Please address these before proceeding.')
      lines.push('')

      for (const failure of failures) {
        lines.push(`### \`${failure.command}\` (exit code ${failure.exitCode})`)
        lines.push('')
        lines.push('```')
        if (failure.stdout) {
          lines.push(failure.stdout)
        }
        if (failure.stderr) {
          lines.push(failure.stderr)
        }
        if (!failure.stdout && !failure.stderr) {
          lines.push('(no output)')
        }
        lines.push('```')
        lines.push('')
      }
    }
  }

  const content = lines.join('\n')
  const outputPath = contextFilePath(taskDir, phase.id)
  writeFileSync(outputPath, content, 'utf-8')

  return outputPath
}
```

### `src/orchestrator/phase-runner.ts`

Execute a single phase: write context, launch opencode via herdr, wait for `/done`, collect output.

```typescript
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { HerdrSessionManager } from '../session/herdr-session.js'
import { buildPhaseContext } from './context-builder.js'
import { doneMarkerPath, activePhasePath } from '../task/task-loader.js'
import type { Phase, TestResult, PhaseState } from '../types/types.js'
import { info, success, step } from '../utils/logger.js'

export interface PhaseRunnerOptions {
  taskDir: string
  projectRoot: string
  herdr: HerdrSessionManager
  phase: Phase
  previousTestResults?: TestResult[]
}

export class PhaseRunner {
  async run(options: PhaseRunnerOptions): Promise<PhaseState> {
    const { taskDir, projectRoot, herdr, phase, previousTestResults } = options

    const startedAt = new Date().toISOString()

    // 1. Write context file
    info(`Preparing context for phase: ${phase.label}`)
    buildPhaseContext({ taskDir, phase, previousTestResults })

    // 2. Write active phase marker
    writeFileSync(activePhasePath(taskDir), phase.id, 'utf-8')

    // 3. Remove any stale done marker
    const donePath = doneMarkerPath(taskDir)
    if (existsSync(donePath)) {
      unlinkSync(donePath)
    }

    // 4. Launch opencode via herdr
    info(`Launching phase: ${phase.label}`)
    const agentName = `${phase.id}`
    const agentInfo = await herdr.startAgent(agentName, projectRoot, ['opencode'], {
      split: 'right',
    })
    success(`Phase started in pane: ${agentInfo.paneId}`)

    // 5. Wait for the .phase-done marker file to appear
    step('Waiting for /done marker...')
    await this.waitForDoneMarker(taskDir)

    // 6. Read pane output
    step('Reading phase output...')
    let output = ''
    try {
      output = await herdr.readPaneOutput(agentInfo.paneId, 'recent')
    } catch {
      step('Could not read pane output (pane may have been closed)')
    }

    const completedAt = new Date().toISOString()

    return {
      phaseId: phase.id,
      status: 'completed',
      startedAt,
      completedAt,
      testResults: [],
    }
  }

  private async waitForDoneMarker(taskDir: string, pollMs: number = 500, timeoutMs: number = 0): Promise<void> {
    const donePath = doneMarkerPath(taskDir)
    const startTime = Date.now()

    // Wait for marker to appear
    while (true) {
      if (existsSync(donePath)) {
        // Clean up marker
        unlinkSync(donePath)
        return
      }

      if (timeoutMs > 0 && Date.now() - startTime > timeoutMs) {
        throw new Error(`Timed out waiting for /done marker after ${timeoutMs}ms`)
      }

      await sleep(pollMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### `src/orchestrator/orchestrator.ts`

Main orchestrator: loads task, runs phases sequentially, gates with tests, handles failures.

```typescript
import { HerdrSessionManager } from '../session/herdr-session.js'
import { loadTask, activePhasePath, doneMarkerPath } from '../task/task-loader.js'
import { PhaseRunner } from './phase-runner.js'
import { TestRunner } from './test-runner.js'
import type { LoadedTask, RunOptions } from '../types/types.js'
import type { PhaseState, TaskState, TestResult } from '../types/types.js'
import { info, success, warn, error } from '../utils/logger.js'

export class Orchestrator {
  private herdr: HerdrSessionManager
  private phaseRunner: PhaseRunner
  private testRunner: TestRunner

  constructor() {
    this.herdr = new HerdrSessionManager()
    this.phaseRunner = new PhaseRunner()
    this.testRunner = new TestRunner({ cwd: process.cwd() })
  }

  async runTask(taskDir: string, options?: RunOptions): Promise<TaskState> {
    const loaded = loadTask(taskDir)
    const { task, projectRoot } = loaded

    info(`Starting task: ${task.name}`)

    const taskState: TaskState = {
      taskName: task.name,
      status: 'running',
      phases: [],
      currentPhaseIndex: 0,
      startedAt: new Date().toISOString(),
    }

    // Determine which phases to run
    const startIndex = options?.fromPhase
      ? task.phases.findIndex(p => p.id === options.fromPhase)
      : 0

    const runPhases = options?.phase
      ? task.phases.filter(p => p.id === options.phase)
      : task.phases.slice(Math.max(0, startIndex))

    if (runPhases.length === 0) {
      error('No phases to run')
      taskState.status = 'failed'
      return taskState
    }

    let previousTestResults: TestResult[] | undefined

    for (const phase of runPhases) {
      info(`── Phase: ${phase.label} ──`)

      // Run phase
      const phaseState = await this.phaseRunner.run({
        taskDir,
        projectRoot,
        herdr: this.herdr,
        phase,
        previousTestResults,
      })

      taskState.phases.push(phaseState)
      success(`Phase complete: ${phase.label}`)

      // Run between-phase tests
      if (task.runBetween && task.runBetween.length > 0) {
        info('Running between-phase tests...')
        const testResults = await this.testRunner.run(task.runBetween)
        phaseState.testResults = testResults

        // Check for hard failures
        const hardFailures = testResults.filter(
          r => !r.passed && !task.runBetween.find(tc => tc.command === r.command)?.optional
        )

        if (hardFailures.length > 0) {
          if (task.onTestFailure?.action === 'stop') {
            error('Tests failed and onTestFailure is set to stop. Aborting.')
            taskState.status = 'failed'
            taskState.completedAt = new Date().toISOString()
            return taskState
          }

          // append_to_next_phase — pass failures forward
          warn(`Tests failed, but continuing. Failures will be passed to next phase.`)
          previousTestResults = testResults
        } else {
          previousTestResults = undefined
        }
      }
    }

    // Run after-all tests
    if (task.runAfterAll && task.runAfterAll.length > 0) {
      info('Running after-all tests...')
      const finalResults = await this.testRunner.run(task.runAfterAll)
      const failures = finalResults.filter(r => !r.passed)
      if (failures.length > 0) {
        warn(`${failures.length} after-all test(s) failed`)
      } else {
        success('All after-all tests passed')
      }
    }

    // Cleanup marker files
    this.cleanup(taskDir)

    taskState.status = 'completed'
    taskState.completedAt = new Date().toISOString()
    success(`Task complete: ${task.name}`)
    return taskState
  }

  private cleanup(taskDir: string): void {
    const fs = require('node:fs')
    const active = activePhasePath(taskDir)
    const done = doneMarkerPath(taskDir)
    try { fs.unlinkSync(active) } catch {}
    try { fs.unlinkSync(done) } catch {}
  }
}
```

### `src/orchestrator/index.ts`

Re-export:

```typescript
export { Orchestrator } from './orchestrator.js'
export { PhaseRunner } from './phase-runner.js'
export { TestRunner } from './test-runner.js'
export { buildPhaseContext } from './context-builder.js'
```

## Testing Instructions

### Run Tests

```bash
npx vitest run src/orchestrator/
```

### What to Verify

1. **Test runner** — executes commands, collects stdout/stderr/exit codes
2. **Context builder** — writes valid markdown with todo content + test failures appended
3. **Phase runner** — orchestrates context writing, marker waiting, output collection
4. **Orchestrator** — full loop: load → phase 1 → test → phase 2 → test → ... → after-all tests

### Write These Tests

**`src/orchestrator/__tests__/test-runner.test.ts`**
- Runs a successful command and returns `passed: true`
- Runs a failing command and returns `passed: false`
- Stops on `failOnError` commands
- Continues on `optional` failures
- Returns `TestResult` with correct stdout/stderr/exitCode

**`src/orchestrator/__tests__/context-builder.test.ts`**
- Builds context with todo content
- Appends previous test failures
- Handles missing todo file gracefully
- Handles empty test results

**`src/orchestrator/__tests__/phase-runner.test.ts`**
- Writes context file before launching
- Writes `.active-phase` marker
- Removes stale `.phase-done` marker
- Waits for `.phase-done` marker to appear
- Cleans up marker after completion
- Returns correct `PhaseState`

**`src/orchestrator/__tests__/orchestrator.test.ts`**
- Orchestrator runs all phases sequentially
- Runs between-phase tests
- Passes test failures to next phase
- Stops on `onTestFailure: stop`
- Runs after-all tests
- Returns correct `TaskState`

Use mocks for:
- `HerdrSessionManager` (mock `startAgent`, `waitForStatus`, `readPaneOutput`)
- `readFileSync` / `existsSync` (mock filesystem for task files)
- `execFile` (mock command execution in TestRunner)

Set up test fixtures:
- `src/orchestrator/__tests__/fixtures/valid-task/` — with `task.yaml` and `todo-phase-1.md` through `todo-phase-4.md`

## Acceptance Criteria

- [ ] `TestRunner` executes commands, returns structured `TestResult[]`
- [ ] Handles optional commands (continue on failure)
- [ ] Handles `failOnError` commands (stop on failure)
- [ ] `ContextBuilder` produces markdown with instructions + optional test failures
- [ ] `PhaseRunner` writes context, launches agent, waits for `/done`, reads output
- [ ] `Orchestrator` runs full task lifecycle
- [ ] Marker files cleaned up after completion
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` — all tests pass
