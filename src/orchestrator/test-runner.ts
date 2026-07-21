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
        break
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
        timeout: 300_000,
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
