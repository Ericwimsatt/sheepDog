import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync, cpSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { runScript } from '../runner.js'
import type { SandboxEvent } from '../runner.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures')
const PROJECT_ROOT = join(__dirname, '..', '..', '..')

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-runner-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('runScript', () => {
  it('executes a simple main.ts with run_command', async () => {
    const taskDir = join(tmpDir, 'simple-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'main.ts'), [
      `import { run_command } from '@sheepdog/sandbox'`,
      `await run_command({ command: 'echo hello from sandbox' })`,
    ].join('\n'))

    const checkpoint = await runScript(taskDir, PROJECT_ROOT)

    expect(checkpoint.completedCalls).toHaveLength(1)
    expect(checkpoint.completedCalls[0].name).toBe('run_command')
    const result = checkpoint.completedCalls[0].result as { stdout: string; stderr: string; exitCode: number }
    expect(result.stdout).toContain('hello from sandbox')
    expect(result.exitCode).toBe(0)
  })

  it('loads and reuses checkpoint on second run (resume)', async () => {
    const taskDir = join(tmpDir, 'resume-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'main.ts'), [
      `import { run_command, run_function, checkpoint } from '@sheepdog/sandbox'`,
      `await run_command({ command: 'echo first' })`,
      `await run_function(() => { return 'expensive' })`,
      `await checkpoint('mid-point')`,
      `await run_command({ command: 'echo last' })`,
    ].join('\n'))

    const cp1 = await runScript(taskDir, PROJECT_ROOT)
    expect(cp1.completedCalls.length).toBeGreaterThanOrEqual(3)

    const cp2 = await runScript(taskDir, PROJECT_ROOT)
    expect(cp2.completedCalls).toHaveLength(cp1.completedCalls.length)
  })

  it('emits events during execution', async () => {
    const taskDir = join(tmpDir, 'event-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'main.ts'), [
      `import { run_command, checkpoint } from '@sheepdog/sandbox'`,
      `await run_command({ command: 'echo phase-1' })`,
      `await checkpoint('phase-1')`,
      `await run_command({ command: 'echo phase-2' })`,
    ].join('\n'))

    const events: SandboxEvent[] = []
    await runScript(taskDir, PROJECT_ROOT, {
      onEvent: (event) => { events.push(event) },
    })

    expect(events.length).toBeGreaterThanOrEqual(4)
    const types = events.map(e => e.type)
    expect(types.filter(t => t === 'phase-start').length).toBeGreaterThanOrEqual(2)
    expect(types.filter(t => t === 'phase-complete').length).toBeGreaterThanOrEqual(2)
    expect(types).toContain('checkpoint')
  })

  it('skips run_function on resume when fingerprint matches', async () => {
    const taskDir = join(tmpDir, 'fn-resume-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'main.ts'), [
      `import { run_function } from '@sheepdog/sandbox'`,
      `const result = await run_function(() => { return 'expensive-computation' })`,
    ].join('\n'))

    const cp1 = await runScript(taskDir, PROJECT_ROOT)
    const fnCalls = cp1.completedCalls.filter(c => c.name === 'run_function')
    expect(fnCalls).toHaveLength(1)
    expect(fnCalls[0].result).toBe('expensive-computation')

    const cp2 = await runScript(taskDir, PROJECT_ROOT)
    const fnCalls2 = cp2.completedCalls.filter(c => c.name === 'run_function')
    expect(fnCalls2).toHaveLength(1)
  })

  it('throws on syntax error in main.ts', async () => {
    const taskDir = join(tmpDir, 'syntax-error-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'main.ts'), [
      `import { run_command } from '@sheepdog/sandbox'`,
      `const x =`,
    ].join('\n'))

    await expect(runScript(taskDir, PROJECT_ROOT)).rejects.toThrow()
  })

  it('throws on runtime error in main.ts', async () => {
    const taskDir = join(tmpDir, 'runtime-error-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'main.ts'), [
      `import { run_command } from '@sheepdog/sandbox'`,
      `throw new Error('task failed')`,
    ].join('\n'))

    await expect(runScript(taskDir, PROJECT_ROOT)).rejects.toThrow('task failed')
  })

  it('compiles and runs end-to-end using fixture files', async () => {
    const taskDir = join(tmpDir, 'e2e-task')
    cpSync(join(FIXTURES_DIR, 'simple-task'), taskDir, { recursive: true })

    const checkpoint = await runScript(taskDir, PROJECT_ROOT)

    expect(checkpoint.completedCalls).toHaveLength(1)
    expect(checkpoint.completedCalls[0].name).toBe('run_command')
    const result = checkpoint.completedCalls[0].result as { stdout: string; stderr: string; exitCode: number }
    expect(result.stdout).toContain('hello from sandbox')
  })

  it('throws when main.ts does not exist', async () => {
    const taskDir = join(tmpDir, 'nonexistent')

    await expect(runScript(taskDir, PROJECT_ROOT)).rejects.toThrow('main.ts not found')
  })
})
