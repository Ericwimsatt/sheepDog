import { readFileSync, existsSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { spawn } from 'node:child_process'
import { compileSandboxScript } from './compiler.js'
import { wrapWithCheckpoint } from './index.js'
import { loadScriptCheckpoint, saveScriptCheckpoint, computeCallId, hasCompletedCall, recordCompletedCall } from './checkpoint.js'
import type { SandboxAPI, ScriptCheckpoint, ShellOptions, VerificationOptions, VerificationResult, AgentStepOptions } from './types.js'

export type SandboxEvent =
  | { type: 'phase-start'; phaseName: string }
  | { type: 'phase-complete'; phaseName: string; success: boolean }
  | { type: 'checkpoint'; name: string }

export interface RunScriptOptions {
  onEvent?: (event: SandboxEvent) => void
}

function createRealAPI(
  taskDir: string,
  projectRoot: string,
  checkpoint: ScriptCheckpoint,
  emitEvent: (event: SandboxEvent) => void,
  saveCheckpoint: () => void,
): SandboxAPI {
  return {
    async runAgentStep(_opts: AgentStepOptions) {
      return { planAccepted: true }
    },

    async run_verification(opts: VerificationOptions): Promise<VerificationResult> {
      const { script } = opts
      emitEvent({ type: 'phase-start', phaseName: `verification: ${script}` })

      if (script.endsWith('.sh')) {
        return new Promise((resolve) => {
          const child = spawn(script, [], {
            cwd: taskDir,
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe'],
            timeout: 60_000,
            env: { ...process.env },
          })
          let output = ''
          child.stdout!.on('data', (data: Buffer) => { output += data.toString() })
          child.stderr!.on('data', (data: Buffer) => { output += data.toString() })
          child.on('exit', (code: number | null) => {
            const passed = code === 0
            emitEvent({ type: 'phase-complete', phaseName: `verification: ${script}`, success: passed })
            resolve({ passed, output })
          })
          child.on('error', (err: Error) => {
            emitEvent({ type: 'phase-complete', phaseName: `verification: ${script}`, success: false })
            resolve({ passed: false, output: err.message })
          })
        })
      }

      if (script.endsWith('.ts')) {
        try {
          const { execSync } = await import('node:child_process')
          const output = execSync(`npx tsx "${script}"`, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 60_000,
          })
          emitEvent({ type: 'phase-complete', phaseName: `verification: ${script}`, success: true })
          return { passed: true, output }
        } catch (err: any) {
          emitEvent({ type: 'phase-complete', phaseName: `verification: ${script}`, success: false })
          return { passed: false, output: err.stdout || err.stderr || err.message || String(err) }
        }
      }

      if (script.endsWith('.md')) {
        throw new Error('Markdown verification scripts are not implemented yet')
      }

      throw new Error(`Unsupported verification script type: ${script}`)
    },

    async run_command(opts: ShellOptions) {
      const { command, cwd, timeout } = opts
      const execCwd = cwd ? (isAbsolute(cwd) ? cwd : join(taskDir, cwd)) : taskDir
      emitEvent({ type: 'phase-start', phaseName: `command: ${command}` })

      return new Promise((resolve, reject) => {
        const child = spawn(command, [], {
          cwd: execCwd,
          shell: true,
          stdio: ['inherit', 'pipe', 'pipe'],
          timeout: timeout ?? 300_000,
          env: { ...process.env },
        })
        let stdout = ''
        let stderr = ''
        child.stdout!.on('data', (data: Buffer) => { stdout += data.toString() })
        child.stderr!.on('data', (data: Buffer) => { stderr += data.toString() })
        child.on('error', (err: Error) => reject(err))
        child.on('exit', (code: number | null) => {
          const exitCode = code ?? 1
          emitEvent({ type: 'phase-complete', phaseName: `command: ${command}`, success: exitCode === 0 })
          resolve({ stdout, stderr, exitCode })
        })
      })
    },

    async checkpoint(name: string) {
      emitEvent({ type: 'checkpoint', name })
    },

    async run_agent(_opts: Record<string, unknown>) {
      emitEvent({ type: 'phase-start', phaseName: 'agent' })
      emitEvent({ type: 'phase-complete', phaseName: 'agent', success: true })
      return { completed: true }
    },

    async run_function(fn: () => unknown) {
      const fingerprint = fn.toString()
      const callId = computeCallId('run_function', [fingerprint])
      const existing = hasCompletedCall(checkpoint, callId)
      if (existing) {
        return Promise.resolve(existing.result)
      }
      emitEvent({ type: 'phase-start', phaseName: 'run_function' })
      const result = await fn()
      recordCompletedCall(checkpoint, callId, 'run_function', [fingerprint], result)
      saveCheckpoint()
      emitEvent({ type: 'phase-complete', phaseName: 'run_function', success: true })
      return result
    },
  }
}

export async function runScript(
  taskDir: string,
  projectRoot: string,
  options?: RunScriptOptions,
): Promise<ScriptCheckpoint> {
  const { onEvent } = options ?? {}
  const emitEvent = (event: SandboxEvent) => { onEvent?.(event) }

  const checkpoint = loadScriptCheckpoint(taskDir)

  const mainTsPath = join(taskDir, 'main.ts')
  if (!existsSync(mainTsPath)) {
    throw new Error(`main.ts not found in task directory: ${taskDir}`)
  }
  const source = readFileSync(mainTsPath, 'utf-8')
  const compiledJs = compileSandboxScript(source, 'main.ts')

  const saveCheckpoint = () => saveScriptCheckpoint(taskDir, checkpoint)
  const realApi = createRealAPI(taskDir, projectRoot, checkpoint, emitEvent, saveCheckpoint)
  const api = wrapWithCheckpoint(realApi, checkpoint, saveCheckpoint)

  const strippedJs = compiledJs.replace(/^export\s+(default\s+)?/gm, '')
  const asyncWrapper = `return (async () => {\n${strippedJs}\n})()`
  const fn = new Function('__sheepdog_sandbox_api__', asyncWrapper)
  await fn(api)

  checkpoint.completedAt = new Date().toISOString()
  saveScriptCheckpoint(taskDir, checkpoint)

  return checkpoint
}
