# Phase 2: Herdr Integration + Opencode Plugin

Build the herdr CLI wrapper for launching/managing agent sessions and the opencode plugin for `/done` detection.

This phase depends on Phase 1 (types, errors, logger, fs utilities).

## Files to Create

### `src/session/herdr-session.ts`

Abstraction over the `herdr` CLI. Wraps agent start, wait, pane read, and pane close.

Requirements:
- All methods call `herdr` CLI via `child_process.execFile` or `spawn`
- Parse CLI output to extract pane IDs, agent names, status
- Handle errors (herdr not installed, command failure, timeout)
- Use `HerdrCommandError` for failures

```typescript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentInfo } from '../types/types.js'
import { HerdrCommandError } from '../utils/errors.js'

const HERDR_BIN = 'herdr'
const execFileAsync = promisify(execFile)

export class HerdrSessionManager {
  /**
   * Start a named agent in a new pane running the given command.
   * Returns the pane ID and agent name.
   */
  async startAgent(
    name: string,
    cwd: string,
    argv: string[],
    options?: {
      tab?: string
      workspace?: string
      split?: 'right' | 'down'
      env?: Record<string, string>
      focus?: boolean
    },
  ): Promise<AgentInfo> {
    const args = ['agent', 'start', name, '--cwd', cwd]

    if (options?.tab) args.push('--tab', options.tab)
    if (options?.workspace) args.push('--workspace', options.workspace)
    if (options?.split) args.push('--split', options.split)
    if (options?.env) {
      for (const [k, v] of Object.entries(options.env)) {
        args.push('--env', `${k}=${v}`)
      }
    }
    if (options?.focus !== false) args.push('--focus')

    args.push('--', ...argv)

    const { stdout, stderr } = await execFileAsync(HERDR_BIN, args)

    // Parse output to extract pane ID
    const paneId = extractPaneId(stdout, stderr)

    return {
      paneId,
      agentName: name,
      status: 'running',
    }
  }

  /**
   * Wait for an agent (by pane ID) to reach a specific status.
   * Default waits for 'done' (process exited).
   */
  async waitForStatus(
    paneId: string,
    status: 'done' | 'idle' | 'working' | 'blocked' = 'done',
    timeoutMs: number = 0,
  ): Promise<void> {
    const args = ['wait', 'agent-status', paneId, '--status', status]
    if (timeoutMs > 0) args.push('--timeout', String(timeoutMs))

    try {
      await execFileAsync(HERDR_BIN, args, { timeout: timeoutMs > 0 ? timeoutMs + 5000 : undefined })
    } catch (err: any) {
      if (err.code === 'ETIMEDOUT') {
        throw new HerdrCommandError(`wait`, 0, `Timed out after ${timeoutMs}ms`)
      }
      throw new HerdrCommandError(`wait`, err.code || 1, err.stderr || err.message)
    }
  }

  /**
   * Read recent output from a pane.
   */
  async readPaneOutput(paneId: string, source: 'visible' | 'recent' = 'recent'): Promise<string> {
    const args = ['pane', 'read', paneId, '--source', source]
    const { stdout } = await execFileAsync(HERDR_BIN, args)
    return stdout
  }

  /**
   * Close a pane.
   */
  async closePane(paneId: string): Promise<void> {
    await execFileAsync(HERDR_BIN, ['pane', 'close', paneId])
  }

  /**
   * List all running agents.
   */
  async listAgents(): Promise<AgentInfo[]> {
    const { stdout } = await execFileAsync(HERDR_BIN, ['agent', 'list'])
    return parseAgentList(stdout)
  }

  /**
   * Get info for a specific agent by name.
   */
  async getAgent(name: string): Promise<AgentInfo | null> {
    try {
      const { stdout } = await execFileAsync(HERDR_BIN, ['agent', 'get', name])
      return parseAgentInfo(stdout)
    } catch {
      return null
    }
  }
}

// ---------- Parsing helpers (extract pane ID from herdr output) ----------

function extractPaneId(stdout: string, stderr: string): string {
  // herdr agent start prints the pane ID in its output
  // Format example: "Created agent in pane pane_123456"
  const combined = stdout + stderr
  const match = combined.match(/pane[_\s]?(\w+)/i)
  if (match) return match[1]

  // Fallback: try to find any identifier-like string
  const idMatch = combined.match(/(pane_\w+)/)
  if (idMatch) return idMatch[1]

  return 'unknown'
}

function parseAgentList(output: string): AgentInfo[] {
  // Parse table-like output from herdr agent list
  // Format: "pane_123  agent-name  running"
  const agents: AgentInfo[] = []
  for (const line of output.split('\n').filter(Boolean)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 3) {
      agents.push({
        paneId: parts[0],
        agentName: parts[1],
        status: parts[2].toLowerCase() as AgentInfo['status'],
      })
    }
  }
  return agents
}

function parseAgentInfo(output: string): AgentInfo | null {
  const lines = output.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return null

  const parts = lines[0].trim().split(/\s+/)
  if (parts.length < 3) return null

  return {
    paneId: parts[0],
    agentName: parts[1],
    status: parts[2].toLowerCase() as AgentInfo['status'],
  }
}
```

### `src/plugin/done-handler.ts`

