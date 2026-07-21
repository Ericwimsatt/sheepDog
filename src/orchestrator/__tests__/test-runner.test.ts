import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TestRunner } from '../test-runner.js'
import type { TestCommand } from '../../types/types.js'

type ExecFileCallback = (...args: any[]) => void

const mockExecImpl = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => {
    const cb = args[args.length - 1] as ExecFileCallback
    try {
      const result = mockExecImpl(args[0], args[1])
      if (result && typeof (result as any).then === 'function') {
        (result as Promise<any>).then(
          (res: any) => cb(null, res),
          (err: Error) => cb(err),
        )
      } else {
        cb(null, result ?? { stdout: '', stderr: '' })
      }
    } catch (err) {
      cb(err)
    }
  },
}))

let runner: TestRunner

beforeEach(() => {
  vi.clearAllMocks()
  runner = new TestRunner({ cwd: '/tmp' })
})

describe('TestRunner', () => {
  it('runs a successful command and returns passed: true', async () => {
    mockExecImpl.mockReturnValue({ stdout: 'hello world\n', stderr: '' })

    const results = await runner.run([{ command: 'echo hello', optional: false, failOnError: false }])

    expect(results).toHaveLength(1)
    expect(results[0].passed).toBe(true)
    expect(results[0].exitCode).toBe(0)
    expect(results[0].stdout).toBe('hello world')
    expect(results[0].command).toBe('echo hello')
  })

  it('runs a failing command and returns passed: false', async () => {
    mockExecImpl.mockImplementation(() => {
      const err = new Error('command failed') as any
      err.code = 1
      err.stderr = 'error output'
      throw err
    })

    const results = await runner.run([{ command: 'false', optional: false, failOnError: false }])

    expect(results).toHaveLength(1)
    expect(results[0].passed).toBe(false)
    expect(results[0].exitCode).toBe(1)
    expect(results[0].stderr).toBe('error output')
  })

  it('stops on failOnError commands', async () => {
    mockExecImpl.mockImplementation(() => {
      const err = new Error('failed') as any
      err.code = 1
      throw err
    })

    const results = await runner.run([
      { command: 'failing-cmd', optional: false, failOnError: true },
      { command: 'echo should-not-run', optional: false, failOnError: false },
    ])

    expect(results).toHaveLength(1)
  })

  it('continues on optional failures', async () => {
    let callCount = 0
    mockExecImpl.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const err = new Error('optional failed') as any
        err.code = 1
        throw err
      }
      return { stdout: 'ok', stderr: '' }
    })

    const results = await runner.run([
      { command: 'optional-cmd', optional: true, failOnError: false },
      { command: 'echo ok', optional: false, failOnError: false },
    ])

    expect(results).toHaveLength(2)
    expect(results[0].passed).toBe(false)
    expect(results[1].passed).toBe(true)
  })

  it('returns TestResult with correct stdout/stderr/exitCode', async () => {
    mockExecImpl.mockReturnValue({ stdout: 'out\n', stderr: 'err\n' })

    const results = await runner.run([{ command: 'some-tool', optional: false, failOnError: false }])

    expect(results[0]).toEqual({
      command: 'some-tool',
      exitCode: 0,
      stdout: 'out',
      stderr: 'err',
      passed: true,
    })
  })
})
