import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentInfo } from '../types/types.js'
import { HerdrCommandError } from '../utils/errors.js'

const HERDR_BIN = 'herdr'
const execFileAsync = promisify(execFile)

export class HerdrSessionManager {
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
    return this.startAgentWithRetry(name, 1, cwd, argv, options)
  }

  private async startAgentWithRetry(
    baseName: string,
    attempt: number,
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
    const name = attempt === 1 ? baseName : `${baseName}(${attempt})`
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

    try {
      const { stdout, stderr } = await execFileAsync(HERDR_BIN, args)
      const paneId = extractPaneId(stdout, stderr)
      return { paneId, agentName: name, status: 'running' }
    } catch (err: any) {
      const errorText = (err.stderr || '') + (err.message || '')
      if (isNameTaken(errorText) && attempt < 10) {
        return this.startAgentWithRetry(baseName, attempt + 1, cwd, argv, options)
      }
      throw err
    }
  }

  async waitForStatus(
    paneId: string,
    status: 'done' | 'idle' | 'working' | 'blocked' = 'done',
    timeoutMs: number = 0,
  ): Promise<void> {
    const args = ['wait', 'agent-status', paneId, '--status', status]

    try {
      if (timeoutMs > 0) {
        args.push('--timeout', String(timeoutMs))
        await execFileAsync(HERDR_BIN, args, { timeout: timeoutMs + 5000 })
      } else {
        await execFileAsync(HERDR_BIN, args)
      }
    } catch (err: any) {
      if (err.code === 'ETIMEDOUT') {
        throw new HerdrCommandError('wait', 0, `Timed out after ${timeoutMs}ms`)
      }
      throw new HerdrCommandError('wait', err.code || 1, err.stderr || err.message)
    }
  }

  async readPaneOutput(paneId: string, source: 'visible' | 'recent' = 'recent'): Promise<string> {
    const args = ['pane', 'read', paneId, '--source', source]
    const { stdout } = await execFileAsync(HERDR_BIN, args)
    return stdout
  }

  async agentSendKeys(target: string, keys: string[]): Promise<void> {
    await execFileAsync(HERDR_BIN, ['agent', 'send-keys', target, ...keys])
  }

  async agentPrompt(target: string, text: string): Promise<void> {
    await execFileAsync(HERDR_BIN, ['agent', 'prompt', target, text])
  }

  async closePane(paneId: string): Promise<void> {
    await execFileAsync(HERDR_BIN, ['pane', 'close', paneId])
  }

  async listAgents(): Promise<AgentInfo[]> {
    const { stdout } = await execFileAsync(HERDR_BIN, ['agent', 'list'])
    return parseAgentList(stdout)
  }

  async getAgent(name: string): Promise<AgentInfo | null> {
    try {
      const { stdout } = await execFileAsync(HERDR_BIN, ['agent', 'get', name])
      return parseAgentInfo(stdout)
    } catch {
      return null
    }
  }
}

function extractPaneId(stdout: string, stderr: string): string {
  try {
    const parsed = JSON.parse(stdout)
    const paneId = parsed?.result?.agent?.pane_id
    if (paneId) return paneId
  } catch {}

  const combined = stdout + stderr
  const match = combined.match(/pane[_\s]?(\w+)/i)
  if (match) return match[1]

  const idMatch = combined.match(/(pane_\w+)/)
  if (idMatch) return idMatch[1]

  return 'unknown'
}

function parseAgentList(output: string): AgentInfo[] {
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

function isNameTaken(text: string): boolean {
  return text.includes('agent_name_taken') || text.includes('name is already used')
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
