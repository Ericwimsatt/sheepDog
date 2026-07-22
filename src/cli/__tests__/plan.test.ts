import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { SHEEPDOG_DIR } from '../../constants.js'

const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => {
    const cb = args[args.length - 1]
    const result = mockExecFile(args[0], args[1])
    if (result && typeof result.then === 'function') {
      result.then(
        (res: any) => cb(null, res),
        (err: Error) => cb(err),
      )
    } else {
      cb(null, result ?? { stdout: '', stderr: '' })
    }
  },
}))

let tmpDir: string
let exitCode: number | null = null
const originalExit = process.exit

beforeEach(() => {
  vi.clearAllMocks()
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-plan-'))
  exitCode = null
  process.exit = vi.fn((code?: number) => {
    exitCode = code ?? 0
  }) as any
})

afterEach(() => {
  process.exit = originalExit
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('planCommand', () => {
  it('creates task directory', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'plan created', stderr: '' })

    const { planCommand } = await import('../commands/plan.js')
    await planCommand('Add dark mode', { dir: tmpDir })

    const taskDir = join(tmpDir, SHEEPDOG_DIR, 'add-dark-mode')
    expect(existsSync(taskDir)).toBe(true)
  })

  it('invokes opencode CLI with correct args', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'plan created', stderr: '' })

    const { planCommand } = await import('../commands/plan.js')
    await planCommand('Add dark mode', { dir: tmpDir })

    expect(mockExecFile).toHaveBeenCalledWith(
      'opencode',
      expect.arrayContaining(['--prompt', expect.stringContaining('Add dark mode'), '--yes']),
    )
  })

  it('handles opencode timeout/error with exit code 1', async () => {
    mockExecFile.mockRejectedValue(new Error('timeout'))

    const { planCommand } = await import('../commands/plan.js')
    await planCommand('Add dark mode', { dir: tmpDir })

    expect(exitCode).toBe(1)
  })

  it('sanitizes description to create valid directory name', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' })

    const { planCommand } = await import('../commands/plan.js')
    await planCommand('  FIX!! the @#$% BUGS  ', { dir: tmpDir })

    const entries = readdirSync(join(tmpDir, SHEEPDOG_DIR))
    expect(entries[0]).toMatch(/^fix-the-bugs$/)
  })
})
