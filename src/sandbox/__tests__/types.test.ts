import { describe, it, expect } from 'vitest'
import { createSandboxAPI } from '../index.js'
import type { SandboxAPI, ScriptCheckpoint, AgentStepOptions, VerificationOptions, VerificationResult, ShellOptions, CallLogEntry } from '../types.js'

function makeCheckpoint(): ScriptCheckpoint {
  return { taskName: 'test', completedCalls: [] }
}

describe('SandboxAPI types', () => {
  it('createSandboxAPI returns object matching SandboxAPI', () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    expect(typeof api.runAgentStep).toBe('function')
    expect(typeof api.run_verification).toBe('function')
    expect(typeof api.run_command).toBe('function')
    expect(typeof api.checkpoint).toBe('function')
    expect(typeof api.run_agent).toBe('function')
    expect(typeof api.run_function).toBe('function')
  })
})

describe('createSandboxAPI', () => {
  it('runAgentStep returns a result', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const result = await api.runAgentStep({ planFile: 'plan.md' })
    expect(result).toEqual({ planAccepted: true })
  })

  it('run_verification returns VerificationResult', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const result = await api.run_verification({ script: 'test.sh' })
    expect(result).toHaveProperty('passed')
    expect(result).toHaveProperty('output')
  })

  it('run_command returns shell result', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const result = await api.run_command({ command: 'echo hi' })
    expect(result).toHaveProperty('stdout')
    expect(result).toHaveProperty('stderr')
    expect(result).toHaveProperty('exitCode')
  })

  it('checkpoint resolves', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    await expect(api.checkpoint('phase-1')).resolves.toBeUndefined()
  })

  it('run_agent returns result', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const result = await api.run_agent({ task: 'test' })
    expect(result).toHaveProperty('completed')
  })

  it('run_function executes the given function', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const result = await api.run_function(() => 42)
    expect(result).toBe(42)
  })
})

describe('Proxy caching', () => {
  it('returns cached result on second call with same args', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const opts: AgentStepOptions = { planFile: 'plan.md' }
    const result1 = await api.runAgentStep(opts)
    const result2 = await api.runAgentStep(opts)
    expect(result2).toEqual(result1)
    expect(checkpoint.completedCalls).toHaveLength(1)
  })

  it('records call in checkpoint', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    await api.runAgentStep({ planFile: 'plan.md' })
    expect(checkpoint.completedCalls).toHaveLength(1)
    expect(checkpoint.completedCalls[0].name).toBe('runAgentStep')
  })

  it('treats different args as different calls', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    await api.runAgentStep({ planFile: 'plan-a.md' })
    await api.runAgentStep({ planFile: 'plan-b.md' })
    expect(checkpoint.completedCalls).toHaveLength(2)
  })

  it('caches verification calls', async () => {
    const checkpoint = makeCheckpoint()
    const api = createSandboxAPI('/tmp/test-task', checkpoint)
    const opts: VerificationOptions = { script: 'test.sh' }
    const result1 = await api.run_verification(opts)
    const result2 = await api.run_verification(opts)
    expect(result2).toEqual(result1)
  })
})