The `/done` command handler logic. Pure functions — no opencode SDK dependency in this file.

```typescript
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const SHEEPDOG_DIR = 'sheepdog'

/**
 * Find the active sheepdog task directory by walking up from cwd
 * looking for sheepdog/*/.active-phase.
 */
export function findActiveSheepDogTask(cwd: string): string | null {
  let dir = resolve(cwd)

  for (let i = 0; i < 10; i++) {
    const sheepdogDir = resolve(dir, SHEEPDOG_DIR)
    if (existsSync(sheepdogDir)) {
      const entries = readdirSimple(sheepdogDir)
      for (const entry of entries) {
        const taskDir = resolve(sheepdogDir, entry)
        const activePhaseFile = resolve(taskDir, '.active-phase')
        if (existsSync(activePhaseFile)) {
          return taskDir
        }
      }
    }

    const parent = dirname(dir)
    if (parent === dir) break // reached root
    dir = parent
  }

  return null
}

/**
 * Write the .phase-done marker file to signal completion.
 */
export function writeDoneMarker(taskDir: string): void {
  writeFileSync(resolve(taskDir, '.phase-done'), Date.now().toString(), 'utf-8')
}

/**
 * Check if this message is a /done command from the user.
 * message.text should be the message content.
 * We only respond to exact "/done" from the user (not the agent).
 */
export function isDoneCommand(message: { text?: string; from?: string }): boolean {
  return (
    message.text?.trim() === '/done' &&
    (message.from === 'user' || message.from === undefined)
  )
}

function readdirSimple(dir: string): string[] {
  try {
    const { readdirSync, statSync } = require('node:fs')
    return readdirSync(dir).filter((entry: string) => {
      try { return statSync(resolve(dir, entry)).isDirectory() } catch { return false }
    })
  } catch {
    return []
  }
}
```

Note: The `readdirSimple` function uses `require` for compatibility; the plugin will be loaded by opencode which may handle module resolution differently. If using ESM, replace with proper imports.

### `src/plugin/register.ts`

The opencode plugin entry point. This is what gets loaded by opencode via the plugins config.

```typescript
import type { PluginHooks } from '@opencode-ai/plugin'
import { findActiveSheepDogTask, isDoneCommand, writeDoneMarker } from './done-handler.js'

const SheepDogPlugin: PluginHooks = {
  'chat.message': async ({ message, cwd }) => {
    if (!isDoneCommand(message)) return

    const taskDir = findActiveSheepDogTask(cwd ?? process.cwd())
    if (!taskDir) {
      return 'No active sheepdog task found. Run `sheepdog run <task>` first.'
    }

    writeDoneMarker(taskDir)
    return '✓ Phase marked as done. SheepDog will proceed to the next step.'
  },
}

export default SheepDogPlugin
```

### `src/plugin/index.ts`

Re-export for the `exports` field in package.json:

```typescript
export { default } from './register.js'
export { findActiveSheepDogTask, isDoneCommand, writeDoneMarker } from './done-handler.js'
```

## Testing Instructions

### Run Tests

```bash
npx vitest run src/session/ src/plugin/
```

### What to Verify

1. **Herdr session** — unit tests with mocked `execFile`; verify correct CLI args
2. **Plugin /done handler** — unit tests for `isDoneCommand`, `findActiveSheepDogTask`, `writeDoneMarker`
3. **Integration** — the plugin registers without errors (can't fully test without opencode, but verify exports)

### Write These Tests

**`src/session/__tests__/herdr-session.test.ts`**
- `startAgent` calls `herdr agent start` with all args
- `startAgent` parses pane ID from output
- `startAgent` passes `--env` correctly
- `startAgent` passes `--split`, `--tab`, `--workspace`
- `waitForStatus` calls `herdr wait agent-status` with correct args
- `waitForStatus` with custom timeout
- `waitForStatus` throws `HerdrCommandError` on failure
- `readPaneOutput` calls `herdr pane read` with correct args
- `closePane` calls `herdr pane close`
- `listAgents` parses output correctly
- `getAgent` returns null for missing agent

**`src/plugin/__tests__/done-handler.test.ts`**
- `isDoneCommand` returns true for `/done` from user
- `isDoneCommand` returns false for other text
- `isDoneCommand` returns false for `/Done` (case sensitive)
- `isDoneCommand` returns false for messages from agent
- `findActiveSheepDogTask` finds task dir with `.active-phase`
- `findActiveSheepDogTask` walks up directories
- `findActiveSheepDogTask` returns null when no task found
- `writeDoneMarker` creates `.phase-done` file

**`src/plugin/__tests__/register.test.ts`**
- Plugin exports default function
- Plugin returns completion message for `/done`
- Plugin returns 'no active task' message when no task found

## Acceptance Criteria

- [ ] `HerdrSessionManager` class with all 6 methods implemented
- [ ] All herdr CLI calls wrapped with error handling
- [ ] `HerdrCommandError` thrown on herdr failures
- [ ] `/done` handler detects exact `/done` from user only
- [ ] `findActiveSheepDogTask` walks parent dirs to find task
- [ ] `writeDoneMarker` creates `.phase-done` marker file
- [ ] Plugin exports valid opencode plugin hooks
- [ ] Plugin returns user-visible confirmation message
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` — all tests pass
