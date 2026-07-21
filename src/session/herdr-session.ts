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

    const paneId = extractPaneId(stdout, stderr)

    return {
      paneId,
      agentName: name,
      status: 'running',
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
