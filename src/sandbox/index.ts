import type { SandboxAPI, ScriptCheckpoint, CallLogEntry, AgentStepOptions, VerificationOptions, VerificationResult, ShellOptions } from './types.js'
import { computeCallId, recordCompletedCall, hasCompletedCall } from './checkpoint.js'

function createStubAPI(taskDir: string): SandboxAPI {
  return {
    async runAgentStep(opts: AgentStepOptions) {
      console.log(`[sandbox] runAgentStep(${opts.planFile})`)
      return { planAccepted: true }
    },
    async run_verification(opts: VerificationOptions) {
      console.log(`[sandbox] run_verification(${opts.script})`)
      const result: VerificationResult = { passed: true, output: '' }
      return result
    },
    async run_command(opts: ShellOptions) {
      console.log(`[sandbox] run_command(${opts.command})`)
      return { stdout: '', stderr: '', exitCode: 0 }
    },
    async checkpoint(name: string) {
      console.log(`[sandbox] checkpoint(${name})`)
    },
    async run_agent(opts: Record<string, unknown>) {
      console.log(`[sandbox] run_agent(${JSON.stringify(opts)})`)
      return { completed: true }
    },
    async run_function(fn: () => unknown) {
      console.log(`[sandbox] run_function()`)
      return fn()
    },
  }
}

export function wrapWithCheckpoint(
  api: SandboxAPI,
  checkpoint: ScriptCheckpoint,
  onRecorded?: () => void,
): SandboxAPI {
  return new Proxy(api, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      const name = String(prop)
      if (name === 'run_function') return value
      return (...args: unknown[]) => {
        const callId = computeCallId(name, args)
        const existing = hasCompletedCall(checkpoint, callId)
        if (existing) {
          return Promise.resolve(existing.result)
        }
        const raw = value(...args)
        const record = (result: unknown) => {
          recordCompletedCall(checkpoint, callId, name, args, result)
          onRecorded?.()
        }
        if (raw instanceof Promise) {
          return raw.then(result => {
            record(result)
            return result
          })
        }
        record(raw)
        return raw
      }
    },
  })
}

export function createSandboxAPI(taskDir: string, checkpoint: ScriptCheckpoint): SandboxAPI {
  return wrapWithCheckpoint(createStubAPI(taskDir), checkpoint)
}
